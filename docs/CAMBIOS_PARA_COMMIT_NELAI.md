# Cambios realizados para commit Nelai

Resumen de los cambios aplicados, listos para commit en un nuevo repositorio.

---

## 1. Orquestador y Agente Guía

### Archivos nuevos
- `src/config/guideAgent.ts` — Configuración del Agente Guía
- `src/config/guideAgentTemplates.ts` — Plantillas por tipo de acción
- `src/services/nelai/guideAgent.ts` — Servicio getGuideContent
- `src/services/nelai/agentOrchestrator.ts` — Orquestador (getAgentForContext)
- `src/components/nelai/GuideModal.tsx` — Modal reutilizable
- `src/hooks/useGuideAgent.ts` — Hook triggerGuide, acknowledge

### Integración
- **ImageGallery:** Al hacer clic en "Proteger en DKG", se muestra el modal del Agente Guía antes de continuar (si no se ha descartado).

---

## 2. Branding: Federación de Andinismo → Nelai

### Eliminado
- "Federación de Andinismo de Chile" en Onboarding y Unlock

### Renombrado a Nelai
- Onboarding, Unlock, Header, Settings, Home, App
- index.html (title, meta description, theme-color)
- site.webmanifest, vite.config (manifest)
- webauthn RP_NAME, backup appName, WebAuthnCredentialsManager

### Textos actualizados
- "Tu wallet especializada para montañistas" → "Procedencia y autenticidad verificables"
- "Tu wallet criptográfica segura y privada para montañistas" → "Tu wallet criptográfica segura para procedencia y verificación"

---

## 3. Nueva paleta de colores Nelai

### Light mode
- **Primary:** Teal #0D9488 (166 76% 32%) — verificación, confianza
- **Accent:** Índigo #6366F1 (239 84% 67%) — identidad
- **Destructive:** Rojo (sin cambios, para emergencias)
- Fondos más neutros con tinte verde suave

### Dark mode
- **Primary:** Teal más claro (166 76% 45%)
- **Accent:** Índigo
- theme-color: #0D9488

---

## 4. Pasos para commit en nuevo repositorio

```bash
# 1. Inicializar git si no existe (o verificar estado)
cd /home/edgar/nelai/nelai-pwa
git status

# 2. Añadir todos los cambios
git add -A

# 3. Commit
git commit -m "feat: Nelai - Orquestador de agentes, Agente Guía, branding y paleta

- Orquestador de agentes (agentOrchestrator.ts) sin backend
- Agente Guía con plantillas para publish-dkg, emergency, etc.
- GuideModal integrado en ImageGallery (Proteger en DKG)
- Branding: Federación Andinismo → Nelai
- Nueva paleta teal + índigo"

# 4. Crear nuevo repositorio en GitHub/GitLab y añadir remote
git remote add origin https://github.com/tu-usuario/nelai.git

# 5. Push
git push -u origin main
```

---

## 5. Notas

- **package.json** usa `"name": "nelai"`. El despliegue en GitHub Pages toma el base path del nombre del repo o `VITE_BASE_URL` / `GITHUB_REPOSITORY`.
- **vite.config** (producción): `/${repoName}/` salvo `username.github.io` o `VITE_BASE_URL`.
- Referencias internas a "Andino" en PDFs, documentos y tipos se mantienen por compatibilidad; se pueden ir migrando después.
