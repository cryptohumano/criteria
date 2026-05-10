# Solucionar Error de Protección de Ambiente en GitHub Pages

## Error

```
Branch "andino" is not allowed to deploy to github-pages due to environment protection rules.
The deployment was rejected or didn't satisfy other protection rules.
```

## Solución

Este error ocurre porque el ambiente `github-pages` tiene reglas de protección que solo permiten ciertas ramas. Necesitas configurar el ambiente en GitHub.

### Paso 1: Ir a Configuración del Ambiente

1. Ve a tu repositorio en GitHub
2. Ve a **Settings** (Configuración)
3. En el menú lateral, busca **Environments** (Ambientes)
4. Haz clic en **github-pages**

### Paso 2: Configurar Ramas Permitidas

1. En la sección **Deployment branches** (Ramas de despliegue):
   - Selecciona **Selected branches** (Ramas seleccionadas)
   - Agrega la rama `andino` a la lista
   - O selecciona **All branches** (Todas las ramas) si quieres permitir cualquier rama

### Paso 3: (Opcional) Configurar Revisores

Si tienes revisores requeridos, puedes:
- Agregar revisores específicos
- O desactivar la revisión requerida para despliegues automáticos

### Paso 4: Guardar y Probar

1. Guarda los cambios
2. Haz push de nuevo a la rama `andino`:
   ```bash
   git push origin andino
   ```
3. El workflow debería ejecutarse sin el error de protección

## Alternativa: Desactivar Protección Temporalmente

Si no puedes acceder a la configuración del ambiente o quieres una solución rápida:

1. Ve a **Settings** → **Environments** → **github-pages**
2. Desactiva temporalmente las reglas de protección
3. Haz el despliegue
4. Reactiva las reglas después

**⚠️ Nota**: Esto reduce la seguridad, úsalo solo si es necesario.

## Verificar Configuración

Después de configurar, puedes verificar:

1. Ve a **Settings** → **Environments** → **github-pages**
2. Verifica que `andino` esté en la lista de ramas permitidas
3. Ve a **Actions** y verifica que el workflow se ejecute sin errores

## Configuración Recomendada

Para desarrollo/testing:

- **Deployment branches**: `All branches` (o al menos `documents` y `andino`)
- **Required reviewers**: Desactivado (para despliegues automáticos)
- **Wait timer**: 0 minutos (despliegue inmediato)

Para producción:

- **Deployment branches**: Solo `main` o `master`
- **Required reviewers**: Activado con al menos 1 revisor
- **Wait timer**: 5 minutos (para permitir cancelación si es necesario)
