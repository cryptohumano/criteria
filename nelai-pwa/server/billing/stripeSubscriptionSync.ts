/**
 * Aplica estado de Stripe (Checkout / Subscription) a `Organization`.
 * Compartido por el webhook y por `POST /api/billing/sync` (vuelta desde Checkout).
 */
import type { PrismaClient } from '@prisma/client'
import type Stripe from 'stripe'
import { normalizeBillingPlanId, type BillingPlanId } from './planCatalog.js'

export function billingPeriodFromSubscription(sub: Stripe.Subscription): {
  start: Date | null
  end: Date | null
} {
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

/** Mapea Price ID de Stripe → plan interno (variables de entorno). */
function priceIdToPlanFromEnv(): Map<string, BillingPlanId> {
  const m = new Map<string, BillingPlanId>()
  const a = process.env.STRIPE_PRICE_STARTER?.trim()
  const b = process.env.STRIPE_PRICE_PRO?.trim()
  const c = process.env.STRIPE_PRICE_ENTERPRISE?.trim()
  if (a) m.set(a, 'starter')
  if (b) m.set(b, 'pro')
  if (c) m.set(c, 'enterprise')
  return m
}

function priceIdFromStripePriceField(
  p: string | Stripe.Price | Stripe.DeletedPrice | null | undefined
): string | undefined {
  if (!p) return undefined
  if (typeof p === 'string') return p
  if ('deleted' in p && p.deleted) return undefined
  return (p as Stripe.Price).id
}

/** A partir de líneas con campo `price` (Checkout o Subscription items). */
function inferPlanFromPriceFields(
  rows: { price: string | Stripe.Price | Stripe.DeletedPrice | null | undefined }[]
): BillingPlanId | null {
  const map = priceIdToPlanFromEnv()
  for (const row of rows) {
    const id = priceIdFromStripePriceField(row.price)
    if (id && map.has(id)) return map.get(id)!
  }
  return null
}

/** Checkout Session con `line_items` expandidos (p. ej. tras retrieve en webhook). */
export function inferPlanFromCheckoutLineItems(
  lineItems: Stripe.LineItem[] | undefined
): BillingPlanId | null {
  if (!lineItems?.length) return null
  return inferPlanFromPriceFields(lineItems.map((li) => ({ price: li.price })))
}

/** Si la suscripción lleva un price enlazado a STRIPE_PRICE_*, devuelve starter|pro|enterprise. */
export function inferPlanFromSubscriptionLineItems(sub: Stripe.Subscription): BillingPlanId | null {
  const items = sub.items?.data ?? []
  return inferPlanFromPriceFields(items.map((it) => ({ price: it.price })))
}

export async function resolveOrganizationIdForCheckoutSession(
  prisma: PrismaClient,
  session: Stripe.Checkout.Session
): Promise<string | null> {
  const fromMeta = (session.metadata?.organizationId || '').trim()
  if (fromMeta) return fromMeta
  const fromRef = (session.client_reference_id || '').trim()
  if (fromRef) return fromRef
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
  if (!customerId) return null
  const org = await prisma.organization.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  })
  return org?.id ?? null
}

export async function resolveOrganizationIdForSubscription(
  prisma: PrismaClient,
  sub: Stripe.Subscription
): Promise<string | null> {
  const fromMeta = (sub.metadata?.organizationId || '').trim()
  if (fromMeta) return fromMeta
  const bySub = await prisma.organization.findFirst({
    where: { stripeSubscriptionId: sub.id },
    select: { id: true },
  })
  if (bySub) return bySub.id
  const cust = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
  if (!cust) return null
  const byCustomer = await prisma.organization.findFirst({
    where: { stripeCustomerId: cust },
    select: { id: true },
  })
  return byCustomer?.id ?? null
}

export async function resolveOrganizationIdForDeletedSubscription(
  prisma: PrismaClient,
  sub: Stripe.Subscription
): Promise<string | null> {
  const fromMeta = (sub.metadata?.organizationId || '').trim()
  if (fromMeta) return fromMeta
  const bySub = await prisma.organization.findFirst({
    where: { stripeSubscriptionId: sub.id },
    select: { id: true },
  })
  return bySub?.id ?? null
}

export type ApplyStripeSubscriptionOpts = {
  planFromMeta?: string
  /** POST /sync: aplica a esta org aunque la suscripción no tenga metadata.organizationId. */
  organizationId?: string
}

