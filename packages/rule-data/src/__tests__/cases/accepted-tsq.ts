import type { HeldCase } from '../accepted-rules-out-of-place.ts'
import type { RuleCase } from './changed-settings.ts'

// The TanStack Query and TanStack Router rules the owner accepted on 2026-10-24: each reports the card's code and
// stays silent on its corrected form, and on a shape its code or docs say it leaves alone. The plugins find TanStack
// by a file's import source, so no case installs it.

const PROPERTY_ORDER_BESIDE_SORT_OBJECTS = 'q-lint-rc-tanstack-property-order-measured'

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

/**
 * The cases of accepted TanStack rules whose build waits on a card, unrun until the owner answers it: once the rule
 * ships, its case moves to the cases its plugin's rules run.
 *
 * The two property-order rules: where the opt-in ordering ruleset is listed, perfectionist/sort-objects reports the
 * order their fix writes (queryFn before getNextPageParam; loaderDeps before loader, context before beforeLoad), its
 * own fix is withheld, and sorting the object as its report asks undoes theirs, which check then writes again
 * (measured). A blank line between the two groups satisfies both.
 *
 * stable-query-client: check applies its fix, which writes `React.useState(() => new QueryClient())` whether or not
 * the file binds React, so a component importing only named hooks from 'react' throws a ReferenceError when it
 * renders (measured).
 */
export const ACCEPTED_TSQ_HELD_CASES: ReadonlyArray<HeldCase<RuleCase>> = [
  {
    heldBy: PROPERTY_ORDER_BESIDE_SORT_OBJECTS,
    ruleCase: {
      rule: '@tanstack/query/infinite-query-property-order',
      silentIn: [
        {
          path: 'src/query-fn-before-next-page.ts',
          source: `import { useInfiniteQuery } from '@tanstack/react-query'

declare function fetchPage(page: number): Promise<{ items: string[]; next: number }>

export function usePages() {
  return useInfiniteQuery({
    queryKey: ['pages'],
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.next,
  })
}
`,
        },
      ],
      reportedIn: [
        {
          path: 'src/next-page-before-query-fn.ts',
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
        },
      ],
    },
  },
  // A client held in state lives as long as the component, and a server component's lives for one request.
  {
    heldBy: 'q-lint-rc-stable-query-client-fix-measured',
    ruleCase: {
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
  },
  {
    heldBy: PROPERTY_ORDER_BESIDE_SORT_OBJECTS,
    ruleCase: {
      rule: '@tanstack/router/create-route-property-order',
      silentIn: [
        {
          path: 'src/before-load-before-loader.ts',
          source: `import { createRootRoute, createRoute } from '@tanstack/react-router'

const rootRoute = createRootRoute()

export const route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/posts',
  beforeLoad: () => ({ user: 'x' }),
  loader: ({ context }) => context,
})
`,
        },
        {
          path: 'src/loader-deps-before-loader.ts',
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
      ],
      reportedIn: [
        {
          path: 'src/loader-before-before-load.ts',
          source: `import { createRootRoute, createRoute } from '@tanstack/react-router'

const rootRoute = createRootRoute()

export const route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/posts',
  loader: ({ context }) => context,
  beforeLoad: () => ({ user: 'x' }),
})
`,
        },
        {
          path: 'src/loader-before-loader-deps.ts',
          source: `import { createRootRoute, createRoute } from '@tanstack/react-router'

const rootRoute = createRootRoute()

export const route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/posts',
  loader: ({ deps }) => deps.search,
  loaderDeps: ({ search }) => ({ search }),
})
`,
        },
      ],
    },
  },
]
