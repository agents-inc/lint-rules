export function toObject(pairs) {
  return pairs.reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {})
}
