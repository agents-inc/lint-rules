import { isObject } from '../is-object.ts'

// What a rule's JSON schema lets its options be, read for the checks of data/oxlint-refused-options.json
// against the installed oxlint and typescript-eslint (oxlint-refused-options.integration.test.ts):
// each list of options one value at a time, and the options one schema takes that another does not.

/** A list of options a schema takes, and the keys its objects set: one value varied, each position before it at its first value. */
export type OptionList = { readonly options: readonly unknown[]; readonly keys: readonly string[] }

/** A schema node's paths, each `.key` or `[]` for an array's items from the options' root, and its enum values, each `path=value`. */
type SchemaPaths = { readonly keys: ReadonlySet<string>; readonly enumValues: ReadonlySet<string> }

const REF_PREFIX = '#/'
const REF_SEPARATOR = '/'
const ITEMS_PATH = '[]'
const KEY_PATH = '.'
const ENUM_VALUE_SEPARATOR = '='
// Values given where the schema asks only a type: one of each.
const A_NUMBER = 1
const A_STRING = 'x'

/**
 * Each list of options the schema takes, varying one value at a time: each enum value, true and
 * false, a number, a string, an empty array and an array of each item value, an empty object and
 * an object of each property value, at any depth; each position after the values of the positions
 * before it at their first. A schema given as an array lists its positions, as ESLint reads it.
 */
export function optionListsTheSchemaTakes(schema: unknown): OptionList[] {
  const root = asTheRuleReadsIt(schema)
  const lists = listsOfPositions(root, root)
  const eachOnce = [...new Map(lists.map((options) => [JSON.stringify(options), options])).values()]
  return eachOnce.map((options) => ({ options, keys: keysSetBy(options) }))
}

/**
 * The options the first schema takes that the second does not, each named by its path from the
 * options' root: a key the second has no key at, its keys below it aside; and an enum value at a
 * path both have that the second's enum there lacks.
 */
export function optionsOnlyTheFirstSchemaTakes(first: unknown, second: unknown): string[] {
  const firstPaths = pathsOf(asTheRuleReadsIt(first))
  const secondPaths = pathsOf(asTheRuleReadsIt(second))
  const keys = [...firstPaths.keys].filter((path) => !secondPaths.keys.has(path) && hasPath(secondPaths, parentOf(path)))
  const enumValues = [...firstPaths.enumValues].filter((value) => !secondPaths.enumValues.has(value) && hasPath(secondPaths, pathOfEnumValue(value)))
  return [...keys, ...enumValues].toSorted()
}

/** ESLint reads a schema given as an array as the positions of the options list. */
function asTheRuleReadsIt(schema: unknown): unknown {
  return Array.isArray(schema) ? { type: 'array', items: schema } : schema
}

function listsOfPositions(node: unknown, root: unknown): unknown[][] {
  const resolved = resolvedIn(root, node)
  const alternatives = alternativesOf(resolved)
  if (alternatives !== null) return alternatives.flatMap((alternative) => listsOfPositions(alternative, root))
  if (fieldOf(resolved, 'type') === 'array' || fieldOf(resolved, 'items') !== undefined) return listsOfItems(positionsOf(fieldOf(resolved, 'items')), root)
  return valuesOf(resolved, root).map((value) => [value])
}

function listsOfItems(positions: readonly unknown[], root: unknown): unknown[][] {
  const firsts = positions.map((position) => valuesOf(position, root)[0])
  return positions.flatMap((position, index) => valuesOf(position, root).map((value) => [...firsts.slice(0, index), value]))
}

function valuesOf(node: unknown, root: unknown): unknown[] {
  const resolved = resolvedIn(root, node)
  const enumValues = fieldOf(resolved, 'enum')
  if (Array.isArray(enumValues)) return [...enumValues]
  const alternatives = alternativesOf(resolved)
  if (alternatives !== null) return alternatives.flatMap((alternative) => valuesOf(alternative, root))
  switch (typeOf(resolved)) {
    case 'boolean':
      return [true, false]
    case 'number':
    case 'integer':
      return [A_NUMBER]
    case 'string':
      return [A_STRING]
    case 'array':
      return [[], ...valuesOf(itemSchemaOf(resolved), root).map((value) => [value])]
    case 'object':
      return [{}, ...propertiesOf(resolved).flatMap(([key, property]) => valuesOf(property, root).map((value) => ({ [key]: value })))]
    default:
      // No type, or `null`: nothing an option would be given.
      return []
  }
}

