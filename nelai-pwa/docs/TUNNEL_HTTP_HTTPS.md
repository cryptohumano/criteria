# Solución: ERR_EMPTY_RESPONSE con Túnel Gratuito

## Problema

Cuando usas el túnel gratuito de localhost.run (`yarn tunnel 5173 nokey`), obtienes:
```
ERR_EMPTY_RESPONSE
Esta página no funciona
[dominio].lhr.life no envió ningún dato.
```

## Causa

El túnel gratuito de localhost.run **solo soporta HTTP** (puerto 80), pero tu servidor local está configurado para **solo aceptar HTTPS**.

Cuando el túnel intenta conectarse a tu servidor local por HTTP, el servidor no responde porque solo acepta conexiones HTTPS.

## Solución: Usar Servidor HTTP

Para que el túnel gratuito funcione, el servidor debe aceptar conexiones HTTP.

### Paso 1: Detener el Servidor HTTPS Actual

Si tienes el servidor corriendo con `yarn dev:https`, deténlo (Ctrl+C).

### Paso 2: Iniciar el Servidor en HTTP

```bash
yarn dev
```

Esto iniciará el servidor en HTTP (puerto 5173) y aceptará conexiones tanto HTTP como HTTPS localmente.

### Paso 3: Crear el Túnel

En otra terminal:

```bash
yarn tunnel 5173 nokey
```

### Paso 4: Verificar

1. El script debería mostrar la URL del túnel automáticamente
2. Abre la URL en tu navegador móvil
3. Debería funcionar correctamente

## ¿Por qué Funciona?

- **localhost.run redirige automáticamente HTTP a HTTPS**: Aunque tu servidor local esté en HTTP, la URL pública del túnel será HTTPS
- **El certificado es válido**: localhost.run proporciona un certificado SSL válido automáticamente
- **Funciona para PWAs**: La PWA se puede instalar porque la URL pública es HTTPS válida

## Alternativa: Mantener HTTPS Local

Si necesitas mantener HTTPS local (por ejemplo, para probar características específicas de HTTPS), necesitarás:

1. **Configurar tu clave SSH** en admin.localhost.run
2. **Usar un plan de pago** que soporte TLS passthrough (puerto 443)

Pero para desarrollo normal, usar HTTP local es suficiente y más simple.

## Verificación

Para verificar que el servidor está aceptando HTTP:

```bash
# Debe funcionar (código 200, 301, 302, o 404)
curl http://localhost:5173

# También debe funcionar si tienes certificados locales
curl -k https://localhost:5173
```

Si ambos funcionan, el túnel debería funcionar correctamente.

