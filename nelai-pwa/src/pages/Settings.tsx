import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Edit, Trash2, Save, ExternalLink, Key, Globe, Shield, Bot, Check, UserX } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useWorkspaceSession } from '@/contexts/useWorkspaceSession'
import { deleteWorkspaceAccount } from '@/services/workspace/workspaceAuthApi'
import { useNetwork } from '@/contexts/NetworkContext'
import { useActiveAccount } from '@/contexts/ActiveAccountContext'
import { NetworkSwitcher } from '@/components/NetworkSwitcher'
import { DkgNetworkSwitcher } from '@/components/DkgNetworkSwitcher'
import { WebAuthnCredentialsManager } from '@/components/WebAuthnCredentialsManager'
import { DatabaseManager } from '@/components/DatabaseManager'
import { BackupManager } from '@/components/BackupManager'
import {
  getAllLLMConfigs,
  saveLLMConfig,
  deleteLLMConfig,
  setActiveLLMConfig,
  getDefaultEndpoint,
  type LLMApiConfig,
  type LLMProvider,
} from '@/config/llmConfig'
import { hasWorkspaceApiBase, llmProxyUsesServerKey } from '@/config/saasConfig'
import { isSaaSWorkspaceMode } from '@/config/appMode'
import { LlmUsageCard } from '@/components/workspace/LlmUsageCard'
import { CRITERIA_STORAGE, LEGACY_NELAI_STORAGE } from '@/constants/storageKeys'
import {
  createCheckout,
  fetchBillingPlans,
  fetchBillingStatus,
  openPortal,
  postBillingSync,
  type BillingPlanPublic,
  type BillingStatusResponse,
} from '@/services/billing/billingApi'
import { refreshSessionFromServer } from '@/services/workspace/refreshSessionFromServer'

interface ApiConfig {
  id: string
  name: string
  baseUrl: string
  apiKey?: string
  description?: string
  type: 'credential' | 'medical' | 'attestation' | 'other'
  enabled: boolean
  createdAt: number
  updatedAt: number
}

// Simulación de almacenamiento (temporal, hasta que se implemente la DB completa)
const API_CONFIGS_STORAGE_KEY = CRITERIA_STORAGE.apiConfigs
const LEGACY_API_CONFIGS_STORAGE_KEY = LEGACY_NELAI_STORAGE.apiConfigs

