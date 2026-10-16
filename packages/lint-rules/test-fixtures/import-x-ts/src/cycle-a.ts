// import-x/no-cycle, with cycle-b.ts.
import { b } from './cycle-b'
export const a = 1
export const v = b
