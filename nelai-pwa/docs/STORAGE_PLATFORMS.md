# Almacenamiento Seguro en PWAs: PC vs Android vs iOS

## Resumen Ejecutivo

Las Progressive Web Apps (PWAs) tienen limitaciones de seguridad inherentes porque **no tienen acceso directo a los keystores del sistema operativo**. Sin embargo, la implementación actual proporciona un nivel de seguridad razonable usando tecnologías web estándar.

## Comparación por Plataforma

### 🖥️ **PC (Windows, macOS, Linux)**

#### Almacenamiento
- **IndexedDB**: Almacenamiento persistente en el navegador
- **Ubicación física**:
  - **Chrome/Edge**: `%LOCALAPPDATA%\Google\Chrome\User Data\Default\IndexedDB\` (Windows)
  - **Firefox**: `%APPDATA%\Mozilla\Firefox\Profiles\<profile>\storage\default\`
  - **Safari**: `~/Library/Safari/LocalStorage/`

#### Seguridad
- ✅ **Ventajas**:
  - IndexedDB está aislado por origen (mismo dominio)
  - Los datos están encriptados con contraseña del usuario
  - No accesible directamente desde el sistema de archivos sin permisos

- ⚠️ **Limitaciones**:
  - Si alguien tiene acceso físico a la PC y conoce la contraseña, puede desencriptar
  - No hay protección hardware (TPM/HSM)
  - Los datos pueden ser extraídos si se accede al perfil del navegador

#### Recomendaciones
- Usar contraseñas fuertes
- Habilitar bloqueo de pantalla en la PC
- Considerar encriptación de disco completo (BitLocker, FileVault, LUKS)

---

### 📱 **Android**

#### Almacenamiento
- **IndexedDB**: Similar a PC, pero en el almacenamiento de la app
- **Ubicación física**:
  - `/data/data/<package-name>/app_webview/Default/IndexedDB/`
  - Requiere root para acceder directamente

#### Seguridad
- ✅ **Ventajas**:
  - Android tiene sandboxing por aplicación
  - Los datos están aislados por app
  - Si la app está instalada como PWA, tiene su propio espacio aislado

- ⚠️ **Limitaciones**:
  - No hay acceso a Android Keystore System (solo apps nativas)
  - No hay acceso a hardware security modules (HSM) del dispositivo
  - Si el dispositivo está rooteado, el aislamiento puede ser comprometido

#### Diferencias con Apps Nativas
```
App Nativa Android:
├── Acceso a Android Keystore System ✅
├── Claves almacenadas en hardware (si está disponible) ✅
├── Protección con huella dactilar/PIN del sistema ✅
└── Encriptación automática del almacenamiento ✅

PWA Android:
├── IndexedDB con encriptación por contraseña ⚠️
├── Sin acceso a hardware security ❌
├── Sin protección biométrica nativa ❌
└── Depende del navegador para seguridad ⚠️
```

#### Recomendaciones
- Usar dispositivos con Android 7.0+ (encriptación de disco por defecto)
- Activar bloqueo de pantalla con PIN/patrón/huella
- Considerar WebAuthn para autenticación biométrica (opcional)

---

### 🍎 **iOS**

#### Almacenamiento
- **IndexedDB**: Almacenamiento en el contenedor de la app
- **Ubicación física**:
  - `/var/mobile/Containers/Data/Application/<UUID>/Library/WebKit/WebsiteData/IndexedDB/`
  - Requiere jailbreak para acceder directamente

#### Seguridad
- ✅ **Ventajas**:
  - iOS tiene sandboxing muy estricto
  - Encriptación de datos automática cuando el dispositivo está bloqueado
  - Data Protection API protege los datos cuando el dispositivo está bloqueado

- ⚠️ **Limitaciones**:
  - No hay acceso a iOS Keychain (solo apps nativas)
  - No hay acceso a Secure Enclave (solo apps nativas)
  - Sin TouchID/FaceID directo (aunque WebAuthn puede ayudar)

#### Diferencias con Apps Nativas
```
App Nativa iOS:
├── Acceso a iOS Keychain ✅
├── Claves almacenadas en Secure Enclave ✅
├── Protección con TouchID/FaceID ✅
├── Data Protection (encriptación automática) ✅
└── Protección cuando el dispositivo está bloqueado ✅

PWA iOS:
├── IndexedDB con encriptación por contraseña ⚠️
├── Sin acceso a Secure Enclave ❌
├── Sin TouchID/FaceID directo ❌
├── Data Protection aplica al almacenamiento del navegador ✅
└── Depende del navegador para seguridad ⚠️
```

#### Recomendaciones
- Usar iOS 12.0+ (mejor soporte para PWAs)
- Activar bloqueo de pantalla con FaceID/TouchID
- La encriptación de datos se activa automáticamente cuando el dispositivo está bloqueado

---

## Comparación de Seguridad

| Característica | PC | Android | iOS |
|---------------|-----|---------|-----|
| **Sandboxing** | ⚠️ Por navegador | ✅ Por app | ✅ Muy estricto |
| **Encriptación de disco** | ⚠️ Manual | ✅ Automática (7.0+) | ✅ Automática |
| **Hardware Security** | ❌ No disponible | ❌ No disponible | ❌ No disponible |
| **Protección cuando bloqueado** | ❌ No | ⚠️ Parcial | ✅ Sí (Data Protection) |
| **Aislamiento por origen** | ✅ Sí | ✅ Sí | ✅ Sí |
| **Acceso físico requerido** | ⚠️ Medio | ⚠️ Alto (root) | ⚠️ Muy alto (jailbreak) |

---

## Mejoras Futuras Posibles

### 1. **WebAuthn para Autenticación Biométrica**
```typescript
// Permite usar TouchID/FaceID/Fingerprint en PWAs
const credential = await navigator.credentials.create({
  publicKey: {
    challenge: randomBytes(32),
    rp: { name: "PWA Substrate" },
    user: { id: userId, name: "user", displayName: "User" },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required"
    }
  }
})
```

### 2. **Timeout Automático**
- Bloquear el keyring después de X minutos de inactividad
- Requerir contraseña nuevamente

### 3. **Encriptación Adicional**
- Usar Web Crypto API para generar claves más seguras
- Implementar rotación de claves

---

## Conclusión

**La implementación actual es la mejor opción disponible para PWAs** porque:

1. ✅ Usa tecnologías web estándar (Web Crypto API, IndexedDB)
2. ✅ Funciona en todas las plataformas (PC, Android, iOS)
3. ✅ Encripta datos con contraseña del usuario
4. ✅ Aprovecha el sandboxing del navegador
5. ✅ En iOS, se beneficia de Data Protection automática

**Limitaciones aceptadas**:
- ❌ No hay acceso a hardware security modules
- ❌ No hay protección biométrica nativa directa
- ⚠️ Depende de la seguridad del navegador y del sistema operativo

**Para máxima seguridad**, considera:
- Usar apps nativas si necesitas hardware security
- Implementar WebAuthn para autenticación biométrica
- Educar a los usuarios sobre buenas prácticas de contraseñas