/** Every key path and enum value of the schema, alternatives and array items included. */
function pathsOf(root: unknown): SchemaPaths {
  const keys = new Set<string>()
  const enumValues = new Set<string>()
  const walk = (node: unknown, path: string): void => {
    const resolved = resolvedIn(root, node)
    const values = fieldOf(resolved, 'enum')
    if (Array.isArray(values)) values.forEach((value) => enumValues.add(`${path}${ENUM_VALUE_SEPARATOR}${JSON.stringify(value)}`))
    alternativesOf(resolved)?.forEach((alternative) => walk(alternative, path))
    positionsOf(fieldOf(resolved, 'items')).forEach((item) => walk(item, path === '' ? path : `${path}${ITEMS_PATH}`))
    propertiesOf(resolved).forEach(([key, property]) => {
      const keyPath = `${path}${KEY_PATH}${key}`
      keys.add(keyPath)
      walk(property, keyPath)
    })
  }
  walk(root, '')
  return { keys, enumValues }
}

/** Whether the schema has the path: the options' root it always has. */
function hasPath({ keys }: SchemaPaths, path: string): boolean {
  return path === '' || keys.has(path)
}

/** The key path a key path lies at, an array's items read as the array. */
function parentOf(path: string): string {
  return withoutItems(path.slice(0, path.lastIndexOf(KEY_PATH)))
}

/** The key path an enum value lies at, an array's items read as the array. */
function pathOfEnumValue(enumValue: string): string {
  return withoutItems(enumValue.slice(0, enumValue.indexOf(ENUM_VALUE_SEPARATOR)))
}

function withoutItems(path: string): string {
  return path.endsWith(ITEMS_PATH) ? path.slice(0, -ITEMS_PATH.length) : path
}

/** The keys of every object of the list. */
function keysSetBy(options: readonly unknown[]): string[] {
  return options.flatMap((option) => (isObject(option) && !Array.isArray(option) ? Object.keys(option) : []))
}

/** A node with `$ref` read as the node it points to in the root, as `#/a/b`. */
function resolvedIn(root: unknown, node: unknown): unknown {
  const ref = fieldOf(node, '$ref')
  if (typeof ref !== 'string') return node
  if (!ref.startsWith(REF_PREFIX)) throw new Error(`a schema reference outside the schema: ${ref}`)
  return ref
    .slice(REF_PREFIX.length)
    .split(REF_SEPARATOR)
    .reduce<unknown>((target, segment) => {
      const next = fieldOf(target, segment)
      if (next === undefined) throw new Error(`a schema reference to nothing: ${ref}`)
      return next
    }, root)
}

function alternativesOf(node: unknown): readonly unknown[] | null {
  const alternatives = fieldOf(node, 'oneOf') ?? fieldOf(node, 'anyOf')
  return Array.isArray(alternatives) ? alternatives : null
}

/** A schema's items as positions: each schema of a list, or the one schema every item meets. */
function positionsOf(items: unknown): readonly unknown[] {
  if (items === undefined) return []
  return Array.isArray(items) ? items : [items]
}

function itemSchemaOf(node: unknown): unknown {
  const items = fieldOf(node, 'items')
  return Array.isArray(items) ? items[0] : items
}

function propertiesOf(node: unknown): [string, unknown][] {
  const properties = fieldOf(node, 'properties')
  return isObject(properties) ? Object.entries(properties) : []
}

/** The node's type: its first where it names several, an object's where it has properties, else none. */
function typeOf(node: unknown): string | null {
  const type = fieldOf(node, 'type')
  if (typeof type === 'string') return type
  if (Array.isArray(type) && typeof type[0] === 'string') return type[0]
  return fieldOf(node, 'properties') === undefined ? null : 'object'
}

/** The node's own field: undefined where the node is no object or has no such field. */
function fieldOf(node: unknown, field: string): unknown {
  if (!isObject(node) || Array.isArray(node) || !Object.hasOwn(node, field)) return undefined
  const value: unknown = Reflect.get(node, field)
  return value
}
