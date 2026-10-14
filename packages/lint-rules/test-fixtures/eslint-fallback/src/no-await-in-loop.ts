export async function f(items: Promise<number>[]) {
  for (const i of items) { await i; }
}
