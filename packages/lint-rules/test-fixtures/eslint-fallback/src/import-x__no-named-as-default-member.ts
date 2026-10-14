// sibling fixture: mod_both.ts contains `export const foo = 1;` and `export default { foo };`
import mod from './mod_both';
export const x = mod.foo;
