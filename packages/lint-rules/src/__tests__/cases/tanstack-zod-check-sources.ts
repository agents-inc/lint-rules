// What check does with the TanStack Query, TanStack Router and zod rules the owner accepted: two report and keep their
// fix withheld, and with the two property-order rules left out, the ordering ruleset's sort-objects sorts the options
// of the calls they would order. Each fix was measured by running the plugin's
// (@tanstack/eslint-plugin-query 5.104.5, @tanstack/eslint-plugin-router 1.162.0, eslint-plugin-zod 5.2.2).

type ReportedFile = { readonly file: string; readonly source: string; readonly line: number; readonly rule: string }

/**
 * Each file a withheld fix would rewrite, in path order as check prints their findings. The zod fix moves `.trim()`
 * before `.min(1)`, and the TanStack fix wraps the client in `React.useState`, which this file never imports.
 */
export const FILES_A_WITHHELD_FIX_WOULD_REWRITE: readonly ReportedFile[] = [
  {
    file: 'src/checked-before-trim.ts',
    source: `import { z } from 'zod'

export const Name = z.string().min(1).trim()
`,
    line: 3,
    rule: 'zod/prefer-trim-before-string-length-checks',
  },
  {
    file: 'src/client-in-component.tsx',
    source: `import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient()
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
`,
    line: 5,
    rule: '@tanstack/query/stable-query-client',
  },
]

type SortedFile = { readonly file: string; readonly source: string; readonly linesSortObjectsReports: readonly number[] }

/**
 * Options out of alphabetical order passed to each call named as one the two TanStack property-order rules order, a
 * spread between their keys included, Hono's createRoute among them, in path order: with the rules left out, sort-objects
 * reports each as it reports any other call's.
 */
export const OPTIONS_OF_CALLS_THE_PROPERTY_ORDER_RULES_NAME: readonly SortedFile[] = [
  {
    file: 'src/hono-create-route.ts',
    source: `import { createRoute } from '@hono/zod-openapi'

export const route = createRoute({
  path: '/stacks',
  method: 'get',
  responses: {},
})
`,
    linesSortObjectsReports: [5],
  },
  {
    file: 'src/infinite-query-with-a-spread.ts',
    source: `import { useInfiniteQuery } from '@tanstack/react-query'

declare function fetchPage(page: number): Promise<{ items: string[]; next: number }>
declare const sharedPaging: { readonly queryFn: () => Promise<{ items: string[]; next: number }> }

export function usePages() {
  return useInfiniteQuery({
    queryKey: ['pages'],
    getNextPageParam: (last) => last.next,
    ...sharedPaging,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 0,
  })
}
`,
    linesSortObjectsReports: [9, 12],
  },
  {
    file: 'src/loader-before-loader-deps.ts',
    source: `import { createRootRoute, createRoute } from '@tanstack/react-router'

const rootRoute = createRootRoute()

export const route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/posts',
  loader: ({ deps }) => deps.search,
  loaderDeps: ({ search }) => ({ search }),
})
`,
    linesSortObjectsReports: [8],
  },
  {
    file: 'src/next-page-before-query-fn.ts',
    source: `import { useInfiniteQuery } from '@tanstack/react-query'

declare function fetchPage(page: number): Promise<{ items: string[]; next: number }>

export function usePages() {
  return useInfiniteQuery({
    queryKey: ['pages'],
    getNextPageParam: (last) => last.next,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 0,
  })
}
`,
    linesSortObjectsReports: [8, 10],
  },
  {
    file: 'src/route-with-a-spread.ts',
    source: `import { createRootRoute, createRoute } from '@tanstack/react-router'

const rootRoute = createRootRoute()
const sharedLoading = { loaderDeps: () => ({ search: 'shared' }) }

export const route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/posts',
  loader: ({ deps }) => deps.search,
  ...sharedLoading,
  loaderDeps: ({ search }) => ({ search }),
})
`,
    linesSortObjectsReports: [9],
  },
]

/**
 * Route options in alphabetical order that spread a condition's or a call's result, in a TanStack route and in Hono's
 * createRoute: the Router property-order rule throws on such a spread, so check would leave each file unchecked.
 */
export const OPTIONS_SPREADING_A_CONDITION_OR_A_CALL: ReadonlyArray<{ readonly file: string; readonly source: string }> = [
  {
    file: 'src/conditional-spread-in-file-route.ts',
    source: `import { createFileRoute } from '@tanstack/react-router'

declare const devOnly: boolean

export const Route = createFileRoute('/posts')({
  component: () => null,
  ...(devOnly ? { ssr: false } : {}),
})
`,
  },
  {
    file: 'src/hono-route-spreading-a-call.ts',
    source: `import { createRoute } from '@hono/zod-openapi'

declare function openApiDefaults(): { readonly tags: string[] }

export const route = createRoute({
  method: 'get',
  path: '/stacks',
  responses: {},
  ...openApiDefaults(),
})
`,
  },
]

/** The same options passed to a call no TanStack rule orders: sort-objects reports each key out of alphabetical order. */
export const OPTIONS_PASSED_TO_ANOTHER_CALL = {
  file: 'src/configure-pages.ts',
  source: `declare function configurePages(options: object): void

configurePages({
  queryKey: ['pages'],
  queryFn: () => 1,
  initialPageParam: 0,
  getNextPageParam: () => 2,
})
`,
  linesReported: [5, 6, 7],
  rule: 'perfectionist/sort-objects',
} as const
