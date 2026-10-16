// import-x/namespace: b.ts exports no missingProp.
import * as ns from './b'
export const v = ns.missingProp
