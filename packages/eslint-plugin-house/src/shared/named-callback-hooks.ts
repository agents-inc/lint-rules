// Effect hooks whose callback must be a named function expression: an anonymous one shows as
// `anonymous` in stack traces and React DevTools. named-hook-callback requires the name.
export const NAMED_CALLBACK_HOOKS: readonly string[] = ['useEffect', 'useLayoutEffect', 'useInsertionEffect']
