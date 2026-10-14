// sibling fixture: mod_both.ts contains `export const foo = 1;` and `export default { foo };`
import foo from './mod_both';
export const x = foo;
