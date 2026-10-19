// Source texts the scan for look-ups written out by hand reads: each it finds, with the lines, and each it leaves.

export type SourceWritingOutALookUp = { readonly how: string; readonly source: string; readonly lines: readonly number[] }

export type SourceWritingOutNoLookUp = { readonly how: string; readonly source: string }

/** Its look-up on line 2. */
export const A_LOOK_UP_WRITTEN_OUT = "const route = routes.get(id)\nif (route === undefined) throw new Error('unknown rule ID')\n"

export const A_LOOK_UP_THROUGH_FOUND_OR = "const route = foundOr(routes.get(id), 'unknown rule ID')\n"

export const SOURCES_WRITING_OUT_A_LOOK_UP: readonly SourceWritingOutALookUp[] = [
  { how: 'a throw on the line of its check', source: A_LOOK_UP_WRITTEN_OUT, lines: [2] },
  {
    how: 'a throw in the block of its check',
    source: "const found = scopes.get(scope)\nif (found === undefined) {\n  throw new Error('no such scope')\n}\n",
    lines: [2],
  },
  {
    how: 'a throw after a statement in the block of its check',
    source: "const found = scopes.get(scope)\nif (found === undefined) {\n  const known = [...scopes.keys()].join(', ')\n  throw new Error(`no such scope, only ${known}`)\n}\n",
    lines: [2],
  },
  {
    how: 'a throw after a template placeholder in the block of its check',
    source: "const path = given[key]\nif (path === undefined) {\n  const because = reason === null ? '' : `: ${reason}`\n  throw new Error(`no path${because}`)\n}\n",
    lines: [2],
  },
  {
    how: 'a check for null joined to one for undefined',
    source: "if (shipped === null || shipped.ruleset === undefined) throw new Error('shipped in no ruleset')\n",
    lines: [1],
  },
  {
    how: 'each of two',
    source: "if (first === undefined) throw new Error('no first')\nconst second = rest.at(0)\nif (second === undefined) throw new Error('no second')\n",
    lines: [1, 3],
  },
]

export const SOURCES_WRITING_OUT_NO_LOOK_UP: readonly SourceWritingOutNoLookUp[] = [
  { how: 'a look-up through foundOr', source: A_LOOK_UP_THROUGH_FOUND_OR },
  { how: 'a check for undefined that returns', source: 'if (found === undefined) return []\n' },
  { how: 'a block for undefined that returns, and a throw after it', source: "if (found === undefined) {\n  return []\n}\nthrow new Error('found')\n" },
  { how: 'a one-line block for undefined that returns, and a throw after it', source: "if (found === undefined) { return [] }\nthrow new Error('found')\n" },
  { how: 'a check that something is there', source: "if (found !== undefined) throw new Error('already set')\n" },
  { how: 'a check for undefined joined to another condition', source: "if (result === undefined || rest.length > 0) throw new Error('not one result')\n" },
]
