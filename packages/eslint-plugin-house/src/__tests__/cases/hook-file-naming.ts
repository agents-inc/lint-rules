export const hookOnlyModule = `export function useThing() {
  return 1
}
export const LIMIT = 2
`

export const defaultExportedHookModule = `const useKeyPress = (key: string) => key === 'Enter'
export default useKeyPress
`

export const floatingPanelHookModule = `export function useFloatingPanel() {
  return 1
}
export const PANEL_OFFSET = 2
`

export const defaultExportedHookFunctionModule = `export default function useFloatingPanel() {
  return 1
}
`

export const twoHookModule = `export function usePanel() {
  return 1
}
export function useFloatingPanel() {
  return usePanel() + 1
}
`

export const acronymHookModule = `export function useHTMLParser() {
  return 1
}
`

export const hookBarrel = `export { useFloatingPanel } from './use-floating-panel'
export { usePanel } from './use-panel'
`
