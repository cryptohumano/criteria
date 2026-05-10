import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { GlitchDualPortrait } from '@/components/public/GlitchDualPortrait'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getAppReleaseLabel } from '@/config/appRelease'
import { hasWorkspaceApiBase } from '@/config/saasConfig'
import { fetchBillingPlans, type BillingPlanPublic } from '@/services/billing/billingApi'
import { FileText, FlaskConical, Scale, Shield, Sparkles, Users } from 'lucide-react'

const brandPhotoSrc = `${import.meta.env.BASE_URL}brand/peranto-identity.png`
const brandAsciiSrc = `${import.meta.env.BASE_URL}brand/peranto-identity-ascii.png`

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
          <CardTitle>Planes de pago</CardTitle>
          <CardDescription>
            El catálogo en vivo se obtiene del API de la plataforma. Si estás en modo solo-wallet, configura el backend
            (<code className="text-[10px]">VITE_API_USE_SAME_ORIGIN</code> o <code className="text-[10px]">VITE_API_BASE_URL</code>)
            para ver precios aquí; con sesión iniciada, los mismos planes aparecen en{' '}
            <strong className="text-foreground">Ajustes → Facturación</strong>.
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
        <CardTitle>Planes de pago</CardTitle>
        <CardDescription>
          Referencia pública del catálogo (Stripe). Para contratar o gestionar suscripción hace falta{' '}
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">
            iniciar sesión
          </Link>{' '}
          y usar <strong className="text-foreground">Ajustes → Facturación</strong> en tu organización.
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

export default function ProductPage() {
  return (
    <PublicPageShell backTo={{ href: '/login', label: 'Entrar' }}>
      <div className="space-y-12">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-widest">
            {getAppReleaseLabel()}
          </Badge>
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] lg:items-start lg:gap-12">
          <div className="space-y-5 text-center sm:text-left">
            <div>
              <p className="text-sm font-medium text-primary">CriterIA</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Un producto de <span className="font-medium text-foreground">Peranto</span>
              </p>
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Un IDE de textos con criterio asistido
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              CriterIA es el espacio donde escribes, iteras y firmas: un entorno de trabajo centrado en el documento,
              con una IA que actúa como <strong className="text-foreground">ayudante persistente</strong> — no para
              sustituir tu juicio, sino para <strong className="text-foreground">aclarar criterios</strong>, señalar
              riesgos y acelerar lo que hoy te quita tiempo innecesario.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center sm:justify-start pt-1">
              <Button asChild size="lg">
                <Link to="/login">Iniciar sesión</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/register">Crear cuenta</Link>
              </Button>
            </div>
          </div>

          <figure className="mx-auto w-full max-w-[280px] lg:mx-0 lg:max-w-none">
            <GlitchDualPortrait
              photoSrc={brandPhotoSrc}
              asciiSrc={brandAsciiSrc}
              alt="Identidad visual Peranto para CriterIA, alternando retrato e ilustración tipo ASCII"
            />
            <figcaption className="mt-3 text-center text-xs text-muted-foreground leading-snug lg:text-left">
              Identidad Peranto: fundido entre retrato e ilustración ASCII. Cercanía humana, rigor y mirada directa al
              problema del texto.
            </figcaption>
          </figure>
        </div>

        <section className="space-y-4 rounded-xl border border-border/80 bg-muted/20 px-4 py-6 sm:px-6 sm:py-8">
          <h2 className="text-lg font-semibold tracking-tight">La narrativa: criterio, no piloto automático</h2>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed sm:text-base">
            <p>
              Si no eres abogado y debes revisar un contrato, la IA puede ayudarte a <strong className="text-foreground">ordenar dudas</strong>, resumir cláusulas sensibles y prepararte para decidir si firmas — con la humildad de señalar cuando{' '}
              <strong className="text-foreground">hace falta un especialista</strong>. Un abogado verá el mismo
              documento con otro marco; CriterIA no compite con eso: da capas de lectura y borradores para que el
              criterio humano (el tuyo o el de tu despacho) siga al centro.
            </p>
            <p>
              En investigación, el asistente puede volverse un <strong className="text-foreground">compañero de método</strong>: señalar huecos metodológicos, incoherencias entre secciones o riesgos en el diseño, para que prototipes y ensayes
              más rápido sin confundir velocidad con solidez. La idea es que la IA te devuelva tiempo en lo repetible y
              te empuje a <strong className="text-foreground">mejorar el argumento</strong>, no a publicar a ciegas.
            </p>
            <p>
              Para <strong className="text-foreground">organizaciones</strong> y para{' '}
              <strong className="text-foreground">equipos legales o de investigación</strong> el modelo es el mismo:
              mismo editor, mismos flujos de revisión y de firma cuando lo necesitéis; la diferencia está en el perfil
              (académico frente a legal) y en cómo integráis la wallet y la colaboración en vuestro proceso.
            </p>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <FileText className="h-8 w-8 text-primary mb-1" />
              <CardTitle className="text-lg">IDE de textos</CardTitle>
              <CardDescription>
                Editor rico, PDF, vista previa y pistas de formato pensadas para trabajar el documento como pieza
                central — local, colaborativa (Etherpad) o en equipo según tu despliegue.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Sparkles className="h-8 w-8 text-primary mb-1" />
              <CardTitle className="text-lg">IA como guía continua</CardTitle>
              <CardDescription>
                Análisis estructurado, sugerencias de redacción y recordatorios de rigor (metodología o cumplimiento)
                mientras escribes; siempre con control de privacidad y con la opción de traer vuestra propia API.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex gap-2 mb-1">
                <FlaskConical className="h-8 w-8 text-primary" />
                <Scale className="h-8 w-8 text-primary opacity-90" />
              </div>
              <CardTitle className="text-lg">Investigación y legal</CardTitle>
              <CardDescription>
                Perfiles distintos para el mismo hábito: detectar fallas metodológicas o riesgos contractuales, preparar
                preguntas para un asesor y dejar constancia de lo que ya revisaste en el propio flujo de trabajo.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Shield className="h-8 w-8 text-primary mb-1" />
              <CardTitle className="text-lg">Procedencia y firma</CardTitle>
              <CardDescription>
                Wallet Substrate en tu dispositivo para dar autenticidad verificable a lo que firmas; desbloqueo
                explícito y trazabilidad alineada con la idea de “saber qué estás sellando”.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="sm:col-span-2">
            <CardHeader className="pb-2">
              <Users className="h-8 w-8 text-primary mb-1" />
              <CardTitle className="text-lg">Organizaciones y especialistas</CardTitle>
              <CardDescription>
                Cuentas personales o de equipo, sesión de plataforma cuando uséis el modo SaaS, y los mismos ciclos de
                borrador → revisión → firma tanto si sois un grupo de investigación como un despacho que itera contratos
                en paralelo.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <ProductPlansPreview />

        <Card className="border-dashed bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">Información legal</CardTitle>
            <CardDescription>
              Textos en revisión; conviene validarlos con asesoría antes de producción.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="secondary" size="sm" asChild>
              <Link to="/legal/terminos">Términos y condiciones</Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/legal/privacidad">Aviso de privacidad</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </PublicPageShell>
  )
}
