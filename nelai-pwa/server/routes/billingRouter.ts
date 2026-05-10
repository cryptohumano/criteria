import { Router, type RequestHandler } from 'express'
import Stripe from 'stripe'

import { getPrisma } from '../db.js'
import { HttpError } from '../auth/httpError.js'
import { listPlansPublicPayload } from '../billing/planCatalog.js'

const STRIPE_API_VERSION = '2024-06-20'

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) throw new HttpError('Configura STRIPE_SECRET_KEY en el servidor.', 503)
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION as any })
}

function priceIdForPlan(plan: string): string {
  const p = (plan || '').toLowerCase()
  if (p === 'starter') return String(process.env.STRIPE_PRICE_STARTER || '').trim()
  if (p === 'pro') return String(process.env.STRIPE_PRICE_PRO || '').trim()
  if (p === 'enterprise') return String(process.env.STRIPE_PRICE_ENTERPRISE || '').trim()
  throw new HttpError('Plan inválido. Usa starter, pro o enterprise.', 400)
}

function absoluteUrlFromEnv(name: string, fallback: string): string {
  const v = (process.env[name] || '').trim()
  return v || fallback
}

export function createBillingRouter(requireUser: RequestHandler): Router {
  const r = Router()

  /** Catálogo y límites (sin secretos); sirve para Settings y para alinear con Products/Prices en Stripe. */
  r.get('/plans', (_req, res) => {
    res.json(listPlansPublicPayload())
  })

  r.use(requireUser)

  r.get('/status', async (req, res) => {
    const prisma = await getPrisma()
    if (!prisma) return res.status(503).json({ error: 'Configura DATABASE_URL' })
    const org = await prisma.organization.findUnique({
      where: { id: req.auth!.organizationId },
      select: {
        id: true,
        name: true,
        plan: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripeSubscriptionStatus: true,
        stripeCurrentPeriodStart: true,
        stripeCurrentPeriodEnd: true,
      },
    })
    return res.json({ organization: org })
  })

  r.post('/checkout', async (req, res) => {
    const plan = String((req.body as { plan?: unknown })?.plan || '').trim()
    const priceId = priceIdForPlan(plan)
    if (!priceId) throw new HttpError(`Configura STRIPE_PRICE_${plan.toUpperCase()} en el servidor.`, 503)

    const prisma = await getPrisma()
    if (!prisma) return res.status(503).json({ error: 'Configura DATABASE_URL' })

    const org = await prisma.organization.findUnique({
      where: { id: req.auth!.organizationId },
      select: { id: true, name: true, plan: true, stripeCustomerId: true },
    })
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' })

    const stripe = getStripe()
    const successUrl = absoluteUrlFromEnv('STRIPE_SUCCESS_URL', 'http://localhost:5173/settings?billing=success')
    const cancelUrl = absoluteUrlFromEnv('STRIPE_CANCEL_URL', 'http://localhost:5173/settings?billing=cancel')

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: org.stripeCustomerId || undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      client_reference_id: org.id,
      metadata: { organizationId: org.id, plan },
      subscription_data: {
        metadata: { organizationId: org.id, plan },
      },
    })

    return res.json({ url: session.url })
  })

  r.post('/portal', async (req, res) => {
    const prisma = await getPrisma()
    if (!prisma) return res.status(503).json({ error: 'Configura DATABASE_URL' })

    const org = await prisma.organization.findUnique({
      where: { id: req.auth!.organizationId },
      select: { id: true, stripeCustomerId: true },
    })
    if (!org?.stripeCustomerId) {
      return res.status(400).json({ error: 'No hay customer de Stripe aún. Inicia checkout primero.' })
    }

    const stripe = getStripe()
    const returnUrl = absoluteUrlFromEnv('STRIPE_PORTAL_RETURN_URL', 'http://localhost:5173/settings')
    const portal = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: returnUrl,
    })
    return res.json({ url: portal.url })
  })

  return r
}

