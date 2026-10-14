import { useMemo } from 'react'
export function A({ id }: { id: number }) {
  useMemo(() => { console.log(id) }, [id])
  return <div />
}
