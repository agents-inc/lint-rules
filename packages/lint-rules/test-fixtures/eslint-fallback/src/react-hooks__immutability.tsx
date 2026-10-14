import { useState } from 'react'
export function C() { const [o] = useState({ a: 1 }); o.a = 2; return <i>{o.a}</i> }
