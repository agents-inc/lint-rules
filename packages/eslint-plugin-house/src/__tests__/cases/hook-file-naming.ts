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

export const hookBesideClassModule = `export function useThing() {
  return new Status()
}
export class Status {}
`

export const hookBesideEnumModule = `export function useThing() {
  return Status.On
}
export enum Status {
  On,
}
`

export const hookBesideScreamingCaseEnumModule = `export function useThing() {
  return STATUS.ON
}
export enum STATUS {
  ON,
}
`

export const hookBesideNamespaceModule = `export function useThing() {
  return Status.on
}
export namespace Status {
  export const on = 1
}
`

export const hookBesideDottedNamespaceModule = `export function useThing() {
  return Status.codes.on
}
export namespace Status.codes {
  export const on = 1
}
`

export const hookBesideDottedNamespaceUnderALowercaseNameModule = `export function useThing() {
  return status.Codes.on
}
export namespace status.Codes {
  export const on = 1
}
`

export const hookBesideStringNamedModule = `export function useThing() {
  return 1
}
export module 'Status' {
  export const on = 1
}
`

export const hookBesideInterfaceModule = `export function useThing(): Status {
  return { on: true }
}
export interface Status {
  on: boolean
}
`
