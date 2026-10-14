test('a', () => { expect(() => { throw new Error('x'); }).toThrow(); });
