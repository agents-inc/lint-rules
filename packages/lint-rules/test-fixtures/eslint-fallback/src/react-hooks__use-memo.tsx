import { useMemo } from 'react'
export function WithAParameter({ n }: { n: number }) { const m = useMemo((x: number) => n * x, [n]); return <i>{m}</i> }
export function Async({ n }: { n: number }) { const m = useMemo(async () => n * 2, [n]); return <i>{String(m)}</i> }
