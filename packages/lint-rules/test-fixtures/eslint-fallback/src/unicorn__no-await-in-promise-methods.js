export async function f(p) {
  return Promise.all([await p, 1]);
}
