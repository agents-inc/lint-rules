/** What a caught value says: an Error's message, anything else as a string. */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Whether a caught value is a Node error with the code given (`EPERM`, `ERR_MODULE_NOT_FOUND`). */
export function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}
