import type { RuleCase } from './changed-settings.ts'

export const HOUSE_REDUCE_RULE = 'house/no-reduce-accumulator-copy'

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