export async function applyStripeSubscriptionToOrganization(
  prisma: PrismaClient,
  sub: Stripe.Subscription,
  opts?: ApplyStripeSubscriptionOpts
): Promise<void> {
  const forcedOrg = opts?.organizationId?.trim()
  const orgId = forcedOrg || (await resolveOrganizationIdForSubscription(prisma, sub))
  if (!orgId) {
    console.warn('[billing] subscription sin organizationId resoluble', sub.id)
    return
  }

  const orgRow = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  })
  if (!orgRow) {
    console.error('[billing] subscription organizationId no existe en BD', { orgId, subscriptionId: sub.id })
    return
  }

  const { start: currentPeriodStart, end: currentPeriodEnd } = billingPeriodFromSubscription(sub)
  const status = sub.status || null
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
  const rawMeta = (opts?.planFromMeta ?? sub.metadata?.plan ?? '').toString().trim()
  const inferred = rawMeta ? null : inferPlanFromSubscriptionLineItems(sub)
  const planSource = rawMeta || (inferred ?? '')

  if (forcedOrg && !planSource) {
    const linePriceIds = (sub.items?.data ?? []).map((i) => {
      const p = i.price
      return typeof p === 'string' ? p : p?.id
    })
    console.warn('[billing] suscripción aplicada sin plan (revisa STRIPE_PRICE_* o metadata.plan)', {
      subscriptionId: sub.id,
      linePriceIds,
    })
  }

  const baseData = {
    stripeCustomerId: customerId || undefined,
    stripeSubscriptionId: sub.id,
    stripeSubscriptionStatus: status || undefined,
    stripeCurrentPeriodStart: currentPeriodStart ?? undefined,
    stripeCurrentPeriodEnd: currentPeriodEnd ?? undefined,
  }

  try {
    if (planSource) {
      const plan = normalizeBillingPlanId(planSource)
      const paid = plan !== 'trial'
      await prisma.organization.update({
        where: { id: orgId },
        data: {
          ...baseData,
          plan,
          ...(paid ? { trialEndsAt: null } : {}),
        },
      })
    } else {
      await prisma.organization.update({
        where: { id: orgId },
        data: baseData,
      })
    }
  } catch (e) {
    console.error('[billing] subscription prisma.organization.update falló', { orgId, subscriptionId: sub.id }, e)
    throw e
  }
}

function subscriptionFromCheckoutSession(session: Stripe.Checkout.Session): Stripe.Subscription | null {
  const s = session.subscription
  if (typeof s === 'object' && s !== null && 'id' in s) {
    return s as Stripe.Subscription
  }
  return null
}

export async function applyCheckoutSessionToOrganization(
  prisma: PrismaClient,
  session: Stripe.Checkout.Session,
  stripe: Stripe
): Promise<void> {
  const orgId = await resolveOrganizationIdForCheckoutSession(prisma, session)
  if (!orgId) {
    console.warn('[billing] checkout.session sin org resoluble', session.id, {
      hasMetadataOrg: Boolean((session.metadata?.organizationId || '').trim()),
      clientReferenceId: (session.client_reference_id || '').trim() || undefined,
    })
    return
  }

  const orgRow = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  })
  if (!orgRow) {
    console.error('[billing] checkout organizationId no existe en BD', { orgId, sessionId: session.id })
    return
  }

  let planRaw = (session.metadata?.plan || '').toString().trim()
  if (!planRaw) {
    const fromLines = inferPlanFromCheckoutLineItems(session.line_items?.data)
    if (fromLines) planRaw = fromLines
  }
  const expandedSub = subscriptionFromCheckoutSession(session)
  if (!planRaw && expandedSub) {
    const inferred = inferPlanFromSubscriptionLineItems(expandedSub)
    if (inferred) planRaw = inferred
  }
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
  const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id

  if (!planRaw && subId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price'] })
      const inferred = inferPlanFromSubscriptionLineItems(sub)
      if (inferred) planRaw = inferred
    } catch (e) {
      console.warn('[billing] checkout no pudo leer subscription', subId, e)
    }
  }

  if (!planRaw) {
    console.warn('[billing] checkout sin plan inferible (metadata.plan, line_items, STRIPE_PRICE_*)', {
      sessionId: session.id,
      orgId,
      paymentStatus: session.payment_status,
      mode: session.mode,
    })
  }

  try {
    if (planRaw) {
      const plan = normalizeBillingPlanId(planRaw)
      const isPaid = plan !== 'trial'
      await prisma.organization.update({
        where: { id: orgId },
        data: {
          stripeCustomerId: customerId || undefined,
          stripeSubscriptionId: subId || undefined,
          plan,
          ...(isPaid ? { trialEndsAt: null } : {}),
        },
      })
    } else {
      await prisma.organization.update({
        where: { id: orgId },
        data: {
          stripeCustomerId: customerId || undefined,
          stripeSubscriptionId: subId || undefined,
        },
      })
    }
  } catch (e) {
    console.error('[billing] checkout prisma.organization.update falló', { orgId, sessionId: session.id }, e)
    throw e
  }
}

