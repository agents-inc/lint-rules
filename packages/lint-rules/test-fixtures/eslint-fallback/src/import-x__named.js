// .js on purpose: import/named does not run on TypeScript
import { doesNotExistAnywhere } from './named-target.js'
export const v = doesNotExistAnywhere
