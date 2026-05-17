import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProductPageLayout } from '@/components/public/ProductPageLayout'
import { ProductScreenshotGallery } from '@/components/public/ProductScreenshotGallery'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getAppReleaseLabel } from '@/config/appRelease'
import { hasWorkspaceApiBase } from '@/config/saasConfig'
import {
  PRODUCT_FEATURES,
  PRODUCT_HERO_IMAGE,
  PRODUCT_LEAD,
  PRODUCT_SCREENSHOTS,
  PRODUCT_STRIPE_NOTE,
  productAssetUrl,
} from '@/content/productPageContent'
import { fetchBillingPlans, type BillingPlanPublic } from '@/services/billing/billingApi'
import { Check } from 'lucide-react'

function formatUsd(n: number | null): string {
  if (n == null) return '—'
  if (n === 0) return 'USD 0'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function planSummaryLines(plan: BillingPlanPublic): { price: string; tokens: string; users: string } {
  const periodLabel = plan.tokenPeriod === 'fortnight' ? 'quincena' : 'mes'
  const price =
    plan.monthlyPriceUsd != null ? `${formatUsd(plan.monthlyPriceUsd)}/mes` : 'Precio bajo consulta'
  const tokenCap =
    plan.monthlyLlmTokens === 0
      ? 'IA sin tope (según plan)'
      : plan.monthlyLlmTokens >= 1_000_000
        ? `~${(plan.monthlyLlmTokens / 1_000_000).toFixed(1)}M tokens IA / ${periodLabel}`
        : `${(plan.monthlyLlmTokens / 1_000).toFixed(0)}k tokens IA / ${periodLabel}`
  const usersCap = plan.maxUsersPerOrg === 0 ? 'Usuarios: sin tope indicado' : `Hasta ${plan.maxUsersPerOrg} usuarios`
  return { price, tokens: tokenCap, users: usersCap }
}

function ProductPlansPreview() {
  const [plans, setPlans] = useState<BillingPlanPublic[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hasWorkspaceApiBase()) {
      setLoading(false)
      return
    }
    let cancel = false
    ;(async () => {
      try {
        const res = await fetchBillingPlans()
        if (!cancel) setPlans(res.plans)
      } catch (e) {
        if (!cancel) setErr(e instanceof Error ? e.message : 'No se pudo cargar el catálogo')
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  if (!hasWorkspaceApiBase()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Catálogo en vivo</CardTitle>
          <CardDescription>
            Con el API de plataforma configurado verás aquí los mismos planes que en{' '}
            <strong className="text-foreground">Ajustes → Facturación</strong>. En modo solo-wallet, autohospeda con tu
            API key o configura <code className="text-[10px]">VITE_API_USE_SAME_ORIGIN</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" asChild>
            <Link to="/login">Iniciar sesión</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Catálogo en vivo</CardTitle>
        <CardDescription>
          Referencia pública (Stripe). Para contratar o gestionar la suscripción,{' '}
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">
            inicia sesión
          </Link>{' '}
          y usa <strong className="text-foreground">Ajustes → Facturación</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {err ? <p className="text-sm text-destructive">{err}</p> : null}
        {loading ? <p className="text-sm text-muted-foreground">Cargando planes…</p> : null}
        {!loading && plans && plans.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((p) => {
              const { price, tokens, users } = planSummaryLines(p)
              return (
                <div key={p.id} className="rounded-lg border bg-card/50 p-3 text-sm space-y-2">
                  <div className="font-semibold">{p.label}</div>
                  <div className="text-muted-foreground">{price}</div>
                  <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                    <li>{users}</li>
                    <li>{tokens}</li>
                  </ul>
                  {p.highlights?.length ? (
                    <ul className="text-xs list-disc pl-4 space-y-0.5 text-muted-foreground/90">
                      {p.highlights.slice(0, 4).map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}
        {!loading && !plans?.length && !err ? (
          <p className="text-sm text-muted-foreground">No hay planes publicados en el servidor.</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ProductHero() {
  const heroSrc = productAssetUrl(PRODUCT_HERO_IMAGE.src)

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,520px)] lg:items-center lg:gap-10 xl:gap-12">
      <div className="space-y-6 text-center lg:text-left">
        <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
          <Badge
            variant="outline"
            className="border-teal-500/40 bg-teal-500/10 font-mono text-[10px] uppercase tracking-[0.22em] text-teal-300"
          >
            {getAppReleaseLabel()}
          </Badge>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-teal-400/95">
          Redacción · Legal · Académico · IA
        </p>
        <h1 className="product-page-serif text-3xl font-normal leading-[1.15] tracking-tight text-white sm:text-4xl lg:text-[2.65rem]">
          Redacción legal y académica asistida por IA
        </h1>
        <p className="text-base leading-relaxed text-white/78 sm:text-lg">{PRODUCT_LEAD}</p>
        <div className="flex flex-col justify-center gap-3 pt-1 sm:flex-row lg:justify-start">
          <Button size="lg" className="border-0 bg-teal-600 text-white hover:bg-teal-500" asChild>
            <Link to="/login">Iniciar sesión</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
            asChild
          >
            <Link to="/register">Crear cuenta</Link>
          </Button>
        </div>
      </div>

      <figure className="mx-auto w-full max-w-lg lg:mx-0 lg:max-w-none">
        <div className="product-hero-shot overflow-hidden rounded-xl border border-white/15 bg-[#0f1628] shadow-2xl shadow-black/50 ring-1 ring-white/10">
          <img
            src={heroSrc}
            alt={PRODUCT_HERO_IMAGE.alt}
            className="block h-auto w-full max-h-[min(52vh,420px)] object-contain object-top lg:max-h-[min(58vh,480px)]"
            width={1280}
            height={800}
            fetchPriority="high"
            decoding="async"
          />
        </div>
        <figcaption className="mt-3 text-center text-xs leading-snug text-white/55 lg:text-left">
          {PRODUCT_HERO_IMAGE.caption}
        </figcaption>
      </figure>
    </div>
  )
}

export default function ProductPage() {
  return (
    <ProductPageLayout hero={<ProductHero />}>
      <div className="mx-auto max-w-6xl space-y-16 px-4 py-12 sm:px-6 sm:py-16">
        <section id="caracteristicas" className="scroll-mt-24 space-y-8">
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-teal-600 dark:text-teal-400">
              Características
            </p>
            <h2 className="product-page-serif text-2xl font-normal tracking-tight sm:text-3xl">
              Todo lo que necesitas en un solo flujo
            </h2>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {PRODUCT_FEATURES.map((f) => (
              <li
                key={f.title}
                className="flex gap-3 rounded-xl border border-border/80 bg-card/60 p-4 shadow-sm"
              >
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
                <div className="min-w-0 space-y-1">
                  <p className="font-medium leading-snug">{f.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section id="plataforma" className="scroll-mt-24 space-y-6">
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-teal-600 dark:text-teal-400">
              La plataforma en uso
            </p>
            <h2 className="product-page-serif text-2xl font-normal tracking-tight sm:text-3xl">
              Haz clic en una captura para ampliarla
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Vista del editor con asistente, evaluación académica, biblioteca local, bitácora de fuentes, identidad y
              WebAuthn.
            </p>
          </div>
          <ProductScreenshotGallery shots={PRODUCT_SCREENSHOTS} />
        </section>

        <section id="planes" className="scroll-mt-24 space-y-6">
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-teal-600 dark:text-teal-400">
              Plan gestionado (Stripe, opcional)
            </p>
            <h2 className="product-page-serif text-2xl font-normal tracking-tight sm:text-3xl">
              Autohospedable primero
            </h2>
          </div>
          <Card className="border-dashed bg-muted/25">
            <CardContent className="pt-6 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {PRODUCT_STRIPE_NOTE}
            </CardContent>
          </Card>
          <ProductPlansPreview />
        </section>

        <section className="rounded-xl border border-border/80 bg-card/40 px-4 py-6 sm:px-6">
          <h2 className="text-base font-semibold">Información legal</h2>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            El código es autohospedable bajo licencia FSL-1.1-MIT (resumen y condiciones del servicio en términos). Textos en
            revisión; conviene validarlos con asesoría antes de producción.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="secondary" size="sm" asChild>
              <Link to="/legal/terminos">Términos y condiciones</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/legal/privacidad">Aviso de privacidad</Link>
            </Button>
          </div>
        </section>
      </div>
    </ProductPageLayout>
  )
}
