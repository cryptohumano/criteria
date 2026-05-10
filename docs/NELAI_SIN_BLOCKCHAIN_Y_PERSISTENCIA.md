# Nelai sin blockchain: cripto, agentes y persistencia

Cómo funcionan los agentes y la persistencia cuando **no hay blockchain**, pero sí **herramientas criptográficas** (firmas, hashes). Y cómo el usuario saca ventaja en escenarios **offline**, **descentralizados** y **centralizados** — incluyendo redes sociales con creación/edición nativa.

---

## 1. Sin blockchain: qué sigue funcionando

Si quitamos toda blockchain (Polkadot, DKG on-chain, etc.), lo que queda es:

| Componente | Sin blockchain | Con qué se sustenta |
|------------|----------------|---------------------|
| **Identidad del firmante** | Sigue siendo una clave (par de llaves). No hay “cuenta on-chain”, pero la **clave** (y un identificador derivado, ej. did:key o dirección off-chain) identifica al creador. | Claves locales (WebCrypto, Polkadot keyring en modo solo-firma), o passkeys/WebAuthn. |
| **Firma de metadata** | Igual: se construye metadata canónica, se hashea, se firma con la clave privada. Cualquiera con la clave pública (o el identificador público) puede **verificar** que esa firma corresponde a ese payload. | Firma criptográfica (ed25519, sr25519, etc.) sobre hash de metadata. |
| **Integridad** | `contentHash` (SHA-256 del archivo) en la metadata. Si el archivo cambia, el hash no coincide → el Verificador marca “integridad inválida”. | Solo hashes, sin blockchain. |
| **Agente Verificador** | Recibe archivo + metadata + firma (+ opcionalmente publicKey). Verifica: (1) firma válida para ese payload, (2) contentHash del archivo = contentHash en metadata. Genera reporte: quién firmó, cuándo, si el contenido fue alterado. | No necesita red ni blockchain; todo en cliente. |
| **Agente Guía** | Explica qué implica “firmar” (qué datos van en la metadata, quién puede verificar, que es local/offline o que luego se puede subir a un servicio). Sin blockchain, no hay “on-chain”; el Guía adapta el mensaje: “solo se guarda en tu dispositivo / en el servicio que elijas”. | Plantillas o LLM; no dependen de chain. |
| **Persistencia** | Donde tú decidas: solo dispositivo, servidor propio, nube, IPFS, etc. La **firma y la metadata** son **portables**: puedes guardarlas junto al archivo o en otro sistema. | Ver sección 2. |

En resumen: **la verificación de origen y de integridad no requiere blockchain**. La blockchain (o el DKG) añade **inmutabilidad pública** y **descubribilidad** (cualquiera con el UAL puede consultar); sin ella, la garantía es “quien tenga el archivo + metadata + firma puede verificar”.

---

## 2. Persistencia: offline, centralizada y descentralizada

