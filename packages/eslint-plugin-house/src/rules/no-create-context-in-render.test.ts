import {
  classFieldAndMethod,
  contextInLazyUseMemo,
  contextInViMockFactory,
  contextRetainedByUseRef,
  contextRetainedByUseStateInitialValue,
  createContextInComponent,
  createContextInCustomHook,
  hookReadingImportedContext,
  lazyModuleLevelSingleton,
  locallyDeclaredCreateContext,
  moduleLevelContextFactory,
  moduleScopeContext,
  moduleScopeContextWithMemoisedValue,
  namespacedContextInUseMemo,
  nodeVmNamedImportCreateContext,
  nodeVmNamespaceCreateContext,
  pascalCaseFactoryWithoutJsx,
} from '../__tests__/cases/no-create-context-in-render.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

houseRuleTester.run('no-create-context-in-render', housePlugin.rules['no-create-context-in-render'], {
  valid: [
    buildValidCase('stays silent on a context created at module scope', moduleScopeContext),
    buildValidCase('stays silent on a module-level factory that creates a context once', moduleLevelContextFactory),
    buildValidCase(
      'stays silent on a provider that memoises its value around a module-scope context',
      moduleScopeContextWithMemoisedValue,
    ),
    buildValidCase('stays silent on a hook that reads an imported context', hookReadingImportedContext),
    buildValidCase('stays silent on a context created inside a lazy useMemo', contextInLazyUseMemo),
    buildValidCase("stays silent on node:vm's createContext reached through its namespace", nodeVmNamespaceCreateContext),
    buildValidCase('stays silent on a locally declared function named createContext', locallyDeclaredCreateContext),
    buildValidCase('stays silent on a context created inside a vi.mock factory', contextInViMockFactory),
    buildValidCase("stays silent on node:vm's createContext as a named import", nodeVmNamedImportCreateContext),
    buildValidCase('stays silent on a context retained by useRef', contextRetainedByUseRef),
    buildValidCase("stays silent on a context retained by useState's initial value", contextRetainedByUseStateInitialValue),
    buildValidCase('stays silent on a lazily created module-level singleton', lazyModuleLevelSingleton),
    buildValidCase('stays silent on a PascalCase factory that renders no JSX itself', pascalCaseFactoryWithoutJsx),
    buildValidCase('stays silent on React.createContext inside React.useMemo', namespacedContextInUseMemo),
    buildValidCase('stays silent on createContext in a class field and a class method', classFieldAndMethod),
  ],
  invalid: [
    buildInvalidCase('reports createContext called inside a component', createContextInComponent, {
      filename: 'no-create-context-in-render.tsx',
      errors: [{ messageId: 'inRender', line: 4 }],
    }),
    buildInvalidCase('reports createContext called inside a custom hook, naming the hook', createContextInCustomHook, {
      filename: 'no-create-context-in-render.tsx',
      errors: [{ messageId: 'inRender', line: 4, data: { name: 'useThemeContext' } }],
    }),
  ],
})
