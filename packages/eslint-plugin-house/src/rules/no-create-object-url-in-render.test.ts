import { describe, expect, it } from 'vitest'

import {
  createdAtModuleScope,
  createdInAsyncArrowHelper,
  createdInAsyncHelperInsideComponent,
  createdInAsyncWorkInsideEffect,
  createdInCallbackFromHandler,
  createdInEventHandler,
  createdInExternalStore,
  createdInFunctionDeclarationHandler,
  createdInHandlerAndInlineEventProp,
  createdInJsxAttribute,
  createdInLazyStateInitialiser,
  createdInModuleLevelRenderHelper,
  createdInNamedEffect,
  createdInPlainHelper,
  createdInRenderBody,
  createdInUseMemo,
  imageUrlMadeInCallbackHandedTo,
  imageUrlMadeInCallbackProp,
  imageUrlMadeInRenderBy,
  mockedInTestFile,
  OTHER_DEFERRING_CALLS,
} from '../__tests__/cases/no-create-object-url-in-render.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { lintWithHouseRule } from '../__tests__/house-linter.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

houseRuleTester.run('no-create-object-url-in-render', housePlugin.rules['no-create-object-url-in-render'], {
  valid: [
    buildValidCase('stays silent on a URL created and revoked in an effect', createdInNamedEffect),
    buildValidCase('stays silent on a URL created in useMemo', createdInUseMemo),
    buildValidCase('stays silent on a URL created in an event handler', createdInEventHandler),
    buildValidCase('stays silent on a URL created at module scope', createdAtModuleScope),
    // The array's type does not reach a case built inside .map, so those cases name their type arguments.
    ...OTHER_DEFERRING_CALLS.map((call) =>
      buildValidCase<[]>(`stays silent on a URL created in a JSX callback handed to ${call}, which runs it later`, imageUrlMadeInCallbackHandedTo(call), {
        filename: 'no-create-object-url-in-render.tsx',
      }),
    ),
    buildValidCase(
      'stays silent on a URL created in a module-level function that renders JSX but is named like no component',
      createdInModuleLevelRenderHelper,
      { filename: 'no-create-object-url-in-render.tsx' },
    ),
    buildValidCase('stays silent on a URL created in a plain helper function', createdInPlainHelper),
    buildValidCase('stays silent on a URL created in an async arrow helper', createdInAsyncArrowHelper),
    buildValidCase('stays silent on a URL created in a lazy useState initialiser', createdInLazyStateInitialiser),
    buildValidCase(
      'stays silent on URLs created in a handler and in an inline event prop',
      createdInHandlerAndInlineEventProp,
    ),
    buildValidCase('stays silent on a URL created by async work inside an effect', createdInAsyncWorkInsideEffect),
    buildValidCase('stays silent on createObjectURL mocked in a test file', mockedInTestFile),
    buildValidCase('stays silent on a URL created in a function-declaration handler', createdInFunctionDeclarationHandler),
    buildValidCase(
      'stays silent on a URL created in a render callback that an event handler passes on',
      createdInCallbackFromHandler,
    ),
    buildValidCase(
      'stays silent on a URL created by an async helper declared inside a component',
      createdInAsyncHelperInsideComponent,
    ),
    buildValidCase('stays silent on a URL cached by an external store', createdInExternalStore),
    buildValidCase(
      'stays silent on URL.revokeObjectURL in a render body, which creates no URL',
      imageUrlMadeInRenderBy('URL.revokeObjectURL'),
    ),
    buildValidCase(
      'stays silent on a createObjectURL method of an object other than URL in a render body',
      imageUrlMadeInRenderBy('thumbnails.createObjectURL'),
    ),
    buildValidCase(
      'stays silent on URL[createObjectURL](…) in a render body, whose computed key it cannot read',
      imageUrlMadeInRenderBy('URL[createObjectURL]'),
    ),
    buildValidCase(
      "stays silent on a URL created in a JSX callback handed to a promise's then",
      imageUrlMadeInCallbackHandedTo('loaded.then'),
    ),
    buildValidCase(
      'stays silent on a URL created in a JSX callback handed to setTimeout',
      imageUrlMadeInCallbackHandedTo('setTimeout'),
    ),
    buildValidCase(
      'stays silent on a URL created in a JSX callback handed to a hook',
      imageUrlMadeInCallbackHandedTo('useMemo'),
    ),
    buildValidCase(
      'stays silent on a URL created in a JSX callback passed as an on* event prop',
      imageUrlMadeInCallbackProp('onRender'),
    ),
  ],
  invalid: [
    buildInvalidCase('reports URL.createObjectURL inline in a JSX attribute', createdInJsxAttribute, {
      filename: 'no-create-object-url-in-render.tsx',
      errors: [{ messageId: 'inRender', line: 2 }],
    }),
    buildInvalidCase(
      'reports URL.createObjectURL called in a render body',
      imageUrlMadeInRenderBy('URL.createObjectURL'),
      {
        filename: 'no-create-object-url-in-render.tsx',
        errors: [{ messageId: 'inRender', line: 2 }],
      },
    ),
    buildInvalidCase(
      'reports URL.createObjectURL reached through window. in a render body',
      imageUrlMadeInRenderBy('window.URL.createObjectURL'),
      {
        filename: 'no-create-object-url-in-render.tsx',
        errors: [{ messageId: 'inRender', line: 2 }],
      },
    ),
    buildInvalidCase(
      'reports a URL created in a JSX callback handed to hooks[useEffect](…), whose computed callee is not read as a hook',
      imageUrlMadeInCallbackHandedTo('hooks[useEffect]'),
      {
        filename: 'no-create-object-url-in-render.tsx',
        errors: [{ messageId: 'inRender', line: 2 }],
      },
    ),
    buildInvalidCase(
      'reports a URL created in a JSX callback passed as a render prop, which is not an on* event prop',
      imageUrlMadeInCallbackProp('render'),
      {
        filename: 'no-create-object-url-in-render.tsx',
        errors: [{ messageId: 'inRender', line: 2 }],
      },
    ),
    buildInvalidCase(
      'reports a URL created in a JSX callback passed as a prop holding on and a capital past its start, which is not an on* event prop',
      imageUrlMadeInCallbackProp('buttonLabel'),
      {
        filename: 'no-create-object-url-in-render.tsx',
        errors: [{ messageId: 'inRender', line: 2 }],
      },
    ),
    buildInvalidCase(
      'reports a URL created in a JSX callback handed to a call that is neither a hook nor one that runs it later',
      imageUrlMadeInCallbackHandedTo('wrap'),
      {
        filename: 'no-create-object-url-in-render.tsx',
        errors: [{ messageId: 'inRender', line: 2 }],
      },
    ),
  ],
})

describe('no-create-object-url-in-render messages, as a user reads them', () => {
  it('says what a blob URL made on every render costs', () => {
    const messages = lintWithHouseRule('no-create-object-url-in-render', [], createdInRenderBody, 'no-create-object-url-in-render.js')

    expect(messages.map(({ message }) => message)).toStrictEqual([
      'URL.createObjectURL runs again on every render here, so each render leaks a blob URL and the browser refetches the image. Move it into a useEffect or useMemo keyed on the blob, and revoke the previous URL on cleanup.',
    ])
  })
})
