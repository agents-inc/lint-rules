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

export const hookExportedBySpecifierModule = `function useThing() {
  return 1
}
export { useThing }
`

// A string export name is not an identifier, so the hook counts under its local name.
export const hookExportedUnderAStringNameModule = `function useThing() {
  return 1
}
export { useThing as 'use thing' }
`

export const hookExportedAsAConstModule = `export const useThing = () => 1
`

export const hookBesideDestructuredConstModule = `export function useThing() {
  return 1
}
export const { panel } = parts
`

export const hookBesideInlineTypeSpecifierModule = `function useThing() {
  return 1
}
export { type Panel, useThing }
`

export const hookBesideTypeOnlyReexportModule = `export function useThing() {
  return 1
}
export type { Panel } from './panel'
`

export const hookBesideImportAliasModule = `export function useThing() {
  return 1
}
export import codes = Status.Codes
`

export const twoHooksOfOneLengthModule = `export function useAlpha() {
  return 1
}
export function useOmega() {
  return 2
}
`

export const constantOnlyModule = `export const statusCodes = { ok: 200 }
`

// reuseThing holds use and a capital, but not at its start.
export const functionNamedLikeAHookPastItsStartModule = `export function reuseThing() {
  return 1
}
`
