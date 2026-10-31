export function f() {
  outer: for (let i = 0; i < 1; i += 1) {
    break outer
  }
}
