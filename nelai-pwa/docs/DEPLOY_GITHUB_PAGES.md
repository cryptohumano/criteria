# Desplegar a GitHub Pages

Esta guía te ayudará a desplegar tu PWA Aura Wallet a GitHub Pages.

## Opción 1: Despliegue Automático con GitHub Actions (Recomendado)

### Paso 1: Habilitar GitHub Pages

1. Ve a tu repositorio en GitHub
2. Ve a **Settings** → **Pages**
3. En **Source**, selecciona **GitHub Actions**
4. Guarda los cambios

### Paso 2: Configurar el Base Path

**¡No necesitas hacer nada!** El workflow de GitHub Actions detecta automáticamente el nombre de tu repositorio.

Si tu repositorio se llama `nombre-repo` y está en `username/nombre-repo`, la URL será:
```
https://username.github.io/nombre-repo/
```

El base path se configura automáticamente durante el build usando la variable de entorno `GITHUB_REPOSITORY`.

### Paso 3: Hacer Push

Simplemente haz push a la rama `main` o `master`:

```bash
git add .
git commit -m "Preparar para GitHub Pages"
git push origin main
```

El workflow se ejecutará automáticamente y desplegará tu aplicación.

### Paso 4: Verificar el Despliegue

1. Ve a **Actions** en tu repositorio
2. Verifica que el workflow se haya completado exitosamente
3. Ve a **Settings** → **Pages** para ver la URL de tu sitio

## Opción 2: Despliegue Manual

Si prefieres desplegar manualmente:

### Paso 1: Instalar gh-pages (opcional)

```bash
yarn add -D gh-pages
```

### Paso 2: Build con Base Path

```bash
yarn build:gh-pages
```

O si tu repositorio tiene un nombre diferente:

```bash
yarn build --base=/nombre-de-tu-repo/
```

### Paso 3: Desplegar

Si usas `gh-pages`:

```bash
npx gh-pages -d dist
```

O manualmente:

1. Crea una rama `gh-pages`:
```bash
git checkout --orphan gh-pages
git rm -rf .
```

2. Copia el contenido de `dist`:
```bash
cp -r dist/* .
git add .
git commit -m "Deploy to GitHub Pages"
git push origin gh-pages
```

3. En GitHub, ve a **Settings** → **Pages** y selecciona la rama `gh-pages`

## Configuración del Base Path

El base path depende del nombre de tu repositorio:

- Si tu repo es `username.github.io` → Base: `/`
- Si tu repo es `username/pwa-substrate` → Base: `/pwa-substrate/`

El archivo `vite.config.ts` ya está configurado para detectar esto automáticamente.

## Verificar que Funciona

1. Visita tu sitio en `https://username.github.io/pwa-substrate/`
2. Verifica que la PWA funcione correctamente
3. Prueba instalar la PWA en tu dispositivo móvil

## Troubleshooting

### Los assets no se cargan

- Verifica que el `base` en `vite.config.ts` coincida con el nombre de tu repositorio
- Asegúrate de que todas las rutas usen rutas relativas

### El Service Worker no funciona

- Verifica que el manifest tenga `start_url` y `scope` correctos
- Asegúrate de que el Service Worker se registre correctamente

### Errores de CORS

- GitHub Pages sirve sobre HTTPS, así que no debería haber problemas de CORS
- Si usas APIs externas, verifica que permitan requests desde tu dominio

## Notas Importantes

- GitHub Pages solo sirve archivos estáticos
- No puedes usar variables de entorno en tiempo de ejecución
- El Service Worker funciona correctamente en GitHub Pages
- IndexedDB funciona en GitHub Pages (es cliente-side)

