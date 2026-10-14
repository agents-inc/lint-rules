function outer() {
  function inner(a: number) {
    return a + 1;
  }
  return inner(1);
}
export { outer };
