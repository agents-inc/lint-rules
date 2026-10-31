// Reducers for the house port of anti-slop/no-reduce-accumulator-copy (dmmulroy/anti-slop, commit c44ef22). A reducer
// that copies its accumulator on every step does quadratic work: flatMap, map or Object.fromEntries build the result
// in one pass.

/** The candidates page's example: each step concatenates the tags so far into a new array. */
export const tagsCollectedByConcat = `type Post = { tags: string[] }

export const allTags = (posts: Post[]) => posts.reduce<string[]>((tags, post) => tags.concat(post.tags), [])
`

/** The page's fix: flatMap builds the one array in one pass. */
export const tagsCollectedByFlatMap = `type Post = { tags: string[] }

export const allTags = (posts: Post[]) => posts.flatMap((post) => post.tags)
`

/** The page's example as JavaScript, whose receiver carries no type. */
export const tagsCollectedByConcatAsJavaScript = `export const allTags = (posts) => posts.reduce((tags, post) => tags.concat(post.tags), [])
`

export const idsCopiedBySlice = `export const seenIds = (ids: readonly string[]) =>
  ids.reduce<string[]>((seen, id) => {
    const next = seen.slice()
    next.push(id)
    return next
  }, [])
`

export const idsCopiedByArrayFrom = `export const seenIds = (ids: readonly string[]) =>
  ids.reduce<string[]>((seen, id) => {
    const next = Array.from(seen)
    next.push(id)
    return next
  }, [])
`

export const boardCopiedByToSorted = `export const leaderboard = (scores: readonly number[]) =>
  scores.reduce<number[]>((board, score) => {
    const ranked = board.toSorted((left, right) => right - left)
    ranked.push(score)
    return ranked
  }, [])
`

/** A named function expression: upstream, matching by oxlint's `.start`, finds the function's name, not its accumulator. */
export const tagsCollectedByANamedReducer = `type Post = { tags: string[] }

export const allTags = (posts: Post[]) =>
  posts.reduce<string[]>(function collectTags(tags, post) {
    return tags.concat(post.tags)
  }, [])
`

/** A receiver read from a call, with no local sign it is an array: upstream PR #51's opt-in guard silences it. */
export const groupsJoinedFromObjectValues = `export const flattenGroups = (groups: Record<string, string[]>) =>
  Object.values(groups).reduce<string[]>((all, group) => all.concat(group), [])
`

/** A receiver whose type is inferred from a call: PR #51's guard silences it too. */
export const cellsJoinedFromAnInferredReceiver = `declare function loadRows(): string[][]

export const allCells = () => {
  const rows = loadRows()
  return rows.reduce<string[]>((cells, row) => cells.concat(row), [])
}
`

/** A reducer whose accumulator is a number, which nothing copies. */
export const totalOfPrices = `type Item = { price: number }

export const cartTotal = (items: Item[]) => items.reduce((total, item) => total + item.price, 0)
`

/** An object accumulator copied by Object.assign on every step. */
export const usersIndexedByObjectAssign = `type User = { id: string }

export const usersById = (users: User[]) =>
  users.reduce<Record<string, User>>((index, user) => Object.assign({}, index, { [user.id]: user }), {})
`

/** Its fix: Object.fromEntries builds the index in one pass. */
export const usersIndexedByObjectFromEntries = `type User = { id: string }

export const usersById = (users: User[]) => Object.fromEntries(users.map((user) => [user.id, user]))
`

/** A spread copy, which oxc/no-accumulating-spread reports. */
export const tagsCollectedBySpread = `type Post = { tags: string[] }

export const allTags = (posts: Post[]) => posts.reduce<string[]>((tags, post) => [...tags, ...post.tags], [])
`

/** concat in a loop, which unicorn/no-array-concat-in-loop reports. */
export const tagsCollectedByConcatInALoop = `export const allTags = (posts: { tags: string[] }[]) => {
  let tags: string[] = []
  for (const post of posts) tags = tags.concat(post.tags)
  return tags
}
`

