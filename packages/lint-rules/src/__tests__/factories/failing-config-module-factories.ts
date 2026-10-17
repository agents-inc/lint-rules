export function moduleThrowingCodedErrorText(message: string, code: string): string {
  return `throw Object.assign(new Error(${JSON.stringify(message)}), { code: ${JSON.stringify(code)} })\n`
}

export function moduleThrowingAStringText(thrown: string): string {
  return `throw ${JSON.stringify(thrown)}\n`
}