function useApiConfigsStorage() {
  const [configs, setConfigs] = useState<ApiConfig[]>([])

  useEffect(() => {
    const stored =
      localStorage.getItem(API_CONFIGS_STORAGE_KEY) ?? localStorage.getItem(LEGACY_API_CONFIGS_STORAGE_KEY)
    if (stored) {
      try {
        setConfigs(JSON.parse(stored))
        localStorage.setItem(API_CONFIGS_STORAGE_KEY, stored)
        localStorage.removeItem(LEGACY_API_CONFIGS_STORAGE_KEY)
      } catch (e) {
        console.error('Error loading API configs:', e)
      }
    }
  }, [])

  const saveConfigs = (newConfigs: ApiConfig[]) => {
    setConfigs(newConfigs)
    localStorage.setItem(API_CONFIGS_STORAGE_KEY, JSON.stringify(newConfigs))
  }

  const addConfig = (config: Omit<ApiConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newConfig: ApiConfig = {
      ...config,
      id: `api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const updated = [...configs, newConfig]
    saveConfigs(updated)
    return newConfig
  }

  const updateConfig = (id: string, updates: Partial<ApiConfig>) => {
    const updated = configs.map(c =>
      c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
    )
    saveConfigs(updated)
  }

  const deleteConfig = (id: string) => {
    const updated = configs.filter(c => c.id !== id)
    saveConfigs(updated)
  }

  return {
    configs,
    addConfig,
    updateConfig,
    deleteConfig,
  }
}

function LLMSettingsSection() {
  const [configs, setConfigs] = useState<LLMApiConfig[]>([])
  const [llmDialogOpen, setLlmDialogOpen] = useState(false)
  const [editingLlm, setEditingLlm] = useState<LLMApiConfig | null>(null)
  const [llmForm, setLlmForm] = useState({
    name: '',
    provider: 'openai' as LLMProvider,
    apiKey: '',
    endpoint: '',
    proxyUrl: '',
    model: '',
    isActive: false,
  })

  const loadConfigs = useCallback(async () => {
    const list = await getAllLLMConfigs()
    setConfigs(list)
  }, [])

  useEffect(() => {
    loadConfigs()
  }, [loadConfigs])

  const handleOpenLlmDialog = (config?: LLMApiConfig) => {
    if (config) {
      setEditingLlm(config)
      setLlmForm({
        name: config.name,
        provider: config.provider,
        apiKey: config.apiKey ?? '',
        endpoint: config.endpoint || getDefaultEndpoint(config.provider),
        proxyUrl: config.proxyUrl || '',
        model: config.model || '',
        isActive: config.isActive,
      })
    } else {
      setEditingLlm(null)
      setLlmForm({
        name: '',
        provider: 'openai',
        apiKey: '',
        endpoint: getDefaultEndpoint('openai'),
        proxyUrl: '',
        model: '',
        isActive: configs.length === 0,
      })
    }
    setLlmDialogOpen(true)
  }

  const handleCloseLlmDialog = () => {
    setLlmDialogOpen(false)
    setEditingLlm(null)
  }

  const handleSaveLlm = async (e: React.FormEvent) => {
    e.preventDefault()
    const mergedKey = (llmForm.apiKey.trim() || editingLlm?.apiKey || '').trim()
    const geminiProxySinClaveCliente =
      llmForm.provider === 'gemini' &&
      llmForm.proxyUrl.trim() &&
      llmProxyUsesServerKey() &&
      !mergedKey

    if (!llmForm.name.trim()) return
    if (!geminiProxySinClaveCliente && !mergedKey) return

    const cfg: LLMApiConfig = {
      id: editingLlm?.id ?? `llm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      provider: llmForm.provider,
      name: llmForm.name.trim(),
      apiKey: mergedKey || undefined,
      endpoint: llmForm.endpoint.trim() || undefined,
      proxyUrl: llmForm.proxyUrl.trim() || undefined,
      model: llmForm.model.trim() || undefined,
      isActive: llmForm.isActive,
      createdAt: editingLlm?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    }
    await saveLLMConfig(cfg)
    if (cfg.isActive) await setActiveLLMConfig(cfg.id)
    await loadConfigs()
    handleCloseLlmDialog()
  }

  const handleDeleteLlm = async (id: string) => {
    if (!confirm('¿Eliminar esta configuración de IA?')) return
    await deleteLLMConfig(id)
    await loadConfigs()
  }

  const handleSetActive = async (id: string) => {
    await setActiveLLMConfig(id)
    await loadConfigs()
  }

  const providerLabels: Record<LLMProvider, string> = {
    openai: 'OpenAI (GPT)',
    anthropic: 'Anthropic (Claude)',
    gemini: 'Google Gemini',
    custom: 'Custom',
  }

  return (
    <>
      <LlmUsageCard />
      {isSaaSWorkspaceMode() && llmProxyUsesServerKey() && hasWorkspaceApiBase() ? (
        <Alert className="mb-4 border-primary/30 bg-primary/5">
          <Bot className="h-4 w-4" />
          <AlertDescription>
            <strong className="text-foreground">Modo organización (sin BYOK):</strong> se crea el perfil «CriterIA
            (plataforma)» apuntando al proxy con tu sesión. La API key de Google la pone el superadmin en el panel de
            plataforma (o <code className="text-xs">GEMINI_API_KEY</code> en el servidor). No necesitas pegar clave
            aquí salvo que quieras usar la tuya (BYOK).
          </AlertDescription>
        </Alert>
      ) : null}
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              APIs de IA (LLM)
            </CardTitle>
            <CardDescription>
              Configura APIs para que el Agente Guía use IA en lugar de plantillas fijas
            </CardDescription>
          </div>
          <Dialog open={llmDialogOpen} onOpenChange={setLlmDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenLlmDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar API
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingLlm ? 'Editar API de IA' : 'Nueva API de IA'}</DialogTitle>
                <DialogDescription>
                  OpenAI, Anthropic o endpoint compatible. Las claves se guardan en este dispositivo salvo
                  el modo Gemini + proxy con clave solo en servidor (SaaS).
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSaveLlm} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input
                    value={llmForm.name}
                    onChange={(e) => setLlmForm({ ...llmForm, name: e.target.value })}
                    placeholder="Ej: Mi OpenAI"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Proveedor *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={llmForm.provider}
                    onChange={(e) => {
                      const p = e.target.value as LLMProvider
                      setLlmForm({
                        ...llmForm,
                        provider: p,
                        endpoint: getDefaultEndpoint(p),
                      })
                    }}
                  >
                    <option value="openai">OpenAI (GPT)</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>
                    API Key{' '}
                    {editingLlm
                      ? '(vacío = mantener anterior)'
                      : llmForm.provider === 'gemini' &&
                          llmForm.proxyUrl.trim() &&
                          llmProxyUsesServerKey()
                        ? '(opcional si usas sesión + GEMINI_API_KEY en servidor)'
                        : '*'}
                  </Label>
                  <Input
                    type="password"
                    value={llmForm.apiKey}
                    onChange={(e) => setLlmForm({ ...llmForm, apiKey: e.target.value })}
                    placeholder={editingLlm ? '••••••••' : 'sk-...'}
                    required={
                      !editingLlm &&
                      !(
                        llmForm.provider === 'gemini' &&
                        llmForm.proxyUrl.trim() &&
                        llmProxyUsesServerKey()
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Endpoint (opcional)</Label>
                  <Input
                    value={llmForm.endpoint}
                    onChange={(e) => setLlmForm({ ...llmForm, endpoint: e.target.value })}
                    placeholder={getDefaultEndpoint(llmForm.provider)}
                  />
                </div>
                {llmForm.provider === 'gemini' && (
                  <div className="space-y-2">
                    <Label>Proxy URL (para GitHub Pages / evita CORS)</Label>
                    <Input
                      value={llmForm.proxyUrl}
                      onChange={(e) => setLlmForm({ ...llmForm, proxyUrl: e.target.value })}
                      placeholder="https://tu-servidor.com/api/llm-proxy"
                    />
                    <p className="text-xs text-muted-foreground">
                      La API de Gemini no soporta CORS desde el navegador. Despliega el servidor (yarn c2pa-server) y pon aquí su URL + /api/llm-proxy
                    </p>
                    {llmProxyUsesServerKey() ? (
                      <p className="text-xs text-muted-foreground">
                        Con <code className="text-xs">VITE_LLM_PROXY_USES_SERVER_KEY=true</code> y sesión de
                        organización, puedes dejar la API key vacía si el servidor tiene{' '}
                        <code className="text-xs">GEMINI_API_KEY</code>.
                      </p>
                    ) : null}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Modelo (opcional)</Label>
                  <Input
                    value={llmForm.model}
                    onChange={(e) => setLlmForm({ ...llmForm, model: e.target.value })}
                    placeholder={
                      llmForm.provider === 'openai'
                        ? 'gpt-4o-mini'
                        : llmForm.provider === 'gemini'
                          ? 'gemini-2.5-flash'
                          : 'claude-3-5-haiku-20241022'
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="llm-active"
                    checked={llmForm.isActive}
                    onChange={(e) => setLlmForm({ ...llmForm, isActive: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="llm-active" className="cursor-pointer">Usar como activa</Label>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={handleCloseLlmDialog}>Cancelar</Button>
                  <Button type="submit"><Save className="mr-2 h-4 w-4" />Guardar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {configs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-4">No hay APIs de IA configuradas</p>
            <Button onClick={() => handleOpenLlmDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar primera API
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {configs.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{c.name}</h3>
                      {c.isActive && (
                        <Badge variant="default" className="gap-1">
                          <Check className="h-3 w-3" /> Activa
                        </Badge>
                      )}
                      <Badge variant="outline">{providerLabels[c.provider]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {c.endpoint || getDefaultEndpoint(c.provider)} • {c.model || 'default'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {!c.isActive && (
                    <Button variant="outline" size="sm" onClick={() => handleSetActive(c.id)}>
                      Activar
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleOpenLlmDialog(c)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDeleteLlm(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Alert className="mt-4">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Las API keys se almacenan solo en tu dispositivo. El Agente Guía las usa para generar
            explicaciones personalizadas antes de acciones sensibles (emergencias, publicar en DKG, etc.).
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
    </>
  )
}

function formatUsd(n: number | null): string {
  if (n == null) return '—'
  if (n === 0) return '0'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatBillingIsoDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(iso))
  } catch {
    return '—'
  }
}

function formatLlmTokensLine(tokens: number, tokenPeriod: 'month' | 'fortnight'): string {
  const periodLabel = tokenPeriod === 'fortnight' ? 'quincena' : 'mes'
  if (tokens === 0) return `Tokens de IA incluidos: sin tope en catálogo / ${periodLabel}`
  if (tokens >= 1_000_000) {
    return `Tokens de IA incluidos: ~${(tokens / 1_000_000).toFixed(1)}M / ${periodLabel}`
  }
  return `Tokens de IA incluidos: ${(tokens / 1_000).toFixed(0)}k / ${periodLabel}`
}

function formatSeatsLine(maxUsersPerOrg: number): string {
  if (maxUsersPerOrg === 0) return 'Asientos (usuarios): sin tope en catálogo'
  return `Asientos (usuarios): hasta ${maxUsersPerOrg}`
}

function PlanCheckoutCard({
  plan,
  loading,
  samePlanLocked,
  onCheckout,
}: {
  plan: BillingPlanPublic
  loading: boolean
  /** Suscripción activa del mismo tier: evitar doble checkout en el mismo periodo. */
  samePlanLocked: boolean
  onCheckout: (id: 'starter' | 'pro' | 'enterprise') => void
}) {
  const periodLabel = plan.tokenPeriod === 'fortnight' ? 'quincena' : 'mes'
  const price =
    plan.monthlyPriceUsd != null
      ? `${formatUsd(plan.monthlyPriceUsd)}/mes`
      : '—'
  const tokenCap =
    plan.monthlyLlmTokens === 0
      ? 'IA sin tope (plan)'
      : plan.monthlyLlmTokens >= 1_000_000
        ? `~${(plan.monthlyLlmTokens / 1_000_000).toFixed(1)}M tokens IA/${periodLabel}`
        : `${(plan.monthlyLlmTokens / 1_000).toFixed(0)}k tokens IA/${periodLabel}`
  const usersCap = plan.maxUsersPerOrg === 0 ? 'Usuarios: sin tope' : `Usuarios: hasta ${plan.maxUsersPerOrg}`

  return (
    <div className="rounded-lg border p-3 space-y-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{plan.label}</div>
          <div className="text-muted-foreground">{price}</div>
        </div>
        {plan.id !== 'trial' && (
          <Button
            size="sm"
            variant={plan.id === 'starter' ? 'default' : plan.id === 'pro' ? 'secondary' : 'outline'}
            disabled={loading || !plan.stripeCheckoutAvailable || samePlanLocked}
            title={
              samePlanLocked
                ? 'Ya tienes este plan activo; usa «Administrar en Stripe» para cambios.'
                : !plan.stripeCheckoutAvailable
                  ? `Configura STRIPE_PRICE_${plan.id.toUpperCase()} en el servidor`
                  : undefined
            }
            onClick={() => onCheckout(plan.id as 'starter' | 'pro' | 'enterprise')}
          >
            {samePlanLocked
              ? 'Plan activo'
              : plan.stripeCheckoutAvailable
                ? 'Checkout'
                : 'Sin precio Stripe'}
          </Button>
        )}
      </div>
      <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
        <li>{usersCap}</li>
        <li>{tokenCap}</li>
      </ul>
    </div>
  )
}

function BillingSection() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { applySession } = useWorkspaceSession()
  const [loading, setLoading] = useState(false)
  const [plansLoading, setPlansLoading] = useState(true)
  const [plans, setPlans] = useState<BillingPlanPublic[] | null>(null)
  const [plansErr, setPlansErr] = useState<string | null>(null)
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null)
  const [billingSnap, setBillingSnap] = useState<BillingStatusResponse | null>(null)

  const billingReturn = searchParams.get('billing')

  /** Reconciliar al abrir Facturación (webhook retrasado o STRIPE_SUCCESS_URL sin ?billing=success). */
  useEffect(() => {
    if (!isSaaSWorkspaceMode() || !hasWorkspaceApiBase()) return
    let cancelled = false
    ;(async () => {
      try {
        await postBillingSync()
        const next = await refreshSessionFromServer()
        if (!cancelled && next) applySession(next)
        try {
          const p = await fetchBillingPlans()
          if (!cancelled) setPlans(p.plans)
        } catch {
          /* ignore */
        }
        try {
          const st = await fetchBillingStatus()
          if (!cancelled) setBillingSnap(st)
        } catch {
          /* ignore */
        }
      } catch {
        /* sin customer en Stripe aún */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applySession])

  useEffect(() => {
    if (!isSaaSWorkspaceMode() || !hasWorkspaceApiBase()) return
    if (!billingReturn) return
    if (billingReturn === 'cancel') {
      navigate('/settings', { replace: true })
      return
    }
    if (billingReturn !== 'success') return

    let cancelled = false
    ;(async () => {
      for (let i = 0; i < 10; i++) {
        if (cancelled) return
        try {
          await postBillingSync()
        } catch {
          // Webhook o Stripe pueden ir unos segundos por detrás del redirect.
        }
        const next = await refreshSessionFromServer()
        if (next) applySession(next)
        const paid =
          next && ['starter', 'pro', 'enterprise'].includes(next.organization.plan.toLowerCase())
        if (paid && next) {
          setCheckoutNotice(
            `Plan activo: ${next.organization.plan}. El cupo de tokens de IA del periodo se aplica según este plan (véase «Uso de IA»).`,
          )
          try {
            const p = await fetchBillingPlans()
            if (!cancelled) setPlans(p.plans)
          } catch {
            /* ignore */
          }
          try {
            const st = await fetchBillingStatus()
            if (!cancelled) setBillingSnap(st)
          } catch {
            /* ignore */
          }
          break
        }
        await new Promise((r) => setTimeout(r, 900))
      }
      if (!cancelled) navigate('/settings', { replace: true })
    })()
    return () => {
      cancelled = true
    }
  }, [billingReturn, navigate, applySession])

  useEffect(() => {
    if (!isSaaSWorkspaceMode() || !hasWorkspaceApiBase()) return
    let cancel = false
    ;(async () => {
      try {
        const p = await fetchBillingPlans()
        if (!cancel) setPlans(p.plans)
      } catch (e) {
        if (!cancel) setPlansErr(e instanceof Error ? e.message : 'No se pudo cargar el catálogo de planes')
      } finally {
        if (!cancel) setPlansLoading(false)
      }
      try {
        const st = await fetchBillingStatus()
        if (!cancel) setBillingSnap(st)
      } catch {
        /* sin sesión o endpoint antiguo */
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  const runCheckout = async (id: 'starter' | 'pro' | 'enterprise') => {
    try {
      setLoading(true)
      const { url } = await createCheckout(id)
      window.location.href = url
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo iniciar checkout')
    } finally {
      setLoading(false)
    }
  }

  if (!isSaaSWorkspaceMode() || !hasWorkspaceApiBase()) {
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Facturación</CardTitle>
          <CardDescription>Disponible solo en modo organización (SaaS).</CardDescription>
        </CardHeader>
      </Card>
    )
  }
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Facturación (Stripe)</CardTitle>
        <CardDescription>Planes por organización; el cobro recurrente lo define el Price en Stripe.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {checkoutNotice ? (
          <Alert>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>{checkoutNotice}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setCheckoutNotice(null)}>
                Cerrar
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        {billingSnap ? (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2">
            <div>
              <div className="font-semibold">Tu plan</div>
              <div className="text-muted-foreground">{billingSnap.billing.planLabel}</div>
              {billingSnap.billing.stripeSubscriptionStatus ? (
                <div className="text-xs text-muted-foreground mt-0.5">
                  Estado en Stripe: {billingSnap.billing.stripeSubscriptionStatus}
                </div>
              ) : null}
            </div>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              <li>{formatLlmTokensLine(billingSnap.billing.llmTokensPerPeriod, billingSnap.billing.tokenPeriod)}</li>
              <li>{formatSeatsLine(billingSnap.billing.maxUsersPerOrg)}</li>
              <li>
                Próxima fecha de facturación (fin del periodo actual, UTC):{' '}
                <span className="text-foreground">{formatBillingIsoDate(billingSnap.billing.stripeCurrentPeriodEnd)}</span>
              </li>
            </ul>
          </div>
        ) : null}
        {plansErr ? (
          <Alert variant="destructive">
            <AlertDescription>{plansErr}</AlertDescription>
          </Alert>
        ) : null}
        {plansLoading ? (
          <p className="text-sm text-muted-foreground">Cargando planes…</p>
        ) : plans && plans.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {plans.map((p) => (
              <PlanCheckoutCard
                key={p.id}
                plan={p}
                loading={loading}
                samePlanLocked={Boolean(
                  billingSnap?.billing.lockedCheckoutPlanId &&
                    billingSnap.billing.lockedCheckoutPlanId === p.id,
                )}
                onCheckout={runCheckout}
              />
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={loading}
            onClick={async () => {
              try {
                setLoading(true)
                const { url } = await openPortal()
                window.location.href = url
              } catch (e) {
                alert(e instanceof Error ? e.message : 'No se pudo abrir el portal')
              } finally {
                setLoading(false)
              }
            }}
          >
            Administrar en Stripe
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          Moneda de referencia USD; para MXN crea Prices en MXN en Stripe y enlázalos con las mismas variables
          <code className="mx-1">STRIPE_PRICE_*</code>. Add-ons (tokens extra, usuarios extra) se modelan como Prices
          adicionales o líneas de factura — el catálogo en servidor documenta montos orientativos.
        </div>
        <div className="text-xs text-muted-foreground">
          Nota: en modo test, Stripe te dará tarjetas de prueba. En modo live, configura el webhook
          <code className="mx-1">/api/billing/webhook</code>.
        </div>
      </CardContent>
    </Card>
  )
}

function DeleteAccountSection() {
  const navigate = useNavigate()
  const { session, signOut } = useWorkspaceSession()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPhrase, setConfirmPhrase] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isSaaSWorkspaceMode() || !hasWorkspaceApiBase() || !session) {
    return null
  }

  const canSubmit = confirmPhrase.trim().toUpperCase() === 'ELIMINAR'

  const handleDelete = async () => {
    if (!canSubmit) return
    setError('')
    setLoading(true)
    try {
      await deleteWorkspaceAccount(session.accessToken, password.trim() || undefined)
      signOut()
      setOpen(false)
      navigate('/login', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la cuenta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <UserX className="h-5 w-5" />
          Zona de peligro
        </CardTitle>
        <CardDescription>
          Eliminar tu cuenta borra tu usuario y, si eres el único miembro, toda la organización (documentos
          del tenant en servidor, claves API, historial de uso asociado). No afecta datos solo locales del
          dispositivo (keyring, backups). Si tienes suscripción en Stripe, cancélala antes desde Facturación →
          Administrar en Stripe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setPassword(''); setConfirmPhrase(''); setError('') } }}>
          <DialogTrigger asChild>
            <Button type="button" variant="destructive">
              Eliminar mi cuenta de la plataforma
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>¿Eliminar cuenta permanentemente?</DialogTitle>
              <DialogDescription className="space-y-2">
                <span className="block">
                  Esta acción no se puede deshacer. Escribe <strong className="text-foreground">ELIMINAR</strong>{' '}
                  para confirmar.
                </span>
                <span className="block text-xs">
                  Si iniciaste sesión con correo y contraseña, escribe también tu contraseña. Si solo usas
                  Google, deja la contraseña vacía.
                </span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <Label htmlFor="delete-confirm">Confirmación</Label>
                <Input
                  id="delete-confirm"
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  placeholder="ELIMINAR"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delete-password">Contraseña (si aplica)</Label>
                <Input
                  id="delete-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!canSubmit || loading}
                onClick={() => void handleDelete()}
              >
                {loading ? 'Eliminando…' : 'Eliminar definitivamente'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

function NetworkSwitcherInSettings() {
  const { selectedChain, setSelectedChain, isConnecting } = useNetwork()
  const { activeAccount } = useActiveAccount()
  return (
    <NetworkSwitcher
      selectedChain={selectedChain}
      onSelectChain={setSelectedChain}
      isConnecting={isConnecting}
      activeAccountAddress={activeAccount}
    />
  )
}

export default function Settings() {
  const { configs, addConfig, updateConfig, deleteConfig } = useApiConfigsStorage()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<ApiConfig | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    baseUrl: '',
    apiKey: '',
    description: '',
    type: 'credential' as ApiConfig['type'],
    enabled: true,
  })

  const handleOpenDialog = (config?: ApiConfig) => {
    if (config) {
      setEditingConfig(config)
      setFormData({
        name: config.name,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey || '',
        description: config.description || '',
        type: config.type,
        enabled: config.enabled,
      })
    } else {
      setEditingConfig(null)
      setFormData({
        name: '',
        baseUrl: '',
        apiKey: '',
        description: '',
        type: 'credential',
        enabled: true,
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingConfig(null)
    setFormData({
      name: '',
      baseUrl: '',
      apiKey: '',
      description: '',
      type: 'credential',
      enabled: true,
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim() || !formData.baseUrl.trim()) {
      return
    }

    if (editingConfig) {
      updateConfig(editingConfig.id, {
        name: formData.name.trim(),
        baseUrl: formData.baseUrl.trim(),
        apiKey: formData.apiKey.trim() || undefined,
        description: formData.description.trim() || undefined,
        type: formData.type,
        enabled: formData.enabled,
      })
    } else {
      addConfig({
        name: formData.name.trim(),
        baseUrl: formData.baseUrl.trim(),
        apiKey: formData.apiKey.trim() || undefined,
        description: formData.description.trim() || undefined,
        type: formData.type,
        enabled: formData.enabled,
      })
    }

    handleCloseDialog()
  }

  const getTypeLabel = (type: ApiConfig['type']) => {
    const labels = {
      credential: 'Credenciales',
      medical: 'Registro Médico',
      attestation: 'Atestación',
      other: 'Otro',
    }
    return labels[type]
  }

  const getTypeIcon = (type: ApiConfig['type']) => {
    switch (type) {
      case 'credential':
        return <Key className="h-4 w-4" />
      case 'medical':
        return <Shield className="h-4 w-4" />
      case 'attestation':
        return <Globe className="h-4 w-4" />
      default:
        return <ExternalLink className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-muted-foreground mt-2">
          Gestiona la configuración de CriterIA
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="apis">APIs Externas</TabsTrigger>
          <TabsTrigger value="llm">IA (LLM)</TabsTrigger>
          <TabsTrigger value="security">Seguridad</TabsTrigger>
        </TabsList>

        {/* APIs Externas */}
        <TabsContent value="apis" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>APIs Externas</CardTitle>
                  <CardDescription>
                    Configura las APIs para conectarte con servicios externos de credenciales,
                    registros médicos y atestaciones
                  </CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => handleOpenDialog()}>
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar API
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto mx-4 sm:mx-0">
                    <DialogHeader>
                      <DialogTitle>
                        {editingConfig ? 'Editar API' : 'Nueva API'}
                      </DialogTitle>
                      <DialogDescription>
                        {editingConfig
                          ? 'Modifica la configuración de la API'
                          : 'Agrega una nueva API externa para interactuar con servicios de credenciales, registros médicos o atestaciones'}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nombre *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Nombre del servicio"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="baseUrl">URL Base *</Label>
                        <Input
                          id="baseUrl"
                          type="url"
                          value={formData.baseUrl}
                          onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                          placeholder="https://api.example.com"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="apiKey">API Key (Opcional)</Label>
                        <Input
                          id="apiKey"
                          type="password"
                          value={formData.apiKey}
                          onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                          placeholder="Tu API key"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="type">Tipo de API *</Label>
                        <select
                          id="type"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={formData.type}
                          onChange={(e) => setFormData({ ...formData, type: e.target.value as ApiConfig['type'] })}
                          required
                        >
                          <option value="credential">Credenciales</option>
                          <option value="medical">Registro Médico</option>
                          <option value="attestation">Atestación</option>
                          <option value="other">Otro</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Descripción (Opcional)</Label>
                        <Input
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Descripción del servicio"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="enabled"
                          checked={formData.enabled}
                          onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="enabled" className="cursor-pointer">
                          Habilitado
                        </Label>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button type="button" variant="outline" onClick={handleCloseDialog}>
                          Cancelar
                        </Button>
                        <Button type="submit">
                          <Save className="mr-2 h-4 w-4" />
                          {editingConfig ? 'Guardar Cambios' : 'Agregar API'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {configs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="mb-4">No hay APIs configuradas aún</p>
                  <Button onClick={() => handleOpenDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Primera API
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {configs.map((config) => (
                    <div
                      key={config.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {getTypeIcon(config.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">{config.name}</h3>
                            <Badge variant={config.enabled ? 'default' : 'secondary'}>
                              {config.enabled ? 'Habilitado' : 'Deshabilitado'}
                            </Badge>
                            <Badge variant="outline">{getTypeLabel(config.type)}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {config.baseUrl}
                          </p>
                          {config.description && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {config.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(config)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm('¿Estás seguro de eliminar esta API?')) {
                              deleteConfig(config.id)
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Seguridad:</strong> Las API keys se almacenan localmente en tu dispositivo
              y nunca se comparten con terceros. Asegúrate de usar conexiones HTTPS para todas las APIs.
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* IA (LLM) */}
        <TabsContent value="llm" className="space-y-4">
          <BillingSection />
          <LLMSettingsSection />
        </TabsContent>

        {/* General */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Red Substrate</CardTitle>
              <CardDescription>
                Selecciona la red blockchain para transacciones y consultas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NetworkSwitcherInSettings />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Red DKG (CriterIA)</CardTitle>
              <CardDescription>
                Red OriginTrail para publicar y consultar evidencias. Usa clave EVM derivada de tu cuenta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DkgNetworkSwitcher />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Configuración General</CardTitle>
              <CardDescription>
                Ajustes generales de la aplicación
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Idioma</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Moneda de Visualización</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="DOT">DOT</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Seguridad */}
        <TabsContent value="security" className="space-y-4">
          <WebAuthnCredentialsManager />

          <Card data-section="backup">
            <CardHeader>
              <CardTitle>Backup e Importación</CardTitle>
              <CardDescription>
                Exporta o importa todos tus datos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <BackupManager />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Datos y Almacenamiento</CardTitle>
              <CardDescription>
                Gestiona los datos almacenados localmente en tu dispositivo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DatabaseManager />
            </CardContent>
          </Card>

          <DeleteAccountSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}
