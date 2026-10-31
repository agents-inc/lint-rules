import { useCallback } from 'react'

declare function useHook(): void
declare function doSomething(): void

export function useItems(item: unknown) {
  const items: unknown[] = []
  useHook()
  items.push(item)
  return useCallback(() => {
    doSomething()
    return [items]
  }, [items])
}
