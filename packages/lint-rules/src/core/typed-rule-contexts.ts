import type ts from 'typescript'
import { isRecord } from './is-record.ts'

/** Parse boundary: typescript-eslint's parser services, which ESLint types as `any`. */
export function isProgram(value: unknown): value is ts.Program {
  return isRecord(value) && typeof value['getTypeChecker'] === 'function'
}

/** `base` with `own` over it, as ESLint derives each rule's context from its file's: ESLint freezes both objects. */
export function derivedFrom<Base extends object>(base: Base, own: Partial<Base>): Base {
  const derived: unknown = Object.create(base, Object.getOwnPropertyDescriptors(own))
  if (!isDerivedFrom(derived, base)) throw new Error('Object.create gave an object with another prototype')
  return derived
}

function isDerivedFrom<Base extends object>(value: unknown, base: Base): value is Base {
  return Object.getPrototypeOf(value) === base
}
