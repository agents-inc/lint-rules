import { describe, expect, it } from 'vitest'

import {
  bindingImportedFromReactAndDeclared,
  classFieldAndMethod,
  computedCreateContextKeyInComponent,
  contextFromAPropertyNamedReact,
  contextFromModule,
  contextHandedToAnotherCall,
  contextInAHelperInsideALazyUseMemoDeepInAComponent,
  contextInLazyUseMemo,
  contextInViMockFactory,
  contextMadeByAHelperInAComponent,
  contextMadeInArrowComponent,
  contextMadeInComponent,
  contextMadeInComponentRenderingAFragment,
  contextMadeInCustomHook,
  contextMadeInMemoisedComponent,
  contextPassedToUseStateAfterItsInitialValue,
  contextRetainedByUseRef,
  contextRetainedByUseStateInitialValue,
  hookReadingImportedContext,
  lazyModuleLevelSingleton,
  locallyDeclaredCreateContext,
  moduleLevelContextFactory,
  moduleScopeContext,
  moduleScopeContextWithMemoisedValue,
  MODULES_NAMED_LIKE_REACT,
  namespacedContextInUseMemo,
  namespacedCreateContextBesideNodeVmImport,
  namespacedCreateContextInComponent,
  nodeVmNamedImportCreateContext,
  nodeVmNamespaceCreateContext,
  pascalCaseFactoryWithoutJsx,
  twoContextsMadeInComponent,
} from '../__tests__/cases/no-create-context-in-render.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { lintWithHouseRule } from '../__tests__/house-linter.ts'
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
    buildValidCase(
      'stays silent on React[createContext](…) in a component, whose computed key it cannot read',
      computedCreateContextKeyInComponent,
    ),
    buildValidCase(
      'stays silent on createContext reached through a React that is a property of another object',
      contextFromAPropertyNamedReact,
    ),
    // The array's type does not reach a case built inside .map, so those cases name their type arguments.
    ...MODULES_NAMED_LIKE_REACT.map((module) =>
      buildValidCase<[]>(`stays silent on createContext imported from ${module}, which is not React`, contextFromModule(module), {
        filename: 'no-create-context-in-render.tsx',
      }),
    ),
    buildValidCase(
      'stays silent on a createContext that is both imported from React and declared in the file',
      bindingImportedFromReactAndDeclared,
      { filename: 'no-create-context-in-render.tsx' },
    ),
    buildValidCase(
      'stays silent on createContext in a helper inside a lazy useMemo three functions deep in a component, as the useMemo keeps it',
      contextInAHelperInsideALazyUseMemoDeepInAComponent,
      { filename: 'no-create-context-in-render.tsx' },
    ),
  ],
  invalid: [
    buildInvalidCase('reports createContext called inside a component', contextMadeInComponent, {
      filename: 'no-create-context-in-render.tsx',
      errors: [{ messageId: 'inRender', line: 4 }],
    }),
    buildInvalidCase('reports createContext called inside a custom hook, naming the hook', contextMadeInCustomHook, {
      filename: 'no-create-context-in-render.tsx',
      errors: [{ messageId: 'inRender', line: 4, data: { name: 'useThemeContext' } }],
    }),
    buildInvalidCase(
      'reports React.createContext called inside a component, naming the component',
      namespacedCreateContextInComponent,
      {
        filename: 'no-create-context-in-render.tsx',
        errors: [{ messageId: 'inRender', line: 4, data: { name: 'ThemeProvider' } }],
      },
    ),
    buildInvalidCase(
      "reports React.createContext inside a component in a file importing node:vm's createContext by name",
      namespacedCreateContextBesideNodeVmImport,
      {
        filename: 'no-create-context-in-render.tsx',
        errors: [{ messageId: 'inRender', line: 7, data: { name: 'ThemeProvider' } }],
      },
    ),
    buildInvalidCase('reports createContext imported from preact in a component', contextFromModule('preact'), {
      filename: 'no-create-context-in-render.tsx',
      errors: [{ messageId: 'inRender', line: 4, data: { name: 'ThemeProvider' } }],
    }),
    buildInvalidCase(
      'reports createContext handed to a call that is not a hook keeping its first argument',
      contextHandedToAnotherCall,
      {
        filename: 'no-create-context-in-render.tsx',
        errors: [{ messageId: 'inRender', line: 4, data: { name: 'ThemeProvider' } }],
      },
    ),
    buildInvalidCase(
      'reports createContext in a helper defined in a component, naming the component',
      contextMadeByAHelperInAComponent,
      {
        filename: 'no-create-context-in-render.tsx',
        errors: [{ messageId: 'inRender', line: 4, data: { name: 'ThemeProvider' } }],
      },
    ),
    buildInvalidCase(
      'reports createContext passed to useState after its initial value, an argument useState does not keep',
      contextPassedToUseStateAfterItsInitialValue,
      {
        filename: 'no-create-context-in-render.tsx',
        errors: [{ messageId: 'inRender', line: 4, data: { name: 'ScopedPanel' } }],
      },
    ),
  buildInvalidCase('reports createContext in an arrow component assigned to a const, naming it', contextMadeInArrowComponent, {
    filename: 'no-create-context-in-render.tsx',
    errors: [{ messageId: 'inRender', line: 4, data: { name: 'ThemeProvider' } }],
  }),
  buildInvalidCase('reports createContext in a component wrapped in memo, naming the const it is assigned to', contextMadeInMemoisedComponent, {
    filename: 'no-create-context-in-render.tsx',
    errors: [{ messageId: 'inRender', line: 4, data: { name: 'ThemeProvider' } }],
  }),
  buildInvalidCase('reports each createContext a component calls, not only the first', twoContextsMadeInComponent, {
    filename: 'no-create-context-in-render.tsx',
    errors: [
      { messageId: 'inRender', line: 4, data: { name: 'ThemeProvider' } },
      { messageId: 'inRender', line: 5, data: { name: 'ThemeProvider' } },
    ],
  }),
  buildInvalidCase(
    'reports createContext in a component whose only JSX is a fragment, naming the component',
    contextMadeInComponentRenderingAFragment,
    {
      filename: 'no-create-context-in-render.tsx',
      errors: [{ messageId: 'inRender', line: 4, data: { name: 'Layout' } }],
    },
  ),
  ],
})

describe('no-create-context-in-render messages, as a user reads them', () => {
  it('names the component and says what goes wrong', () => {
    const messages = lintWithHouseRule('no-create-context-in-render', [], contextFromModule('react'), 'no-create-context-in-render.js')

    expect(messages.map(({ message }) => message)).toStrictEqual([
      'Move this createContext(…) to module scope. Inside ThemeProvider it builds a new context object on every render, so the Provider and any useContext() consumer hold different objects and consumers silently read the default value.',
    ])
  })
})
