function Child() { return <i /> }
export function C() {
  try {
    return <Child />
  } catch {
    return null
  }
}
