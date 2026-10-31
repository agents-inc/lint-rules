import type { RuleCase } from './changed-settings.ts'

// The reduce-accumulator rule the owner accepted on the old candidates page on 2026-10-11, ported as a house rule: it
// reports a reducer that copies its accumulator on every step, in TypeScript and in JavaScript, and stays silent on the
// page's flatMap fix and on a reducer whose accumulator is a number.

export const HOUSE_REDUCE_RULE = 'house/no-reduce-accumulator-copy'

/** The house port's report cases beside its silent twins. */
export const ACCEPTED_1011_HRA_CASES: readonly RuleCase[] = [
  {
    rule: HOUSE_REDUCE_RULE,
    silentIn: [
      {
        path: 'src/all-tags-by-flat-map.ts',
        source: `type Post = { tags: string[] }

export const allTags = (posts: Post[]) => posts.flatMap((post) => post.tags)
`,
      },
      {
        path: 'src/cart-total.ts',
        source: `type Item = { price: number }

export const cartTotal = (items: Item[]) => items.reduce((total, item) => total + item.price, 0)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/all-tags-by-concat.ts',
        source: `type Post = { tags: string[] }

export const allTags = (posts: Post[]) => posts.reduce<string[]>((tags, post) => tags.concat(post.tags), [])
`,
      },
      {
        path: 'src/all-tags-by-concat.js',
        source: `export const allTags = (posts) => posts.reduce((tags, post) => tags.concat(post.tags), [])
`,
      },
    ],
  },
]
