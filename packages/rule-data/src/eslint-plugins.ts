/// <reference path="./untyped-eslint-plugins.d.ts" />
import eslintReact from '@eslint-react/eslint-plugin'
import vitest from '@vitest/eslint-plugin'
import { housePlugin } from '@workspace/eslint-plugin-house'
import type { ESLint } from 'eslint'
import checkFile from 'eslint-plugin-check-file'
import cssModules from 'eslint-plugin-css-modules'
import functional from 'eslint-plugin-functional'
import importX from 'eslint-plugin-import-x'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import n from 'eslint-plugin-n'
import noSecrets from 'eslint-plugin-no-secrets'
import perfectionist from 'eslint-plugin-perfectionist'
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
import typescriptEslint from 'typescript-eslint'

import { isObject } from './is-object.ts'

/**
 * Every ESLint plugin we ship, keyed by the prefix its rule IDs carry. Core rules have no entry. The
 * package behind each prefix is in generate/eslint-plugin-package-names.ts.
 */
export const eslintPlugins: Readonly<Record<string, ESLint.Plugin>> = {
  '@eslint-react': eslintReact,
  '@typescript-eslint': typescriptEslint.plugin,
  'check-file': checkFile,
  'css-modules': checkedPlugin('css-modules', cssModules),
  functional,
  house: checkedPlugin('house', housePlugin),
  'import-x': importX,
  'jsx-a11y': checkedPlugin('jsx-a11y', jsxA11y),
  n,
  'no-secrets': noSecrets,
  perfectionist,
  promise: checkedPlugin('promise', promise),
  react,
  'react-hook-form': checkedPlugin('react-hook-form', reactHookForm),
  'react-hooks': checkedPlugin('react-hooks', reactHooks),
  'react-perf': checkedPlugin('react-perf', reactPerf),
  'react-you-might-not-need-an-effect': reactYouMightNotNeedAnEffect,
  regexp,
  sonarjs,
  storybook: checkedPlugin('storybook', storybook),
  'testing-library': testingLibrary,
  unicorn,
  vitest,
}

/**
 * A plugin whose types do not fit `ESLint.Plugin`, checked at load to be a plugin of rules instead.
 * Some publish no types; storybook's break under `exactOptionalPropertyTypes`; rules built with
 * `@typescript-eslint/utils` (house) have a readonly `defaultOptions`, which ESLint's type rejects;
 * react-hooks nests its flat configs under `configs.flat`, which ESLint's type rejects too.
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
