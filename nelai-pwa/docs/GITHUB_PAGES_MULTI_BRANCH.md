# GitHub Pages con Múltiples Branches

## Respuesta Corta

**No**, GitHub Pages solo permite **un sitio activo por repositorio** desde una sola rama o carpeta. Sin embargo, hay **alternativas** para tener múltiples deployments.

## Opciones Disponibles

### Opción 1: Subcarpetas en gh-pages (Recomendado para tu caso)

Desplegar diferentes branches a subcarpetas dentro de `gh-pages`:

```
usuario.github.io/repositorio/
  ├── aura/          (desde branch 'documents')
  └── andino/        (desde branch 'andino')
```

**Ventajas:**
- ✅ Un solo repositorio
- ✅ Múltiples sitios accesibles
- ✅ Mantiene historial completo

**Desventajas:**
- ❌ Comparten el mismo dominio base
- ❌ No pueden tener dominios personalizados separados
- ❌ Requiere configuración de workflows

### Opción 2: Repositorios Separados

Cada proyecto en su propio repositorio:

- `aura-pwa` → `usuario.github.io/aura-pwa`
- `nelai-pwa` → `usuario.github.io/nelai-pwa` (o dominio personalizado)

**Ventajas:**
- ✅ Dominios/URLs completamente separados
- ✅ Configuración independiente
- ✅ Privacidad independiente (uno puede ser privado)
- ✅ Más limpio y organizado

**Desventajas:**
- ❌ Duplicación de código base (si no se usa fork)
- ❌ Mantener sincronización manual

### Opción 3: GitHub Actions con Deploy Condicional

Workflow que detecta la rama y despliega a diferentes subcarpetas:

```yaml
name: Deploy Multiple Sites

on:
  push:
    branches: [documents, andino]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        
      - name: Build
        run: npm run build
        
      - name: Deploy to gh-pages
        if: github.ref == 'refs/heads/documents'
        run: |
          # Deploy a /aura/
          
      - name: Deploy to gh-pages
        if: github.ref == 'refs/heads/andino'
        run: |
          # Deploy a /andino/
```

## Recomendación para Andino Wallet

### Si quieres mantener todo en un repo:

**Usar subcarpetas en gh-pages:**

1. **Workflow para branch `documents`** → despliega a `/aura/`
2. **Workflow para branch `andino`** → despliega a `/andino/`

**URLs resultantes:**
- `usuario.github.io/repositorio/aura/` → Aura PWA
- `usuario.github.io/repositorio/andino/` → Andino Wallet

### Si prefieres separación completa:

**Crear repositorio privado separado:**
- `nelai-pwa` (privado)
- Despliegue independiente
- Dominio personalizado opcional

## Implementación: Workflow Multi-Branch

Aquí tienes un ejemplo de workflow que despliega diferentes branches a subcarpetas:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [documents, andino]

permissions:
  contents: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'yarn'
          
      - name: Install dependencies
        run: corepack enable && corepack prepare yarn@stable --activate && yarn install --frozen-lockfile
        
      - name: Build
        run: yarn build
        
      - name: Determine deployment path
        id: path
        run: |
          if [ "${{ github.ref }}" == "refs/heads/documents" ]; then
            echo "path=aura" >> $GITHUB_OUTPUT
          elif [ "${{ github.ref }}" == "refs/heads/andino" ]; then
            echo "path=andino" >> $GITHUB_OUTPUT
          fi
          
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
          destination_dir: ${{ steps.path.outputs.path }}
          keep_files: true  # Mantener otros deployments
```

## Configuración de Base Path

Para que cada sitio funcione correctamente en su subcarpeta, necesitas configurar el `base` en Vite:

**vite.config.ts:**
```typescript
export default defineConfig({
  base: process.env.GITHUB_REF === 'refs/heads/andino' 
    ? '/repositorio/andino/' 
    : '/repositorio/aura/',
  // ...
})
```

O usar variables de entorno en el workflow:

```yaml
- name: Build
  env:
    VITE_BASE_PATH: ${{ steps.path.outputs.path }}
  run: yarn build
```

## Consideraciones Importantes

### 1. Privacidad
- Si `andino` necesita ser privado, **debe ser repositorio separado**
- GitHub Pages de repos privados requiere GitHub Pro/Team

### 2. Dominios Personalizados
- Cada repositorio puede tener un dominio personalizado
- Con subcarpetas, solo puedes tener un dominio para todo el repo

### 3. CI/CD
- Workflows separados = más control
- Workflow único = más simple pero menos flexible

## Decisión Final

**Para Andino Wallet, recomiendo:**

1. **Si necesitas privacidad** → Repositorio privado separado
2. **Si es solo para desarrollo/testing** → Subcarpetas en gh-pages
3. **Si quieres dominios separados** → Repositorios separados

## Próximos Pasos

Si eliges la opción de subcarpetas, puedo:
1. Crear el workflow multi-branch
2. Configurar Vite para diferentes base paths
3. Actualizar la configuración de rutas en React Router

¿Cuál opción prefieres?
