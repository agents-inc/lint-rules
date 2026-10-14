export async function f(p: Promise<number>) {
  return Promise.all([await p, 1]);
}
