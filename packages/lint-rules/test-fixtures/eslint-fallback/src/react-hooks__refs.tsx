import { useRef } from 'react'
export function C() { const r = useRef(0); return <i>{r.current}</i> }
