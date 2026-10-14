// sibling fixture: mod_nodefault.ts contains `export const alpha = 1;`
import * as ns from './mod_nodefault';
export const x = ns.missingProp;