export function createBillingWebhookHandler() {
  return async function billingWebhook(req: any, res: any) {
    let stripe: Stripe
    try {
      stripe = getStripe()
    } catch (e) {
      const err = e as any
      return res.status(err?.status || 503).send(err?.message || 'Stripe no configurado')
    }

    const secret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim()
    if (!secret) return res.status(503).send('Configura STRIPE_WEBHOOK_SECRET')

    const sig = req.headers['stripe-signature']
    if (!sig || typeof sig !== 'string') return res.status(400).send('Missing stripe-signature')

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret)
    } catch (err: any) {
      return res.status(400).send(`Webhook signature verification failed: ${err?.message || 'error'}`)
    }

    const prisma = await getPrisma()
    if (!prisma) return res.status(503).send('Configura DATABASE_URL')

    // Periodos de facturación viven en `subscription.items` (Stripe API reciente); fallback por compatibilidad.
    const billingPeriodFromSubscription = (sub: Stripe.Subscription) => {
      const items = sub.items?.data
      if (items?.length) {
        const it = items[0]
        return {
          start: it.current_period_start ? new Date(it.current_period_start * 1000) : null,
          end: it.current_period_end ? new Date(it.current_period_end * 1000) : null,
        }
      }
      const legacy = sub as Stripe.Subscription & {
        current_period_start?: number
        current_period_end?: number
      }
      return {
        start: legacy.current_period_start ? new Date(legacy.current_period_start * 1000) : null,
        end: legacy.current_period_end ? new Date(legacy.current_period_end * 1000) : null,
      }
    }

    // Helper: aplica snapshot de subscription a Organization
    const upsertFromSubscription = async (sub: Stripe.Subscription, planFromMeta?: string) => {
      const orgId = (sub.metadata?.organizationId || '') as string
      if (!orgId) return

      const { start: currentPeriodStart, end: currentPeriodEnd } = billingPeriodFromSubscription(sub)
      const status = sub.status || null
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
      const plan = (planFromMeta || sub.metadata?.plan || '').toString().trim().toLowerCase()
      const paid = plan && plan !== 'trial'

      await prisma.organization.update({
        where: { id: orgId },
        data: {
          plan: plan || undefined,
          stripeCustomerId: customerId || undefined,
          stripeSubscriptionId: sub.id,
          stripeSubscriptionStatus: status || undefined,
          stripeCurrentPeriodStart: currentPeriodStart || undefined,
          stripeCurrentPeriodEnd: currentPeriodEnd || undefined,
          ...(paid ? { trialEndsAt: null } : {}),
        },
      }).catch(() => {})
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session
          const orgId = (session.metadata?.organizationId || session.client_reference_id || '') as string
          const plan = (session.metadata?.plan || '') as string
          const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
          const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
          if (orgId) {
            const paid = String(plan || '')
              .trim()
              .toLowerCase()
            const isPaid = paid && paid !== 'trial'
            await prisma.organization.update({
              where: { id: orgId },
              data: {
                stripeCustomerId: customerId || undefined,
                stripeSubscriptionId: subId || undefined,
                plan: plan || undefined,
                ...(isPaid ? { trialEndsAt: null } : {}),
              },
            }).catch(() => {})
          }
          break
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription
          await upsertFromSubscription(sub)
          break
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription
          const orgId = (sub.metadata?.organizationId || '') as string
          if (orgId) {
            await prisma.organization.update({
              where: { id: orgId },
              data: {
                plan: 'trial',
                stripeSubscriptionStatus: sub.status || 'canceled',
                trialEndsAt: new Date(),
              },
            }).catch(() => {})
          }
          break
        }
        default:
          break
      }
    } catch (e) {
      console.error('[billing/webhook]', e)
      // Respond OK para no reintentar infinito mientras afinamos.
    }

    return res.json({ received: true })
  }
}