/** Upstream's own report cases at c44ef22, by what each shows: every copy is on line 1. */
export const UPSTREAM_REPORTED: Readonly<Record<string, string>> = {
  'reports Object.assign copying the accumulator into a new object': 'items.reduce((acc, item) => Object.assign({}, acc, { [item.id]: item }), {});',
  'reports a copy in a reduceRight callback': 'items.reduceRight((acc, item) => Object.assign({}, acc, item), {});',
  'reports a copy in a reducer that also takes the index and the array': 'items.reduce((acc, item, index, array) => Object.assign({}, acc, item), {});',
  'reports a copy in a reducer of one parameter': 'items.reduce(acc => Object.assign({}, acc), {});',
  'reports a copy in an anonymous function expression, the accumulator a later source': 'items.reduce(function (acc, item) { return Object.assign({}, item, acc); }, {});',
  'reports a copy through computed member names': "items['reduce'](((acc, item) => Object['assign']({}, acc, item)), {});",
  'reports a copy of an accumulator with a default value': 'items.reduce((acc = {}, item) => Object.assign({}, acc, item), {});',
  'reports Object.assign copying a const alias of the accumulator': 'items.reduce((acc, item) => { const alias = acc; return Object.assign({}, alias, item); }, {});',
  'reports a copy of the accumulator under a type assertion': 'items.reduce((acc, item) => Object.assign({}, acc as State, item), {});',
  'reports a copy the reducer fills and returns': 'items.reduce((acc, item) => { const next = Object.assign({}, acc); next[item.id] = item; return next; }, {});',
  'reports concat on an accumulator started from an array literal': 'items.reduce((acc, item) => acc.concat([item]), []);',
  'reports a computed concat in reduceRight, started from an asserted array': "items.reduceRight((acc, item, index) => acc['concat']([item]), [] as Item[]);",
  'reports slice copying the accumulator': 'items.reduce((acc, item) => { const next = acc.slice(); next.push(item); return next; }, []);',
  'reports concat on a const alias of the accumulator': 'items.reduce((acc, item) => { const alias = acc; return alias.concat(item); }, []);',
  'reports concat on an accumulator started from a const array': 'const initial = []; items.reduce((acc, item) => acc.concat(item), initial);',
  'reports Array.from copying the accumulator': 'items.reduce((acc, item) => { const next = Array.from(acc); next.push(item); return next; }, []);',
  'reports toSpliced copying the accumulator': 'items.reduce((acc, item) => acc.toSpliced(acc.length, 0, item), []);',
  'reports toSorted copying the accumulator': 'items.reduce((acc, item) => acc.toSorted(), []);',
  'reports toReversed copying the accumulator': 'items.reduce((acc, item) => acc.toReversed(), []);',
  'reports with copying the accumulator': 'items.reduce((acc, item) => acc.with(0, item), []);',
}

/** Upstream's own silent cases at c44ef22, by what each shows. */
export const UPSTREAM_SILENT: Readonly<Record<string, string>> = {
  'stays silent on a reducer that pushes onto its accumulator and returns it': 'items.reduce((acc, item) => { acc.push(item); return acc; }, []);',
  'stays silent on Object.assign into the accumulator itself': 'items.reduce((acc, item) => Object.assign(acc, item), {});',
  'stays silent on Object.assign into the accumulator that also names it as a source': 'items.reduce((acc, item) => Object.assign(acc, acc, item), {});',
  'stays silent on a key of the accumulator set to a copied item': 'items.reduce((acc, item) => { acc[item.id] = { ...item }; return acc; }, {});',
  'stays silent on a copy of the item pushed onto the accumulator': 'items.reduce((acc, item) => { acc.push(Object.assign({}, item)); return acc; }, []);',
  'stays silent on a slice of the item pushed onto the accumulator': 'items.reduce((acc, item) => { acc.push(item.slice()); return acc; }, []);',
  'stays silent on concat on a string accumulator': "items.reduce((acc, item) => acc.concat(item), '');",
  'stays silent on concat on an accumulator started from a value it cannot see is an array': 'items.reduce((acc, item) => acc.concat(item), customCollection);',
  'stays silent on a copy outside any reducer': 'function copy(acc) { return Object.assign({}, acc); }',
  'stays silent on a copy in a map callback': 'items.map((acc, item) => Object.assign({}, acc));',
  'stays silent on a copy in a function declared inside the reducer': 'items.reduce((acc, item) => { function copy(acc) { return Object.assign({}, acc); } return acc; }, {});',
  'stays silent on a copy in a closure the reducer makes but never calls': 'items.reduce((acc, item) => { const snapshot = () => Object.assign({}, acc); return acc; }, {});',
  'stays silent on a copy of a block variable that shadows the accumulator': 'items.reduce((acc, item) => { { const acc = {}; Object.assign({}, acc); } return acc; }, {});',
  'stays silent on Object.assign when Object is a local binding': 'const Object = custom; items.reduce((acc, item) => Object.assign({}, acc), {});',
  'stays silent on Object.assign when Object is a parameter': 'function run(Object) { return items.reduce((acc, item) => Object.assign({}, acc), {}); }',
  'stays silent on Array.from when Array is a local binding': 'const Array = custom; items.reduce((acc, item) => Array.from(acc), []);',
  'stays silent on a copy of a let alias reassigned away from the accumulator': 'items.reduce((acc, item) => { let alias = acc; alias = item; return Object.assign({}, alias); }, {});',
  'stays silent on an array spread copy, which oxc/no-accumulating-spread reports': 'items.reduce((acc, item) => [...acc, item], []);',
  'stays silent on an object spread copy, which oxc/no-accumulating-spread reports': 'items.reduce((acc, item) => ({ ...acc, [item.id]: item }), {});',
}