El usuario puede elegir **dónde** vive el contenido y **dónde** vive la prueba (metadata + firma):

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CREACIÓN (siempre puede ser offline)                                    │
│  Usuario crea/edita contenido → App calcula contentHash → Firma con     │
│  su clave → Metadata + firma (y opcionalmente archivo) se guardan        │
│  donde él decida.                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  TOTALMENTE   │         │  CENTRALIZADA   │         │ DESCENTRALIZADA │
│  OFFLINE      │         │                 │         │                 │
├───────────────┤         ├─────────────────┤         ├─────────────────┤
│ • Solo en     │         │ • App/backend   │         │ • DKG, IPFS,    │
│   dispositivo │         │   propio        │         │   blockchain     │
│ • IndexedDB,  │         │ • Red social    │         │ • UAL / CID /    │
│   archivos    │         │   (ella guarda  │         │   txHash         │
│   locales     │         │   el archivo;   │         │ • Cualquiera    │
│ • Backup      │         │   tú guardas o  │         │   puede resolver │
│   manual      │         │   subes el      │         │   con el ID     │
│   (export)    │         │   sello)        │         │                 │
└───────────────┘         └─────────────────┘         └─────────────────┘
```

- **Totalmente offline:** Archivo + metadata + firma solo en el dispositivo (y en copias que el usuario haga —USB, otro dispositivo—). El Verificador funciona con ese archivo y ese JSON de metadata/firma; no hace falta conexión. Ventaja: máximo control, cero dependencia de terceros.
- **Centralizada:** El usuario sube el archivo (y opcionalmente el sello) a un servidor, una app o una **red social**. La red puede tener sus propias herramientas de creación/edición. La ventaja de Nelai: el usuario **también** genera un sello propio (hash + firma con su clave). Aunque la red guarde otra versión o permita editar, el sello atesta “esta versión exacta la firmé yo en este momento”. Si en el futuro la red exporta o permite adjuntar “prueba de origen”, el usuario ya tiene esa prueba (portable) y puede verificarla en Nelai.
- **Descentralizada:** Publicación en DKG (UAL), IPFS (CID), o blockchain (txHash). La prueba es descubrible y verificable por cualquiera que tenga el identificador, sin depender de un solo servidor.

Los **agentes** funcionan en los tres escenarios: el Verificador solo necesita el archivo (o su hash) + metadata + firma; el Guía explica qué implica cada opción de guardado (local, centralizado, descentralizado).

---

## 3. Redes sociales con creación/edición nativa

Muchas redes ya ofrecen creación y edición en la propia plataforma (fotos, vídeos, texto). Ahí el “archivo” puede vivir solo en la red y cambiar con cada edición.

**Cómo puede sacar ventaja el usuario con Nelai:**

1. **Sello fuera de la red (offline / en tu control)**  
   Antes o después de publicar, el usuario genera en Nelai (o en una app tipo Andino/Nelai) el **contentHash** del contenido que quiere atestar y lo **firma** con su clave. Ese sello (metadata + firma) lo guarda:
   - solo en su dispositivo, o  
   - en un servicio que elija, o  
   - lo publica en DKG/IPFS y obtiene un UAL/CID.  

   La red social no tiene por qué saber de ese sello; el usuario tiene una **prueba independiente** de “esta versión la firmé yo”.

2. **Verificación en cualquier contexto**  
   Si más adelante alguien recibe una copia del contenido (por la red, por otro canal) y tiene también la metadata + firma (o el UAL), puede usar el **Agente Verificador** (en Nelai o en otra app que entienda el mismo formato) y obtener: quién firmó, cuándo, si el contenido coincide con el hash. Así la verificación **no depende** de que la red social lo implemente; depende de estándares abiertos (metadata canónica, firmas criptográficas).

3. **Ventaja offline**  
   El usuario puede **firmar y guardar sellos** sin conexión (en el móvil en la montaña, en un portátil sin internet). Luego, cuando tenga conexión, puede:
   - subir solo el sello a un servicio,
   - o publicar en DKG y obtener un UAL,
   - o no subir nada y quedarse 100% local.

   La ventaja offline es **soberanía del sello**: la prueba de origen se genera y se guarda donde el usuario decida, no donde la red social decida.

4. **Futuro: redes que adopten “proof of origin”**  
   Si una red social (o un estándar tipo Content Credentials/C2PA) permite **adjuntar** o **importar** una prueba de origen (hash + firma o UAL), el usuario que ya usa Nelai tendría esas pruebas listas. Nelai podría actuar como **generador de sellos** compatibles con ese ecosistema (centralizado o descentralizado).

---

## 4. Resumen: ventajas del usuario en cada capa

| Capa | Ventaja para el usuario |
|------|-------------------------|
| **Offline** | Crear y firmar evidencias sin internet; guardar todo en dispositivo; verificar con archivo + metadata + firma sin red. Control total. |
| **Centralizada** | Usar redes sociales o servidores para almacenar/distribuir contenido, pero **mantener un sello independiente** (en dispositivo o en un servicio propio). Verificar en Nelai sin depender de que la red implemente verificación. |
| **Descentralizada** | Publicar el sello (o un Knowledge Asset) en DKG/IPFS/blockchain y obtener un identificador (UAL, CID, txHash). Cualquiera con ese ID puede verificar; la prueba no depende de un solo actor. |
| **Agentes sin blockchain** | El **Verificador** sigue dando reportes (quién firmó, integridad) con solo criptografía. El **Guía** explica qué implica cada opción (local, centralizado, descentralizado) y cómo aprovechar offline y portabilidad. |

La idea central: **la identidad criptográfica y el sello (metadata + firma) son del usuario y portables**. La persistencia (offline, centralizada, descentralizada) es una **elección** que él hace según contexto; Nelai puede operar en los tres modos y los agentes tienen sentido en todos.
