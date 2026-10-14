import { cloneElement, type ReactElement } from 'react'
export function withKey(element: ReactElement) {
  // eslint-disable-next-line react/no-clone-element
  return cloneElement(element, { key: 'k' })
}
