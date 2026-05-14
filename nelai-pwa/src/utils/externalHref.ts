/**
 * Normaliza `href` de markdown/HTML para abrir recursos externos en otra pestaña
 * sin resolverlos contra el origen de la PWA (localhost).
 */
const TRAILING_IN_URL = /[),.;:!?*}\]'"»]+$/u

function trimUrlLike(raw: string): string {
  let u = raw.trim()
  while (TRAILING_IN_URL.test(u)) {
    u = u.replace(TRAILING_IN_URL, '')
  }
  return u
}

/** `www.` / `doi.org` / hostname tipo `journals.foo.com/bar` sin esquema → https */
export function absoluteHttpUrlFromLooseTarget(raw: string | undefined | null): string | null {
  if (raw == null || typeof raw !== 'string') return null
  let t = trimUrlLike(raw)
  if (!t || t.startsWith('mailto:') || t.startsWith('tel:') || t.startsWith('#')) return null
  if (t.startsWith('data:') || t.toLowerCase().startsWith('javascript:')) return null
  if (t.startsWith('http://') || t.startsWith('https://')) return t
  if (t.startsWith('//')) return `https:${t}`
  if (/^(?:dx\.)?doi\.org\//i.test(t)) {
    t = t.replace(/^dx\.doi\.org\//i, 'doi.org/')
    return `https://${t}`
  }
  if (/^www\./i.test(t)) return `https://${t}`
  if (/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)+\.[a-z]{2,}(?:\/|$)/i.test(t)) {
    return `https://${t.replace(/^\/+/, '')}`
  }
  return null
}

export function normalizeUserFacingHref(href: string | undefined | null): string {
  const abs = absoluteHttpUrlFromLooseTarget(href)
  if (abs) return abs
  if (href == null || typeof href !== 'string') return '#'
  let h = href.trim()
  if (!h || h === '#') return '#'
  const lower = h.toLowerCase()
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return '#'
  }
  if (lower.startsWith('mailto:') || lower.startsWith('tel:') || lower.startsWith('sms:')) return h
  if (h.startsWith('/') && /^\/+https?:\/\//i.test(h)) {
    return h.replace(/^\/+/, '')
  }
  return h
}
