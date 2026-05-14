import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useWorkspaceSession } from '@/contexts/useWorkspaceSession'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { hasWorkspaceApiBase } from '@/config/saasConfig'
import { fetchBillingPlans, fetchBillingStatus } from '@/services/billing/billingApi'
import { createOrgInvite, fetchOrgMembers, removeOrgMember, type OrgMemberRow } from '@/services/workspace/orgInviteApi'
import { refreshSessionFromServer } from '@/services/workspace/refreshSessionFromServer'

/** Alinear con `normalizeBillingPlanId` del servidor para buscar en el catálogo público. */
function normalizePlanIdForCatalog(plan: string): string {
  const p = String(plan || 'trial')
    .trim()
    .toLowerCase()
  if (p === 'starter' || p === 'pro' || p === 'enterprise' || p === 'trial') return p
  return 'trial'
}

/** Mismo cupo que `server/billing/planCatalog.ts` (asientos por org). Sirve para la UI antes de que responda el API. */
function planMaxUsersFromCatalog(plan: string): number {
  switch (normalizePlanIdForCatalog(plan)) {
    case 'trial':
      return 1
    case 'starter':
      return 5
    case 'pro':
      return 20
    case 'enterprise':
      return 0
    default:
      return 1
  }
}

function orgRoleLabel(role: string): string {
  const r = String(role || '').toLowerCase()
  if (r === 'owner') return 'Propietario'
  if (r === 'admin') return 'Administrador'
  return 'Miembro'
}

function formatTokensBrief(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString('es-ES')
}

