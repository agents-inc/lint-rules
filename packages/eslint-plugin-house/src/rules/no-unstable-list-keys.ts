import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils'

import { callReceiving } from '../shared/call-arguments.ts'
import { calleeNameOf, methodNameOf } from '../shared/callee-name.ts'
import { isFunctionNode } from '../shared/function-name.ts'
import { jsxAttributeName } from '../shared/jsx-attributes.ts'
import { defaultedOption, stringListOptionSchema } from '../shared/rule-options.ts'
import { isSameNode } from '../shared/same-node.ts'

// The schema does not require the key: ESLint fills it from meta.defaultOptions when a config omits it.
type KeyMinters = { minters?: readonly string[] }

type Options = [KeyMinters]

type ParentLink = { child: TSESTree.Node; parent: TSESTree.Node }

const RULE_NAME = 'no-unstable-list-keys'

// Compared lowercased: one generator is spelled randomUUID, uuidv4 and ObjectId across packages.
// Math.random() and Date.now() are left to sonarjs/no-uniq-key, so a key is not reported twice.
const ID_MINTERS: readonly string[] = ['randomuuid', 'uuid', 'uuidv4', 'nanoid', 'cuid', 'objectid']
// A member call mints only on one of these: `node.uuid()` reads back an id the node already carries.
const MINTER_HOSTS: ReadonlySet<string> = new Set(['crypto', 'uuid', 'nanoid', 'cuid', 'bson', 'types'])
const UUID_HOST = 'uuid'
// uuid's v3 and v5 hash their input, so the same row gets the same id: a stable key.
const UUID_FACTORIES: ReadonlySet<string> = new Set(['v1', 'v4', 'v6', 'v7'])
// The iterators that build a list of siblings, the only place a key must be stable across renders.
const LIST_ITERATORS: ReadonlySet<string> = new Set(['map', 'forEach', 'flatMap'])

function isFunctionBoundary(node: Readonly<TSESTree.Node>): boolean {
  return isFunctionNode(node) || node.type === AST_NODE_TYPES.TSEmptyBodyFunctionExpression
}

// Nearest first. Stops at the Program, whose `parent` is null at runtime although typed undefined.
function parentLinksOf(node: Readonly<TSESTree.Node>): ParentLink[] {
  if (node.type === AST_NODE_TYPES.Program) return []
  return [{ child: node, parent: node.parent }, ...parentLinksOf(node.parent)]
}

// A function boundary ends the search: `key={() => uuid()}` mints nothing during reconciliation.
function keyAttributeAround(node: Readonly<TSESTree.Node>): TSESTree.JSXAttribute | null {
  for (const { child, parent } of parentLinksOf(node)) {
    if (isFunctionBoundary(parent)) return null
    if (parent.type !== AST_NODE_TYPES.JSXAttribute) continue
    return jsxAttributeName(parent) === 'key' && isSameNode(parent.value, child) ? parent : null
  }
  return null
}

function isListIteration(callee: Readonly<TSESTree.Expression>): boolean {
  const iterator = methodNameOf(callee)
  return iterator !== null && LIST_ITERATORS.has(iterator)
}

function isArgumentOfListIteration({ child, parent }: Readonly<ParentLink>): boolean {
  const call = callReceiving(child, parent)
  return call !== null && isListIteration(call.callee)
}

// A lone `key={uuid()}` has no siblings to reconcile against, so only list callbacks count.
function isInsideListCallback(node: Readonly<TSESTree.Node>): boolean {
  return parentLinksOf(node).some(isArgumentOfListIteration)
}

// Compared lowercased, as the minter names are.
function isHostedMinter(host: string, method: string, minterNames: ReadonlySet<string>): boolean {
  const hostName = host.toLowerCase()
  if (!MINTER_HOSTS.has(hostName)) return false
  const methodName = method.toLowerCase()
  return minterNames.has(methodName) || (hostName === UUID_HOST && UUID_FACTORIES.has(methodName))
}

function minterNamedBy(callee: Readonly<TSESTree.Expression>, minterNames: ReadonlySet<string>): string | null {
  if (callee.type === AST_NODE_TYPES.Identifier) return minterNames.has(callee.name.toLowerCase()) ? callee.name : null
  if (callee.type !== AST_NODE_TYPES.MemberExpression || callee.property.type !== AST_NODE_TYPES.Identifier) return null
  // The nearest named object, read as a callee's name is: `window.crypto.randomUUID` is hosted by `crypto`.
  const host = calleeNameOf(callee.object)
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
    schema: [stringListOptionSchema('minters')],
    defaultOptions: [{ minters: ID_MINTERS }],
  },
  create(context, [options]) {
    const minters = defaultedOption(RULE_NAME, options.minters)
    const minterNames: ReadonlySet<string> = new Set(minters.map((minter) => minter.toLowerCase()))

    function check(node: Readonly<TSESTree.CallExpression | TSESTree.NewExpression>): void {
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