const USABLE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid'])

function rankSubscriptionStatus(s: string): number {
  const order: Record<string, number> = {
    active: 0,
    trialing: 1,
    past_due: 2,
    unpaid: 3,
    paused: 6,
    canceled: 20,
    incomplete_expired: 21,
    incomplete: 15,
  }
  return order[s] ?? 10
}

async function stripeCustomerEmail(stripe: Stripe, customerId: string): Promise<string | null> {
  try {
    const c = await stripe.customers.retrieve(customerId)
    if (c.deleted) return null
    return ((c as Stripe.Customer).email || '').trim().toLowerCase() || null
  } catch {
    return null
  }
}

/** Evita aplicar la suscripción de otro tenant si comparten email o metadata cruzada. */
export async function subscriptionAppliesToOrganization(
  prisma: PrismaClient,
  stripe: Stripe,
  organizationId: string,
  sub: Stripe.Subscription,
  ownerEmail: string
): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { stripeCustomerId: true, stripeSubscriptionId: true },
  })
  if (!org) return false
  /** Ya enlazada en BD (p. ej. webhook parcial): no exigir email del customer en Stripe. */
  if (org.stripeSubscriptionId === sub.id) return true

  const metaOrg = (sub.metadata?.organizationId || '').trim()
  if (metaOrg && metaOrg !== organizationId) return false
  const custId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
  if (!custId) return false
  if (org.stripeCustomerId && custId === org.stripeCustomerId) return true
  if (metaOrg === organizationId) return true
  if (!ownerEmail) return false
  const em = await stripeCustomerEmail(stripe, custId)
  return Boolean(em && em === ownerEmail)
}

/**
 * Reconcilia facturación Stripe → org (POST /sync).
 * Incluye búsqueda por email del owner del tenant si aún no hay `stripeCustomerId` en BD.
 */
export async function syncOrganizationBillingFromStripe(
  prisma: PrismaClient,
  stripe: Stripe,
  organizationId: string
): Promise<{ synced: boolean }> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  })
  if (!org) return { synced: false }

  const owner = await prisma.user.findFirst({
    where: { organizationId, orgRole: 'owner' },
    select: { email: true },
  })
  const ownerEmail = (owner?.email || '').trim().toLowerCase()

  const candidates: Stripe.Subscription[] = []
  const seen = new Set<string>()
  const push = (s: Stripe.Subscription) => {
    if (seen.has(s.id)) return
    seen.add(s.id)
    candidates.push(s)
  }

  if (org.stripeSubscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId, {
        expand: ['items.data.price'],
      })
      push(sub)
    } catch {
      /* id obsoleto o borrado en Stripe */
    }
  }

  if (org.stripeCustomerId) {
    const list = await stripe.subscriptions.list({
      customer: org.stripeCustomerId,
      status: 'all',
      limit: 25,
      expand: ['data.items.data.price'],
    })
    for (const s of list.data) push(s)
  }

  if (ownerEmail) {
    const customers = await stripe.customers.list({ email: ownerEmail, limit: 15 })
    for (const c of customers.data) {
      const list = await stripe.subscriptions.list({
        customer: c.id,
        status: 'all',
        limit: 25,
        expand: ['data.items.data.price'],
      })
      for (const s of list.data) push(s)
    }
  }

  const usable = candidates.filter((s) => USABLE_SUBSCRIPTION_STATUSES.has(s.status))
  const byOrgMeta = usable.filter((s) => (s.metadata?.organizationId || '').trim() === organizationId)
  const pool = byOrgMeta.length > 0 ? byOrgMeta : usable
  const sorted = [...pool].sort(
    (a, b) => rankSubscriptionStatus(a.status) - rankSubscriptionStatus(b.status)
  )

  for (const sub of sorted) {
    if (byOrgMeta.length > 0) {
      await applyStripeSubscriptionToOrganization(prisma, sub, { organizationId })
      return { synced: true }
    }
    if (org.stripeSubscriptionId === sub.id) {
      await applyStripeSubscriptionToOrganization(prisma, sub, { organizationId })
      return { synced: true }
    }
    const ok = await subscriptionAppliesToOrganization(prisma, stripe, organizationId, sub, ownerEmail)
    if (!ok) continue
    await applyStripeSubscriptionToOrganization(prisma, sub, { organizationId })
    return { synced: true }
  }

  console.warn('[billing/sync] sin suscripción aplicable', {
    organizationId,
    candidates: candidates.length,
    usable: usable.length,
    withOrgMetadata: byOrgMeta.length,
    hasOwnerEmail: Boolean(ownerEmail),
  })

  return { synced: false }
}
