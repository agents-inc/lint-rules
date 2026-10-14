/**
 * The npm package behind each prefix of the plugin registry. Only the generator and tests read it, so
 * no package name (house's is private) reaches a bundle of the runtime registry.
 */
export const eslintPluginPackageNames: Readonly<Record<string, string>> = {
  '@eslint-react': '@eslint-react/eslint-plugin',
  '@typescript-eslint': 'typescript-eslint',
  'check-file': 'eslint-plugin-check-file',
  'css-modules': 'eslint-plugin-css-modules',
  functional: 'eslint-plugin-functional',
  house: '@workspace/eslint-plugin-house',
  'import-x': 'eslint-plugin-import-x',
  'jsx-a11y': 'eslint-plugin-jsx-a11y',
  n: 'eslint-plugin-n',
  'no-secrets': 'eslint-plugin-no-secrets',
  perfectionist: 'eslint-plugin-perfectionist',
  promise: 'eslint-plugin-promise',
  react: 'eslint-plugin-react',
  'react-hook-form': 'eslint-plugin-react-hook-form',
  'react-hooks': 'eslint-plugin-react-hooks',
  'react-perf': 'eslint-plugin-react-perf',
  'react-you-might-not-need-an-effect': 'eslint-plugin-react-you-might-not-need-an-effect',
  regexp: 'eslint-plugin-regexp',
  sonarjs: 'eslint-plugin-sonarjs',
  storybook: 'eslint-plugin-storybook',
  'testing-library': 'eslint-plugin-testing-library',
  unicorn: 'eslint-plugin-unicorn',
  vitest: '@vitest/eslint-plugin',
}
