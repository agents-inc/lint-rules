// These plugins publish no type declarations. Typed as unknown, they reach the registry only
// through the shape check in eslint-plugins.ts.

declare module 'eslint-plugin-css-modules' {
  const plugin: unknown
  export default plugin
}

declare module 'eslint-plugin-jsx-a11y' {
  const plugin: unknown
  export default plugin
}

declare module 'eslint-plugin-promise' {
  const plugin: unknown
  export default plugin
}

declare module 'eslint-plugin-react-hook-form' {
  const plugin: unknown
  export default plugin
}

declare module 'eslint-plugin-react-perf' {
  const plugin: unknown
  export default plugin
}