/** Calls that look like a reducer's copy but are none, or whose initial value the file does not show is an array. */
export const LOOKALIKES_SILENT: Readonly<Record<string, string>> = {
  'stays silent on a reduce given a third argument, which is no Array#reduce': 'items.reduce((acc, item) => acc.concat(item), [], extra);',
  'stays silent on a private method named like an array copy method':
    'class Tags { #concat(tag) { return this; } collect(tags) { return tags.reduce((acc, tag) => acc.#concat(tag), []); } }',
  'stays silent on an initial value from an annotated let reassigned after its declaration':
    'let initial: string[] = []; initial = loadTags(); items.reduce((acc, item) => acc.concat(item), initial);',
  'stays silent on an initial value destructured out of an array literal': "const [initial] = ['']; items.reduce((acc, item) => acc.concat(item), initial);",
  'stays silent on an initial value from a parameter it cannot see is an array':
    'function collect(items, initial) { return items.reduce((acc, item) => acc.concat(item), initial); }',
  'stays silent, and returns, on const initial values that refer to each other':
    'const first = second; const second = first; items.reduce((acc, item) => acc.concat(item), first);',
  'stays silent, and returns, on consts in the reducer that refer to each other':
    'items.reduce((acc, item) => { const first = second; const second = first; return first.concat(item); }, []);',
  'stays silent on an initial value annotated as no array, over an array literal':
    'const initial: Iterable<string> = []; items.reduce((acc, item) => acc.concat(item), initial);',
  'stays silent on an initial value annotated keyof an array type': "const initial: keyof string[] = 'length'; items.reduce((acc, item) => acc.concat(item), initial);",
  'stays silent on from called on a global other than Array': 'items.reduce((acc, item) => Iterator.from(acc), []);',
  'stays silent on an initial value a known array joins into a string': "items.reduce((acc, item) => acc.concat(item), ['a', 'b'].join(''));",
  'stays silent on an Object method other than assign': 'items.reduce((acc, item) => (Object.is({}, acc) ? item : acc), {});',
  'stays silent on an Array method other than from': 'items.reduce((acc, item) => (Array.isArray(acc) ? acc : [acc]), []);',
  'stays silent on Array.from of the item pushed onto the accumulator': 'items.reduce((acc, item) => { acc.push(...Array.from(item)); return acc; }, []);',
}

/** Copies on an initial value the file shows is an array, and on an accumulator under a TypeScript wrapper; each on line 1. */
export const KNOWN_ARRAYS_REPORTED: Readonly<Record<string, string>> = {
  'reports concat on an initial value annotated as an array and set from a call':
    'const initial: string[] = loadTags(); items.reduce((acc, item) => acc.concat(item), initial);',
  'reports concat on an initial value annotated as a tuple': 'const initial: [string] = loadTags(); items.reduce((acc, item) => acc.concat(item), initial);',
  'reports concat on an initial value annotated as a readonly array':
    'const initial: readonly string[] = loadTags(); items.reduce((acc, item) => acc.concat(item), initial);',
  'reports concat on an initial value annotated Array<string>': 'const initial: Array<string> = loadTags(); items.reduce((acc, item) => acc.concat(item), initial);',
  'reports concat on an initial value annotated ReadonlyArray<string>':
    'const initial: ReadonlyArray<string> = loadTags(); items.reduce((acc, item) => acc.concat(item), initial);',
  'reports concat on an initial value each array-returning method of a known array builds':
    "items.reduce((acc, item) => acc.concat(item), ['a'].map(String).filter(Boolean).flatMap((tag) => [tag]).slice().concat().toSorted().toReversed().toSpliced(0, 0));",
  'reports concat on an initial value sliced from a known array through optional chaining':
    'const tags: string[] = []; items.reduce((acc, item) => acc.concat(item), tags?.slice());',
  'reports concat on an initial value checked with satisfies': 'items.reduce((acc, item) => acc.concat(item), [] satisfies string[]);',
  'reports concat on the accumulator under a non-null assertion': 'items.reduce((acc, item) => acc!.concat(item), []);',
  'reports concat on an initial value from a var redeclared with the same type, annotated second':
    "var seed = ['a']; var seed: string[] = []; items.reduce((acc, item) => acc.concat(item), seed);",
}

/** An angle-bracket assertion, which a .tsx file reads as JSX, so its case lints as .ts. */
export const initialValueUnderAnAngleBracketAssertion = 'items.reduce((acc, item) => acc.concat(item), <string[]>[]);'

/** A var redeclaring the accumulator parameter: one variable with two identifiers, the parameter's first. Linted as .js. */
export const accumulatorParameterRedeclared = 'items.reduce(function (acc, item) { var acc = acc.concat(item); return acc; }, []);'
