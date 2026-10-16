// import-x/no-cycle, with cycle-a.ts.
import { a } from './cycle-a'
export const b = a
