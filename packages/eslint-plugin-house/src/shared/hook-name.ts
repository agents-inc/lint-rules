const HOOK_NAME = /^use[A-Z]/u

export function isHookName(name: string): boolean {
  return HOOK_NAME.test(name)
}
