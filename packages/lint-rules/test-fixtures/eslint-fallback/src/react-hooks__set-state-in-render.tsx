import { useState } from 'react'
export function C() { const [v, setV] = useState(0); setV(1); return <i>{v}</i> }
