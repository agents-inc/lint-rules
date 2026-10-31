export function f(run) {
  try {
    return run()
  } catch (error) {
    return 0
  }
}
