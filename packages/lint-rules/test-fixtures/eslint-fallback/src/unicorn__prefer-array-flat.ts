export function flatten(lists) {
  return lists.reduce((a, b) => a.concat(b), [])
}