export default function WorkspaceOrganization() {
  const { session, applySession } = useWorkspaceSession()
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inviteExpires, setInviteExpires] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteErr, setInviteErr] = useState<string | null>(null)
  const [planMaxUsers, setPlanMaxUsers] = useState<number | null>(null)
  const [planCapLoading, setPlanCapLoading] = useState(true)
  const [members, setMembers] = useState<OrgMemberRow[]>([])
  const [unattributedLlmTokensThisPeriod, setUnattributedLlmTokensThisPeriod] = useState(0)
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersErr, setMembersErr] = useState<string | null>(null)
  const [expelTarget, setExpelTarget] = useState<OrgMemberRow | null>(null)
  const [expelErr, setExpelErr] = useState('')
  const [expelLoading, setExpelLoading] = useState(false)

  useEffect(() => {
    if (!session || !hasWorkspaceApiBase()) {
      setPlanCapLoading(false)
      setPlanMaxUsers(null)
      return
    }
    let cancelled = false
    setPlanCapLoading(true)
    ;(async () => {
      let planForFallback = session.organization.plan
      try {
        const next = await refreshSessionFromServer()
        if (!cancelled && next) {
          applySession(next)
          planForFallback = next.organization.plan
        }
      } catch {
        /* sin red o token inválido */
      }
      try {
        const st = await fetchBillingStatus()
        if (!cancelled) setPlanMaxUsers(st.billing.maxUsersPerOrg)
      } catch {
        try {
          const pid = normalizePlanIdForCatalog(planForFallback)
          const p = await fetchBillingPlans()
          const pl = p.plans.find((x) => x.id === pid)
          if (!cancelled) setPlanMaxUsers(pl?.maxUsersPerOrg ?? null)
        } catch {
          if (!cancelled) setPlanMaxUsers(null)
        }
      } finally {
        if (!cancelled) setPlanCapLoading(false)
      }
    })()
    return () => {
      cancelled = true
      setPlanCapLoading(false)
    }
  }, [session?.organization.id, session?.organization.plan, applySession])

  useEffect(() => {
    if (!session || !hasWorkspaceApiBase()) {
      setMembers([])
      setUnattributedLlmTokensThisPeriod(0)
      setMembersErr(null)
      return
    }
    let cancel = false
    setMembersLoading(true)
    setMembersErr(null)
    fetchOrgMembers()
      .then((res) => {
        if (!cancel) {
          setMembers(res.members)
          setUnattributedLlmTokensThisPeriod(res.unattributedLlmTokensThisPeriod)
        }
      })
      .catch((e) => {
        if (!cancel) setMembersErr(e instanceof Error ? e.message : 'No se pudieron cargar los miembros')
      })
      .finally(() => {
        if (!cancel) setMembersLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [session?.organization.id])

  if (!session) return null

  const catalogCap = planMaxUsersFromCatalog(session.organization.plan)
  const effectiveMaxUsers = planMaxUsers ?? catalogCap
  const allowInvitesByPlan = effectiveMaxUsers === 0 || effectiveMaxUsers > 1

  const orgRole = String(session.user.orgRole || '')
    .trim()
    .toLowerCase()
  const isAdminish = orgRole === 'owner' || orgRole === 'admin'
  const canInvite = hasWorkspaceApiBase() && allowInvitesByPlan && isAdminish

  const runCreateInvite = async () => {
    setInviteErr(null)
    setInviteLoading(true)
    try {
      const { joinUrl, expiresAt } = await createOrgInvite()
      setInviteUrl(joinUrl)
      setInviteExpires(expiresAt)
    } catch (e) {
      setInviteErr(e instanceof Error ? e.message : 'No se pudo crear la invitación')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleConfirmExpel = async () => {
    if (!expelTarget) return
    setExpelErr('')
    setExpelLoading(true)
    try {
      await removeOrgMember(expelTarget.id)
      setMembers((prev) => prev.filter((x) => x.id !== expelTarget.id))
      setExpelTarget(null)
    } catch (e) {
      setExpelErr(e instanceof Error ? e.message : 'No se pudo expulsar al miembro')
    } finally {
      setExpelLoading(false)
    }
  }

  const canExpelMember = (m: OrgMemberRow) => {
    if (!isAdminish) return false
    if (m.id === session.user.id) return false
    const mr = String(m.orgRole).toLowerCase()
    if (mr === 'owner') return false
    if (orgRole === 'admin' && mr === 'admin') return false
    return true
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="sr-only">
        Organización: {session.organization.name}
      </h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold leading-tight">{session.organization.name}</CardTitle>
          <CardDescription>Identificador interno: {session.organization.id}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Plan</span>
            <Badge variant="secondary">{session.organization.plan}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Cuenta</span>
            <Badge variant="outline">
              {session.organization.kind === 'personal' ? 'Personal (B2C)' : 'Equipo (B2B)'}
            </Badge>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">Rol en org</span>
            <Badge variant="outline">{session.user.orgRole}</Badge>
            {session.user.platformRole === 'superadmin' ? (
              <Badge>Plataforma: superadmin</Badge>
            ) : null}
          </div>
          <div>
            <p className="text-muted-foreground">Tu usuario</p>
            <p className="font-medium">{session.user.displayName}</p>
            <p className="text-muted-foreground">{session.user.email}</p>
          </div>
        </CardContent>
      </Card>

      {hasWorkspaceApiBase() ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Miembros</CardTitle>
            <CardDescription>
              Quién tiene acceso a esta organización. Al expulsar a alguien, su cuenta pasa a una organización personal
              nueva en periodo de prueba (no guardamos un «plan anterior»; tampoco se transfiere la suscripción de
              Stripe de tu equipo a esa persona). Los tokens de IA por persona usan la misma ventana de periodo que el
              resumen de uso de la plataforma (mes, quincena de prueba o ciclo de Stripe según tu plan).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {membersLoading ? <p className="text-sm text-muted-foreground">Cargando miembros…</p> : null}
            {membersErr ? <p className="text-sm text-destructive">{membersErr}</p> : null}
            {!membersLoading && !membersErr && members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No se encontraron miembros para esta organización.</p>
            ) : null}
            {!membersLoading && !membersErr && members.length > 0 ? (
              <ul className="divide-y rounded-md border text-sm">
                {members.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{m.displayName || m.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      <Badge variant="outline" className="mt-1.5">
                        {orgRoleLabel(m.orgRole)}
                      </Badge>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
                      <div className="text-right text-xs sm:text-sm">
                        <p className="text-muted-foreground">Tokens IA</p>
                        <p className="font-medium tabular-nums">
                          {formatTokensBrief(m.llmTokensThisPeriod ?? 0)}
                        </p>
                      </div>
                      {canExpelMember(m) ? (
                        <Button type="button" variant="destructive" size="sm" onClick={() => setExpelTarget(m)}>
                          Expulsar
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            {!membersLoading && !membersErr && unattributedLlmTokensThisPeriod > 0 ? (
              <p className="text-xs text-muted-foreground">
                Además hay{' '}
                <span className="tabular-nums font-medium text-foreground">
                  {formatTokensBrief(unattributedLlmTokensThisPeriod)}
                </span>{' '}
                tokens de IA sin usuario asignado en este periodo (registros antiguos o llamadas sin sesión).
              </p>
            ) : null}
            {!isAdminish ? (
              <p className="text-xs text-muted-foreground">Solo propietario o administrador puede expulsar miembros.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <AlertDialog
        open={expelTarget !== null}
        onOpenChange={(open) => {
          if (!open && !expelLoading) {
            setExpelTarget(null)
            setExpelErr('')
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Expulsar a este miembro?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <span className="text-foreground font-medium">{expelTarget?.email}</span> dejará de pertenecer a{' '}
                  <span className="text-foreground font-medium">{session.organization.name}</span>.
                </p>
                <p>
                  Tendrá su propia organización en plan de prueba y deberá volver a iniciar sesión. Las claves API del
                  equipo siguen en esta organización.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {expelErr ? <p className="text-sm text-destructive">{expelErr}</p> : null}
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={expelLoading}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={expelLoading}
              onClick={() => void handleConfirmExpel()}
            >
              {expelLoading ? 'Expulsando…' : 'Expulsar'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canInvite ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invitar personas</CardTitle>
            <CardDescription>
              Cuenta {session.organization.kind === 'personal' ? 'personal' : 'de equipo'}: puedes compartir el
              espacio con otras personas sin tratarlo como “empresa”. El enlace es de un solo uso (7 días); quien se
              registre entra como <strong>miembro</strong>, dentro del cupo de usuarios de tu plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {inviteErr ? <p className="text-sm text-destructive">{inviteErr}</p> : null}
            <Button type="button" onClick={runCreateInvite} disabled={inviteLoading}>
              {inviteLoading ? 'Generando…' : 'Generar enlace de invitación'}
            </Button>
            {inviteUrl ? (
              <div className="space-y-2 pt-1">
                <Label htmlFor="invite-url">Enlace (compártelo por un canal seguro)</Label>
                <div className="flex gap-2">
                  <Input id="invite-url" readOnly value={inviteUrl} className="font-mono text-xs" />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      void navigator.clipboard.writeText(inviteUrl)
                    }}
                  >
                    Copiar
                  </Button>
                </div>
                {inviteExpires ? (
                  <p className="text-xs text-muted-foreground">
                    Caduca: {new Date(inviteExpires).toLocaleString('es-ES')}
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {!canInvite && hasWorkspaceApiBase() && isAdminish && !planCapLoading && planMaxUsers === null && effectiveMaxUsers <= 1 ? (
        <p className="text-sm text-muted-foreground rounded-md border border-border p-3">
          No se pudo confirmar el cupo en el servidor; puedes intentar generar la invitación igualmente. Si falla,
          recarga la página o revisa la conexión con el API.
        </p>
      ) : null}

      {!canInvite && hasWorkspaceApiBase() && isAdminish && !planCapLoading && planMaxUsers !== null && !allowInvitesByPlan ? (
        <p className="text-sm text-muted-foreground rounded-md border border-border p-3">
          Tu plan actual solo contempla <strong>un usuario</strong> en esta organización. Para invitar a otras
          personas (también en cuenta personal), contrata un plan con más asientos (por ejemplo Starter).
        </p>
      ) : null}

      {!canInvite && hasWorkspaceApiBase() && !isAdminish ? (
        <p className="text-sm text-muted-foreground">
          Solo el propietario o un administrador puede generar invitaciones.
        </p>
      ) : null}
    </div>
  )
}
