/**
 * Helper para acceder al provider RPC de Dedot
 */
export function getDedotRpcProvider(client: any) {
  if (!client) return null

  // Intentar diferentes formas de acceder al provider
  // El cliente de Dedot puede tener el provider en diferentes lugares
  let provider = client.provider || client.jsonRpcClient || client.rpcClient || (client as any)._provider
  
  if (!provider) {
    // Si no encontramos el provider, intentar acceder directamente al cliente
    // Algunos clientes tienen métodos RPC directos
    if (typeof (client as any).send === 'function') {
      return client
    }
    return null
  }
  
  // Verificar que tenga el método send
  if (typeof provider.send === 'function') {
    return provider
  }
  
  // Si el provider tiene un método request, usarlo
  if (typeof provider.request === 'function') {
    return {
      send: (method: string, params: any[]) => provider.request(method, params)
    }
  }
  
  // Si el provider tiene un método call, usarlo
  if (typeof provider.call === 'function') {
    return {
      send: (method: string, params: any[]) => provider.call(method, params)
    }
  }
  
  return null
}

/**
 * Hacer una llamada RPC a través del cliente de Dedot
 */
export async function callRpc(client: any, method: string, params: any[] = []): Promise<any> {
  const provider = getDedotRpcProvider(client)
  
  if (!provider) {
    throw new Error('No se pudo acceder al provider RPC')
  }
  
  return provider.send(method, params)
}

