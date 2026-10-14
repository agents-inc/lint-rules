/** A module declaring `union` as its only type: the source a union fixture is linted as. */
export function buildUnionDeclaration(union: string): string {
  return `export type Union = ${union}\n`
}
