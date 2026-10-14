import { useEffect } from 'react';
export function App({ a }: { a: number }) {
  useEffect(() => { console.log(a); }, []);
  return null;
}
