export const p = new Promise((ok, bad) => {
  ok(1)
  return bad
})
