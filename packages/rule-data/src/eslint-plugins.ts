/// <reference path="./untyped-eslint-plugins.d.ts" />
import e18e from '@e18e/eslint-plugin'
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments'
import eslintReact from '@eslint-react/eslint-plugin'
import shadcn from '@shadcn/lint'
import tanstackQuery from '@tanstack/eslint-plugin-query'
import tanstackRouter from '@tanstack/eslint-plugin-router'
import vitest from '@vitest/eslint-plugin'
import { housePlugin } from '@workspace/eslint-plugin-house'
import type { ESLint } from 'eslint'
import checkFile from 'eslint-plugin-check-file'
import cssModules from 'eslint-plugin-css-modules'
import functional from 'eslint-plugin-functional'
import hydrationProof from 'eslint-plugin-hydration-proof'
import importX from 'eslint-plugin-import-x'
import jestDom from 'eslint-plugin-jest-dom'
import jsxA11y from 'eslint-plugin-jsx-a11y-x'
import n from 'eslint-plugin-n'
import noSecrets from 'eslint-plugin-no-secrets'
import perfectionist from 'eslint-plugin-perfectionist'
import playwright from 'eslint-plugin-playwright'
import promise from 'eslint-plugin-promise'
import react from 'eslint-plugin-react'
import reactHookForm from 'eslint-plugin-react-hook-form'
import reactHooks from 'eslint-plugin-react-hooks'
import reactPerf from 'eslint-plugin-react-perf'
import reactYouMightNotNeedAnEffect from 'eslint-plugin-react-you-might-not-need-an-effect'
import regexp from 'eslint-plugin-regexp'
import sonarjs from 'eslint-plugin-sonarjs'
import storybook from 'eslint-plugin-storybook'
import testingLibrary from 'eslint-plugin-testing-library'
import unicorn from 'eslint-plugin-unicorn'
import zod from 'eslint-plugin-zod'
import typescriptEslint from 'typescript-eslint'

import { isObject } from './is-object.ts'

/**
 * Every ESLint plugin we ship, keyed by the prefix its rule IDs carry. Core rules have no entry. The
 * package behind each prefix is in generate/eslint-plugin-package-names.ts.
 */
export const eslintPlugins: Readonly<Record<string, ESLint.Plugin>> = {
  '@eslint-community/eslint-comments': eslintComments,
  '@eslint-react': eslintReact,
  '@tanstack/query': checkedPlugin('@tanstack/query', tanstackQuery),
  '@tanstack/router': checkedPlugin('@tanstack/router', tanstackRouter),
  '@typescript-eslint': typescriptEslint.plugin,
  'check-file': checkFile,
  'css-modules': checkedPlugin('css-modules', cssModules),
  e18e,
  functional,
  house: checkedPlugin('house', housePlugin),
  'hydration-proof': hydrationProof,
  'import-x': importX,
  'jest-dom': jestDom,
  'jsx-a11y': checkedPlugin('jsx-a11y', jsxA11y),
  n,
  'no-secrets': noSecrets,
  perfectionist,
  playwright,
  promise: checkedPlugin('promise', promise),
  react,
  'react-hook-form': checkedPlugin('react-hook-form', reactHookForm),
  'react-hooks': checkedPlugin('react-hooks', reactHooks),
  'react-perf': checkedPlugin('react-perf', reactPerf),
  'react-you-might-not-need-an-effect': reactYouMightNotNeedAnEffect,
  regexp,
  shadcn,
  sonarjs,
  storybook: checkedPlugin('storybook', storybook),
  'testing-library': testingLibrary,
  unicorn,
  vitest,
  zod,
}

/**
 * A plugin whose types do not show an `ESLint.Plugin` with rules, checked at load instead: some publish
 * no types, the jsx-a11y fork types only its configs, storybook's break under
 * `exactOptionalPropertyTypes`, and house's and @tanstack/query's readonly `defaultOptions`,
 * @tanstack/router's rule context, typed with members ESLint 10's lacks, and react-hooks' `configs.flat`
 * do not fit ESLint's type.
 */
function checkedPlugin(prefix: string, loaded: unknown): ESLint.Plugin {
  if (!isPluginOfRules(loaded)) {
    throw new Error(`the plugin registered as ${prefix} does not export an ESLint plugin with rules`)
  }
  return loaded
}

function isPluginOfRules(value: unknown): value is ESLint.Plugin {
  return isObject(value) && 'rules' in value && isObject(value.rules) && Object.values(value.rules).every(isRuleModule)
}

function isRuleModule(value: unknown): boolean {
  return isObject(value) && 'create' in value && typeof value.create === 'function'
}
