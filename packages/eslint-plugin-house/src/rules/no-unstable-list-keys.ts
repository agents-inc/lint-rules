import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

import { jsxAttributeName } from '../shared/jsx-attributes.ts'

// The schema does not require the key: ESLint fills it from meta.defaultOptions when a config omits it.
type KeyMinters = { minters?: readonly string[] }

type Options = [KeyMinters]

type ParentLink = { child: TSESTree.Node; parent: TSESTree.Node }

// Functions that mint a fresh id on every call, compared lowercased: the same generator is spelled
// randomUUID, uuidv4 and ObjectId across packages. Math.random() and Date.now() are left to
// sonarjs/no-uniq-key, so one key is not reported twice.
const ID_MINTERS: readonly string[] = ['randomuuid', 'uuid', 'uuidv4', 'nanoid', 'cuid', 'objectid']
// Objects that host a generator. A member call mints only on one of these: `node.uuid()` reads back
// an id the node already carries.
const MINTER_HOSTS: ReadonlySet<string> = new Set(['crypto', 'uuid', 'nanoid', 'cuid', 'bson', 'types'])
const UUID_HOST = 'uuid'
// uuid's v3 and v5 hash their input, so the same row gets the same id: a stable key.
const UUID_FACTORIES: ReadonlySet<string> = new Set(['v1', 'v4', 'v6', 'v7'])
// The iterators that build a list of siblings, the only place a key must be stable across renders.
const LIST_ITERATORS: ReadonlySet<string> = new Set(['map', 'forEach', 'flatMap'])
const FUNCTION_TYPES: ReadonlySet<string> = new Set([
  AST_NODE_TYPES.ArrowFunctionExpression,
  AST_NODE_TYPES.FunctionDeclaration,
  AST_NODE_TYPES.FunctionExpression,
  AST_NODE_TYPES.TSEmptyBodyFunctionExpression,
])

function filledKeyMintersOf({ minters }: KeyMinters): Required<KeyMinters> {
  if (minters === undefined) {
    throw new Error('no-unstable-list-keys ran without meta.defaultOptions applied to its options')
  }
  return { minters }
}

function iteratorNameOf(callee: TSESTree.Expression): string | null {
  return callee.type === AST_NODE_TYPES.MemberExpression && callee.property.type === AST_NODE_TYPES.Identifier
    ? callee.property.name
    : null
}

// The nearest named object: `window.crypto.randomUUID` is hosted by `crypto`.
function hostNameOf(object: TSESTree.Expression): string | null {
  if (object.type === AST_NODE_TYPES.Identifier) return object.name
  return object.type === AST_NODE_TYPES.MemberExpression && object.property.type === AST_NODE_TYPES.Identifier
    ? object.property.name
    : null
}

// Each ancestor with the node it was reached from, nearest first. Stops at the Program, whose
// `parent` is null at runtime although its type says undefined.
function parentLinksOf(node: TSESTree.Node): ParentLink[] {
  const links: ParentLink[] = []
  for (let child: TSESTree.Node = node; child.type !== AST_NODE_TYPES.Program; child = child.parent) {
    links.push({ child, parent: child.parent })
  }
  return links
}

// The `key` attribute the call sits in. A function boundary ends the search: `key={() => uuid()}`
// mints nothing during reconciliation.
function keyAttributeAround(node: TSESTree.Node): TSESTree.JSXAttribute | null {
  for (const { child, parent } of parentLinksOf(node)) {
    if (FUNCTION_TYPES.has(parent.type)) return null
    if (parent.type !== AST_NODE_TYPES.JSXAttribute) continue
    return jsxAttributeName(parent) === 'key' && parent.value === child ? parent : null
  }
  return null
}

function isListIteration(callee: TSESTree.Expression): boolean {
  const iterator = iteratorNameOf(callee)
  return iterator !== null && LIST_ITERATORS.has(iterator)
}

// A lone `key={uuid()}` has no siblings to reconcile against, so only list callbacks count.
function isInsideListCallback(node: TSESTree.Node): boolean {
  return parentLinksOf(node).some(
    ({ child, parent }) =>
      parent.type === AST_NODE_TYPES.CallExpression &&
      parent.arguments.some((argument) => argument === child) &&
      isListIteration(parent.callee),
  )
}

// Compared lowercased, as the minter names are.
function isHostedMinter(host: string, method: string, minterNames: ReadonlySet<string>): boolean {
  const hostName = host.toLowerCase()
  const methodName = method.toLowerCase()
  if (!MINTER_HOSTS.has(hostName)) return false
  return minterNames.has(methodName) || (hostName === UUID_HOST && UUID_FACTORIES.has(methodName))
}

// The generator a callee names, as written so the message can quote it, or null.
function minterNamedBy(callee: TSESTree.Expression, minterNames: ReadonlySet<string>): string | null {
  if (callee.type === AST_NODE_TYPES.Identifier) return minterNames.has(callee.name.toLowerCase()) ? callee.name : null
  if (callee.type !== AST_NODE_TYPES.MemberExpression || callee.property.type !== AST_NODE_TYPES.Identifier) return null
  const host = hostNameOf(callee.object)
  const method = callee.property.name
  return host !== null && isHostedMinter(host, method, minterNames) ? `${host}.${method}` : null
}

// Not fixable: the stable key lives in the data, and a fixer guessing `item.id` would key every row on undefined.
export const noUnstableListKeys = ESLintUtils.RuleCreator.withoutDocs<Options, 'unstable'>({
  meta: {
    type: 'problem',
    docs: { description: 'Disallow list keys minted by an id generator during render' },
    messages: {
      unstable:
        'This key calls {{minter}}(), so every render mints a new key and React unmounts and remounts the row -- losing focus, scroll position and anything typed into it. Key on something stable in the data (item.id, or a composite of the fields that identify the row), or mint the id once where the list is built.',
    },
    schema: [
      {
        type: 'object',
        properties: { minters: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ minters: ID_MINTERS }],
  },
  create(context, [options]) {
    const { minters } = filledKeyMintersOf(options)
    const minterNames: ReadonlySet<string> = new Set(minters.map((minter) => minter.toLowerCase()))

    const check = (node: TSESTree.CallExpression | TSESTree.NewExpression): void => {
      const minter = minterNamedBy(node.callee, minterNames)
      if (minter === null) return
      const attribute = keyAttributeAround(node)
      if (attribute === null || !isInsideListCallback(attribute)) return
      context.report({ node, messageId: 'unstable', data: { minter } })
    }

    return {
      CallExpression: check,
      // `new ObjectId()` mints exactly as freshly as `objectId()`.
      NewExpression: check,
    }
  },
})
