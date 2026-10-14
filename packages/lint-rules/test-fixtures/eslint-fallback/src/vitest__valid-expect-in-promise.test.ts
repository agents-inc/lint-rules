test('a', () => {
  Promise.resolve().then(() => { expect(1).toBe(1); });
});
