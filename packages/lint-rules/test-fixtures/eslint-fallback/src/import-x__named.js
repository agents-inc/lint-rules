// .js on purpose: import/named does not run on TypeScript. It imports a TS module, written without
// its extension, so it fires only where import-x resolves TypeScript (questions.md #33).
import { doesNotExistAnywhere } from './named-target'
export const v = doesNotExistAnywhere
