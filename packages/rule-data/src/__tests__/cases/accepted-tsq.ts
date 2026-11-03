import type { HeldCase } from '../accepted-rules-out-of-place.ts'
import type { CaseFile } from '../rule-case-runs.ts'
import type { RuleCase } from './changed-settings.ts'

// The plugins find TanStack by a file's import source, so no case installs it.

export const PROPERTY_ORDER_LEFT_OUT_BY = 'q-lint-rc-tanstack-property-order-which-skip'

/** Each accepted @tanstack/query rule's report case beside its silent twin, in the order of their IDs. */
export const ACCEPTED_TANSTACK_QUERY_CASES: readonly RuleCase[] = [
  // A value declared outside the hook is the same on every render, so the key need not hold it.
  {
    rule: '@tanstack/query/exhaustive-deps',
    silentIn: [
      {
        path: 'src/key-holding-every-dependency.ts',
        source: `import { useQuery } from '@tanstack/react-query'

declare function fetchClients(nodeIds: string[]): Promise<string[]>

export function useClients(nodeIds: string[]) {
  return useQuery({ queryKey: ['clients', nodeIds], queryFn: () => fetchClients(nodeIds) })
}
`,
      },
      {
        path: 'src/module-constant-dependency.ts',
        source: `import { useQuery } from '@tanstack/react-query'

declare function fetchClients(region: string): Promise<string[]>

const REGION = 'eu-west-1'

export function useClients() {
  return useQuery({ queryKey: ['clients'], queryFn: () => fetchClients(REGION) })
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/key-missing-a-dependency.ts',
        source: `import { useQuery } from '@tanstack/react-query'

declare function fetchClients(nodeIds: string[]): Promise<string[]>

export function useClients(nodeIds: string[]) {
  return useQuery({ queryKey: ['clients'], queryFn: () => fetchClients(nodeIds) })
}
`,
      },
    ],
  },
  // Only TanStack's hooks are tracked: another library's useQuery is left alone.
  {
    rule: '@tanstack/query/no-rest-destructuring',
    silentIn: [
      {
        path: 'src/named-query-fields.ts',
        source: `import { useQuery } from '@tanstack/react-query'

declare function fetchTodos(): Promise<string[]>

export function useTodoList() {
  const { data, isPending } = useQuery({ queryKey: ['todos'], queryFn: fetchTodos })
  return { todos: data ?? [], isPending }
}
`,
      },
      {
        path: 'src/rest-of-another-librarys-query.ts',
        source: `import { useQuery } from '@apollo/client'

declare const TODOS_QUERY: object

export function useTodoList() {
  const { data, ...rest } = useQuery(TODOS_QUERY)
  return { todos: data, rest }
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/rest-of-query-result.ts',
        source: `import { useQuery } from '@tanstack/react-query'

declare function fetchTodos(): Promise<string[]>

export function useTodoList() {
  const { data, ...rest } = useQuery({ queryKey: ['todos'], queryFn: fetchTodos })
  return { todos: data ?? [], rest }
}
`,
      },
    ],
  },
  // useQueries with combine returns a result that keeps its identity between renders.
  {
    rule: '@tanstack/query/no-unstable-deps',
    silentIn: [
      {
        path: 'src/destructured-mutate-in-deps.ts',
        source: `import { useMutation } from '@tanstack/react-query'
import { useCallback } from 'react'

declare function save(): Promise<void>

export function useSave() {
  const { mutate } = useMutation({ mutationFn: save })
  return useCallback(() => mutate(), [mutate])
}
`,
      },
      {
        path: 'src/combined-queries-in-deps.ts',
        source: `import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'

declare function fetchUserName(id: string): Promise<string>

export function useUserNames(ids: string[]) {
  const names = useQueries({
    queries: ids.map((id) => ({ queryKey: ['user', id], queryFn: () => fetchUserName(id) })),
    combine: (results) => results.map(({ data }) => data),
  })
  return useMemo(() => names.join(', '), [names])
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/whole-mutation-in-deps.ts',
        source: `import { useMutation } from '@tanstack/react-query'
import { useCallback } from 'react'

declare function save(): Promise<void>

export function useSave() {
  const mutation = useMutation({ mutationFn: save })
  return useCallback(() => mutation.mutate(), [mutation])
}
`,
      },
    ],
  },
  // TanStack Query takes null as data; only undefined is refused.
  {
    rule: '@tanstack/query/no-void-query-fn',
    silentIn: [
      {
        path: 'src/query-fn-returning-a-value.ts',
        source: `import { useQuery } from '@tanstack/react-query'

declare function refreshCache(): Promise<number>

export function useRefresh() {
  return useQuery({ queryKey: ['refresh'], queryFn: () => refreshCache() })
}
`,
      },
      {
        path: 'src/query-fn-returning-null.ts',
        source: `import { useQuery } from '@tanstack/react-query'

declare function refreshCache(): Promise<void>

export function useRefresh() {
  return useQuery({
    queryKey: ['refresh'],
    queryFn: async () => {
      await refreshCache()
      return null
    },
  })
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/query-fn-returning-nothing.ts',
        source: `import { useQuery } from '@tanstack/react-query'

declare function refreshCache(): Promise<void>

export function useRefresh() {
  return useQuery({
    queryKey: ['refresh'],
    queryFn: async () => {
      await refreshCache()
    },
  })
}
`,
      },
    ],
  },
  // A client held in state lives as long as the component, and a server component's lives for one request.
  {
    rule: '@tanstack/query/stable-query-client',
    silentIn: [
      {
        path: 'src/client-in-module.tsx',
        source: `import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const queryClient = new QueryClient()

export function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
`,
      },
      {
        path: 'src/client-in-state.tsx',
        source: `import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
`,
      },
      {
        path: 'src/client-in-server-component.tsx',
        source: `import { QueryClient } from '@tanstack/react-query'

declare function prefetchPostTitle(client: QueryClient): Promise<string>

export async function PostPage() {
  const queryClient = new QueryClient()
  return <h1>{await prefetchPostTitle(queryClient)}</h1>
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/client-in-component.tsx',
        source: `import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient()
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
`,
      },
    ],
  },
]

/** Each accepted @tanstack/router rule's report case beside its silent twin, in the order of their IDs. */
export const ACCEPTED_TANSTACK_ROUTER_CASES: readonly RuleCase[] = [
  // A splat names no param, and an optional param's name is what follows its -$.
  {
    rule: '@tanstack/router/route-param-names',
    silentIn: [
      {
        path: 'src/camel-case-param.ts',
        source: `import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/users/$userId')({ component: () => null })
`,
      },
      {
        path: 'src/splat-and-optional-params.ts',
        source: `import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/{-$locale}/files/$')({ component: () => null })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/hyphenated-param.ts',
        source: `import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/users/$user-id')({ component: () => null })
`,
      },
      {
        path: 'src/hyphenated-param-in-path-option.ts',
        source: `import { createRootRoute, createRoute } from '@tanstack/react-router'

const rootRoute = createRootRoute()

export const route = createRoute({ getParentRoute: () => rootRoute, path: '/users/$user-id' })
`,
      },
    ],
  },
]

export const ACCEPTED_TSQ_HELD_CASES: ReadonlyArray<HeldCase<RuleCase>> = []

export const TANSTACK_PROPERTY_ORDER_RULES: readonly string[] = ['@tanstack/query/infinite-query-property-order', '@tanstack/router/create-route-property-order']

const OPTIONS_IN_TANSTACK_ORDER: readonly CaseFile[] = [
  {
    path: 'src/infinite-query-in-tanstack-order.ts',
    source: `import { useInfiniteQuery } from '@tanstack/react-query'

declare function fetchPage(page: number): Promise<{ items: string[]; next: number }>

export function usePages() {
  return useInfiniteQuery({
    queryKey: ['pages'],
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    getNextPageParam: (last) => last.next,
    initialPageParam: 0,
  })
}
`,
  },
  {
    path: 'src/suspense-infinite-query-in-tanstack-order.ts',
    source: `import { useSuspenseInfiniteQuery } from '@tanstack/react-query'

declare function fetchPage(page: number): Promise<{ items: string[]; next: number }>

export function usePages() {
  return useSuspenseInfiniteQuery({
    queryKey: ['pages'],
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    getNextPageParam: (last) => last.next,
    initialPageParam: 0,
  })
}
`,
  },
  {
    path: 'src/infinite-query-options-in-tanstack-order.ts',
    source: `import { infiniteQueryOptions } from '@tanstack/react-query'

declare function fetchPage(page: number): Promise<{ items: string[]; next: number }>

export const pagesQuery = infiniteQueryOptions({
  queryKey: ['pages'],
  queryFn: ({ pageParam }) => fetchPage(pageParam),
  getNextPageParam: (last) => last.next,
  initialPageParam: 0,
})
`,
  },
  {
    path: 'src/root-route-in-tanstack-order.ts',
    source: `import { createRootRoute } from '@tanstack/react-router'

export const rootRoute = createRootRoute({
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ deps }) => deps.search,
})
`,
  },
  {
    path: 'src/route-in-tanstack-order.ts',
    source: `import { createRootRoute, createRoute } from '@tanstack/react-router'

const rootRoute = createRootRoute()

export const route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/posts',
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ deps }) => deps.search,
})
`,
  },
  {
    path: 'src/file-route-in-tanstack-order.ts',
    source: `import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts')({
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ deps }) => deps.search,
})
`,
  },
  {
    path: 'src/root-route-with-context-in-tanstack-order.ts',
    source: `import { createRootRouteWithContext } from '@tanstack/react-router'

type RouterContext = { readonly user: string }

export const Route = createRootRouteWithContext<RouterContext>()({
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ deps }) => deps.search,
})
`,
  },
]

const OPTIONS_SORT_OBJECTS_SORTS: readonly CaseFile[] = [
  {
    path: 'src/infinite-query-order-passed-to-another-call.ts',
    source: `declare function fetchPage(page: number): Promise<{ items: string[]; next: number }>
declare function configurePages(options: object): void

configurePages({
  queryKey: ['pages'],
  queryFn: ({ pageParam }: { pageParam: number }) => fetchPage(pageParam),
  getNextPageParam: (last: { next: number }) => last.next,
  initialPageParam: 0,
})
`,
  },
  {
    path: 'src/query-options-unsorted.ts',
    source: `import { useQuery } from '@tanstack/react-query'

declare function fetchTodos(): Promise<string[]>

export function useTodos() {
  return useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
  })
}
`,
  },
  {
    path: 'src/object-nested-in-infinite-query-options.ts',
    source: `import { useInfiniteQuery } from '@tanstack/react-query'

declare function fetchPage(page: number): Promise<{ items: string[]; next: number }>

export function usePages() {
  return useInfiniteQuery({
    queryKey: ['pages'],
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    getNextPageParam: (last) => last.next,
    initialPageParam: 0,
    meta: { source: 'pages', label: 'Pages' },
  })
}
`,
  },
]

const OPTIONS_OF_ANOTHER_LIBRARYS_CALL_OF_THOSE_NAMES: readonly CaseFile[] = [
  {
    path: 'src/hono-create-route.ts',
    source: `import { createRoute } from '@hono/zod-openapi'

export const route = createRoute({
  path: '/stacks',
  method: 'get',
  responses: {},
})
`,
  },
  {
    path: 'src/pinia-colada-infinite-query.ts',
    source: `import { useInfiniteQuery } from '@pinia/colada'

declare function fetchPage(page: number): Promise<{ items: string[]; next: number }>

export function usePages() {
  return useInfiniteQuery({
    key: ['pages'],
    query: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.next,
  })
}
`,
  },
]

export const SORT_OBJECTS_ON_THE_PROPERTY_ORDER_CALLS: RuleCase = {
  rule: 'perfectionist/sort-objects',
  subject: 'the options of the calls the TanStack property-order rules would order',
  silentIn: [
    {
      path: 'src/options-in-alphabetical-order.ts',
      source: `declare function fetchPage(page: number): Promise<{ items: string[]; next: number }>
declare function configurePages(options: object): void

configurePages({
  getNextPageParam: (last: { next: number }) => last.next,
  initialPageParam: 0,
  queryFn: ({ pageParam }: { pageParam: number }) => fetchPage(pageParam),
  queryKey: ['pages'],
})
`,
    },
  ],
  reportedIn: [...OPTIONS_IN_TANSTACK_ORDER, ...OPTIONS_SORT_OBJECTS_SORTS, ...OPTIONS_OF_ANOTHER_LIBRARYS_CALL_OF_THOSE_NAMES],
}
