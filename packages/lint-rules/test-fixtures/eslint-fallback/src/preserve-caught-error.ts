export function f(g: () => void) {
  try { g(); } catch (e) { throw new Error("wrapped"); }
}
