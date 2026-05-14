import { Router, type RequestHandler } from 'express'
import Stripe from 'stripe'

import { getPrisma } from '../db.js'
import { HttpError, getHttpStatus } from '../auth/httpError.js'
import {
  listPlansPublicPayload,
  normalizeBillingPlanId,
  getPlanEntitlements,
  type BillingPlanId,
} from '../billing/planCatalog.js'
import { getLlmTokenLimitForPlan } from '../usage/planLimits.js'
import {
  applyCheckoutSessionToOrganization,
  applyStripeSubscriptionToOrganization,
  inferPlanFromSubscriptionLineItems,
  resolveOrganizationIdForDeletedSubscription,
  syncOrganizationBillingFromStripe,
} from '../billing/stripeSubscriptionSync.js'

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

/** Suscripción con cobro vigente o en riesgo: no abrir otro checkout del mismo tier. */
function subscriptionStatusBlocksSamePlanRenewal(status: string | null | undefined): boolean {
  const s = (status || '').toLowerCase()
  return s === 'active' || s === 'trialing' || s === 'past_due' || s === 'unpaid'
}

function checkoutPlanFromBody(plan: string): BillingPlanId {
  const p = String(plan || '')
    .trim()
    .toLowerCase()
  if (p === 'starter' || p === 'pro' || p === 'enterprise') return p
  throw new HttpError('Plan inválido. Usa starter, pro o enterprise.', 400)
}

