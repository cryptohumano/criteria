# Análisis del Extrinsic de Emergencia

## 🔍 Extrinsic Decodificado

### URL del Extrinsic
```
https://polkadot.js.org/apps/?rpc=wss%3A%2F%2Fsys.ibp.network%2Fasset-hub-paseo#/extrinsics/decode/0x0000150f454d455247454e43593a...
```

### Datos Enviados (Confirmados)

El extrinsic contiene **TODOS** estos datos:

```json
{
  "prefix": "EMERGENCY",
  "version": "1.0",
  "data": {
    // ✅ IDENTIFICACIÓN
    "emergencyId": "26ce2e6f-53f9-4400-8c84-8a58bc926a33",
    "version": "1.0",
    
    // ✅ TIPO Y DESCRIPCIÓN
    "type": "medical",
    "severity": "high",
    "description": "funcionará?",
    
    // ✅ GPS COMPLETO
    "location": {
      "latitude": 19.477654192500808,
      "longitude": -99.24422124230642,
      "accuracy": 98,                    // Precisión GPS en metros
      "timestamp": 1768796037169
    },
    
    // ✅ RELACIONES
    "relatedLogId": "80a40fce-a6a8-4fa8-b6e9-12097ece0f28",
    "relatedMilestoneId": "3fdc9d38-694d-4cee-ae7e-0b969ed58d32",
    "reporterAccount": "5D5TK4yDctocrVBUXe14XpjRBo5bCqeTsWTzPYoVdvwZ9sNE",
    
    // ✅ TIMESTAMPS
    "createdAt": 1768796037171,
    "reportedAt": 1768796037222,
    
    // ✅ METADATA COMPLETA
    "metadata": {
      // Datos de la bitácora
      "mountainName": "Cerro El Plomo",
      "location": "Región de Valparaíso",
      "logTitle": "Cerro El Plomo",
      "logLocation": "Región de Valparaíso",
      "logStartDate": 1768783308228,
      "participantsCount": 4,
      
      // ✅ Aviso de Salida completo
      "avisoSalida": {
        "guiaNombre": "Juan Carlos Pérez González",
        "lugarDestino": "Cerro El Plomo",
        "numeroParticipantes": 4,
        "fechaSalida": 1734220800000,
        "tipoActividad": "alta_montana"
      },
      
      // ✅ Milestone actual
      "milestone": {
        "title": "inicio",
        "type": "checkpoint"
      }
    }
  }
}
```

## 💰 ¿Qué se Pagó por esta Transacción?

### Tipo de Transacción
- **Extrinsic**: `system.remark`
- **Red**: Asset Hub Paseo (testnet de Polkadot)

### Costos de `system.remark`

Cuando envías un `system.remark`, pagas:

1. **Fee Base de Transacción**
   - Fee mínimo por enviar cualquier transacción
   - Típicamente: ~0.001-0.01 DOT (depende de la red)

2. **Fee por Tamaño de Datos (Weight)**
   - El fee aumenta proporcionalmente al tamaño del remark
   - Tu remark tiene aproximadamente **958 caracteres** (como viste en el log)
   - El fee se calcula basado en:
     - Tamaño del remark en bytes
     - Complejidad computacional (mínima para `system.remark`)

3. **Fee Total**
   - En **Asset Hub Paseo** (testnet): Generalmente muy bajo o gratis
   - En **Polkadot Mainnet**: Depende del tamaño, pero típicamente:
     - Remark pequeño (< 1KB): ~0.001-0.01 DOT
     - Remark mediano (1-10KB): ~0.01-0.1 DOT
     - Remark grande (10-32KB): ~0.1-1 DOT

### Cálculo del Fee

El fee se calcula con esta fórmula aproximada:

```
Fee = Base Fee + (Tamaño del Remark × Fee por byte) + Tip (opcional)
```

Para tu emergencia:
- **Tamaño**: ~958 caracteres (~958 bytes)
- **Fee estimado en Mainnet**: ~0.01-0.05 DOT (depende de la congestión)

### Ver el Fee Exacto

Para ver el fee exacto que pagaste:

1. **En Polkadot.js Apps**:
   - Ve a la página del extrinsic
   - Busca la sección "Fees" o "Transaction Details"
   - Ahí verás el fee exacto pagado

2. **En la Wallet**:
   - Ve a `/transactions/:hash`
   - El fee debería estar guardado en `transaction.fee`

3. **En el Explorer**:
   - Busca el hash de la transacción
   - Verás el fee en los detalles

## ✅ Confirmación: ¿Se Enviaron Todos los Datos?

**SÍ, se enviaron TODOS los datos:**

✅ **GPS completo**: latitud, longitud, precisión, timestamp  
✅ **Descripción**: "funcionará?"  
✅ **Datos de bitácora**: título, montaña, ubicación, fecha  
✅ **Aviso de salida completo**: guía, destino, participantes, actividad  
✅ **Milestone**: título y tipo  
✅ **IDs**: emergencyId, relatedLogId, relatedMilestoneId  
✅ **Cuenta**: reporterAccount  

## 📊 Resumen

| Concepto | Valor |
|----------|-------|
| **Tipo de transacción** | `system.remark` |
| **Tamaño del remark** | ~958 caracteres |
| **Datos incluidos** | GPS, descripción, metadata completa |
| **Fee estimado (Mainnet)** | ~0.01-0.05 DOT |
| **Fee en testnet** | Generalmente gratis o muy bajo |

## 🔗 Cómo Ver el Fee Exacto

1. Abre el link del extrinsic en Polkadot.js Apps
2. Busca la sección "Transaction Details" o "Fees"
3. Ahí verás el fee exacto pagado en DOT/USD

O revisa la transacción en tu wallet en `/transactions/:hash` donde debería estar guardado el fee.
