import { useState, useEffect } from 'react'
export function C() { const [v, setV] = useState(0); useEffect(() => { setV(1) }, []); return <i>{v}</i> }
