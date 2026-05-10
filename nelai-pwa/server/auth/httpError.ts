export class HttpError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 500
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export function getHttpStatus(err: unknown, fallback = 500): number {
  if (err instanceof HttpError) return err.statusCode
  if (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    typeof (err as { statusCode: unknown }).statusCode === 'number'
  ) {
    return (err as { statusCode: number }).statusCode
  }
  return fallback
}
