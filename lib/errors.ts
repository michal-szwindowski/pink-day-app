export function getErrorMessage(caughtError: unknown, fallback: string) {
  if (caughtError instanceof Error) {
    return caughtError.message
  }

  if (
    caughtError &&
    typeof caughtError === 'object' &&
    'message' in caughtError &&
    typeof caughtError.message === 'string'
  ) {
    return caughtError.message
  }

  if (
    caughtError &&
    typeof caughtError === 'object' &&
    'details' in caughtError &&
    typeof caughtError.details === 'string'
  ) {
    return caughtError.details
  }

  try {
    const serialized = JSON.stringify(caughtError)
    return serialized && serialized !== '{}' ? serialized : fallback
  } catch {
    return fallback
  }
}
