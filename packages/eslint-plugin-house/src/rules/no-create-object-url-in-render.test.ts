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
  createdInLazyStateInitialiser,
  createdInNamedEffect,
  createdInPlainHelper,
  createdInUseMemo,
  createObjectUrlInJsxAttribute,
  imageUrlMadeInCallbackHandedTo,
  imageUrlMadeInCallbackProp,
  imageUrlMadeInRenderBy,
  mockedInTestFile,
} from '../__tests__/cases/no-create-object-url-in-render.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

houseRuleTester.run('no-create-object-url-in-render', housePlugin.rules['no-create-object-url-in-render'], {
  valid: [
    buildValidCase('stays silent on a URL created and revoked in an effect', createdInNamedEffect),
    buildValidCase('stays silent on a URL created in useMemo', createdInUseMemo),
    buildValidCase('stays silent on a URL created in an event handler', createdInEventHandler),
    buildValidCase('stays silent on a URL created at module scope', createdAtModuleScope),
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
    buildInvalidCase('reports URL.createObjectURL inline in a JSX attribute', createObjectUrlInJsxAttribute, {
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
  ],
})
