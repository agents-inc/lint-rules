export const effectWithArrowCallback = `import { useEffect } from 'react'
export function Panel() {
  useEffect(() => {
    document.title = 'panel'
  }, [])
  return <div>panel</div>
}`

export const effectWithNamedCallback = `import { useEffect } from 'react'
export function Panel() {
  useEffect(function setDocumentTitle() {
    document.title = 'panel'
  }, [])
  return <div>panel</div>
}
`

export const customEffectWithArrowCallback = `import { useMountEffect } from './use-mount-effect'
export function Panel() {
  useMountEffect(() => {
    document.title = 'panel'
  })
  return <div>panel</div>
}`

export const customEffectHook = 'useMountEffect'