async function assertNoDuplicatePlanCheckout(
  stripe: Stripe,
  org: {
    plan: string
    stripeSubscriptionId: string | null
    stripeSubscriptionStatus: string | null
  },
  requested: BillingPlanId,
): Promise<void> {
  if (requested !== 'starter' && requested !== 'pro' && requested !== 'enterprise') return

  let status: string | null = org.stripeSubscriptionStatus
  let tier: BillingPlanId = normalizeBillingPlanId(org.plan)

  if (org.stripeSubscriptionId) {
    const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId)
    status = sub.status
    const metaPlan = (sub.metadata?.plan || '').trim().toLowerCase()
    if (metaPlan === 'starter' || metaPlan === 'pro' || metaPlan === 'enterprise') {
      tier = metaPlan
    } else {
      const fromPrice = inferPlanFromSubscriptionLineItems(sub)
      if (fromPrice === 'starter' || fromPrice === 'pro' || fromPrice === 'enterprise') {
        tier = fromPrice
      }
    }
  }

  if (!subscriptionStatusBlocksSamePlanRenewal(status)) return
  if (tier !== requested) return

  throw new HttpError(
    'Ya tienes este plan activo en el periodo de facturación actual. Para cambiar método de pago, ' +
      'cantidad de licencias o cancelar, usa «Administrar en Stripe».',
    409,
  )
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
    if (!org) return res.status(404).json({ error: 'Organización no encontrada' })

    const ent = getPlanEntitlements(org.plan)
    const planId = normalizeBillingPlanId(org.plan)
    const llmTokensPerPeriod = getLlmTokenLimitForPlan(org.plan)
    const lockedCheckoutPlanId =
      subscriptionStatusBlocksSamePlanRenewal(org.stripeSubscriptionStatus) &&
      (planId === 'starter' || planId === 'pro' || planId === 'enterprise')
        ? planId
        : null

    return res.json({
      organization: org,
      billing: {
        planId,
        planLabel: ent.label,
        maxUsersPerOrg: ent.maxUsersPerOrg,
        llmTokensPerPeriod,
        tokenPeriod: ent.tokenPeriod,
        stripeSubscriptionStatus: org.stripeSubscriptionStatus,
        stripeCurrentPeriodStart: org.stripeCurrentPeriodStart?.toISOString() ?? null,
        stripeCurrentPeriodEnd: org.stripeCurrentPeriodEnd?.toISOString() ?? null,
        lockedCheckoutPlanId,
      },
    })
  })

  r.post('/checkout', async (req, res) => {
    try {
      const planRaw = String((req.body as { plan?: unknown })?.plan || '').trim()
      const requested = checkoutPlanFromBody(planRaw)
      const priceId = priceIdForPlan(requested)
      if (!priceId) {
        throw new HttpError(`Configura STRIPE_PRICE_${requested.toUpperCase()} en el servidor.`, 503)
      }

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
        },
      })
      if (!org) return res.status(404).json({ error: 'Organización no encontrada' })

      const stripe = getStripe()
      await assertNoDuplicatePlanCheckout(stripe, org, requested)

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
        metadata: { organizationId: org.id, plan: requested },
        subscription_data: {
          metadata: { organizationId: org.id, plan: requested },
        },
      })

      return res.json({ url: session.url })
    } catch (e: unknown) {
      const status = getHttpStatus(e)
      const message = e instanceof Error ? e.message : 'Error'
      return res.status(status).json({ error: message })
    }
  })

  /**
   * Tras Checkout, el webhook puede llegar unos segundos después del redirect.
   * Reconcilia org desde la API de Stripe (subscription activa del customer).
   */
  r.post('/sync', async (req, res) => {
    const prisma = await getPrisma()
    if (!prisma) return res.status(503).json({ error: 'Configura DATABASE_URL' })

    const orgId = req.auth!.organizationId
    const stripe = getStripe()
    const { synced } = await syncOrganizationBillingFromStripe(prisma, stripe, orgId)

    const fresh = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        plan: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripeSubscriptionStatus: true,
        stripeCurrentPeriodStart: true,
        stripeCurrentPeriodEnd: true,
      },
    })
    return res.json({ synced, organization: fresh })
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

    const logWebhookDbError = (phase: string, err: unknown) =>
      console.error('[billing/webhook]', event.type, phase, err)

    try {
      switch (event.type) {
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded': {
          const thin = event.data.object as Stripe.Checkout.Session
          try {
            const session = await stripe.checkout.sessions.retrieve(thin.id, {
              expand: ['line_items.data.price', 'subscription'],
            })
            await applyCheckoutSessionToOrganization(prisma, session, stripe)
            console.info('[billing/webhook]', event.type, 'applied', session.id, {
              org: (session.metadata?.organizationId || session.client_reference_id || '').trim() || undefined,
              planMeta: (session.metadata?.plan || '').trim() || undefined,
            })
          } catch (e) {
            logWebhookDbError(event.type, e)
          }
          break
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const thin = event.data.object as Stripe.Subscription
          try {
            const sub = await stripe.subscriptions.retrieve(thin.id, {
              expand: ['items.data.price'],
            })
            await applyStripeSubscriptionToOrganization(prisma, sub)
            console.info('[billing/webhook]', event.type, 'applied', sub.id, {
              org: (sub.metadata?.organizationId || '').trim() || undefined,
              status: sub.status,
            })
          } catch (e) {
            logWebhookDbError('subscription', e)
          }
          break
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription
          const orgId = await resolveOrganizationIdForDeletedSubscription(prisma, sub)
          if (orgId) {
            await prisma.organization
              .update({
                where: { id: orgId },
                data: {
                  plan: 'trial',
                  stripeSubscriptionStatus: sub.status || 'canceled',
                  trialEndsAt: new Date(),
                },
              })
              .catch((e) => logWebhookDbError('subscription.deleted', e))
          }
          break
        }
        case 'invoice.payment_succeeded':
        case 'invoice.paid': {
          const invoice = event.data.object as Stripe.Invoice
          const subRef = invoice.subscription
          const subId = typeof subRef === 'string' ? subRef : subRef?.id ?? null
          if (!subId) break
          try {
            const sub = await stripe.subscriptions.retrieve(subId, {
              expand: ['items.data.price'],
            })
            await applyStripeSubscriptionToOrganization(prisma, sub)
            console.info('[billing/webhook]', event.type, 'applied', sub.id, {
              org: (sub.metadata?.organizationId || '').trim() || undefined,
            })
          } catch (e) {
            logWebhookDbError('invoice', e)
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

