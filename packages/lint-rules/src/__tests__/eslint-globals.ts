// ESLint reads a global set to `off` as no global; every other setting (`readonly`, `writable`, true,
// false) defines it.
const NO_GLOBAL = 'off'

/** The names given that the globals ESLint calculated for a file define, in the order given. */
export function namesDefinedIn(globals: Readonly<Record<string, unknown>>, names: readonly string[]): string[] {
  return names.filter((name) => Object.hasOwn(globals, name) && globals[name] !== NO_GLOBAL)
}
