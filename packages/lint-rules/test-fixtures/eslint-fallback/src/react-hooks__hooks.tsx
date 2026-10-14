import { useState } from 'react';
export function App({ c }: { c: boolean }) {
  if (c) { useState(0); }
  return null;
}
