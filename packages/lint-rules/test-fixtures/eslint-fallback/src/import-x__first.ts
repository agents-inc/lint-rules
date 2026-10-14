// sibling fixture: sideeffect.ts contains `globalThis.x = 1;`
import { alpha } from './mod_nodefault';
export const y = alpha;
import './sideeffect';
