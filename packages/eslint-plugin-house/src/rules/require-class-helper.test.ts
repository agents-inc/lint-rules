import type { ESLintUtils } from '@typescript-eslint/utils'
import { describe, expect, it } from 'vitest'

import {
  callToAClassNameGetter,
  callToAnotherHelper,
  callToASingularVariant,
  callToLowercaseVariants,
  callToLowercaseVariantsAlone,
  callToVariantsItself,
  callWithVariantsMidName,
  classAttribute,
  classNameFromCallTo,
  cnCallModule,
  composingInsideHelperArguments,
  composingOutsideClassAttributes,
  concatenatedClasses,
  concatenatedClassesModule,
  DEFAULT_CLASS_HELPERS,
  joinedArrayOfClasses,
  logicalClasses,
  lookedUpClasses,
  optionalVariantsCall,
  staticTemplateClass,
  stringLiteralClasses,
  templateComposingClasses,
  templateJoiningLookups,
  templateWrappingAVariantsCall,
  templateWrappingOneOptionalProp,
  templateWrappingOneTernary,
  ternaryAddingAClass,
  ternaryChoosingOneClass,
  variantsCallBesideACnCall,
  variantsCallModule,
  variantsCallThroughAnObject,
  variantsCallWithATernaryArgument,
  variantsCallWithNoArguments,
  variantsCallWithOptions,
} from '../__tests__/cases/require-class-helper.ts'
import { caseBuildersFor } from '../__tests__/factories/rule-case-factories.ts'
import { lintWithHouseRule } from '../__tests__/house-linter.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

// A template with nothing interpolated composes nothing, so it is silent. No invalid case declares
// `output` or `suggestions`, so the tester fails any fix the rule offers.
const FILENAME = 'require-class-helper.tsx'
const OTHER_HELPER = 'joinClasses'
const DEFAULT_HELPERS_AS_THE_MESSAGE_LISTS_THEM = 'cn, clsx, cx, cva, twMerge, classNames, classnames'
const RULE_NAME = 'require-class-helper'
const RULE_ID = 'house/require-class-helper'
const JAVASCRIPT_FILENAME = 'require-class-helper.js'
const MESSAGE_ON_CLASS_NAME = `Give className a string, a name, or a call to a class helper (${DEFAULT_HELPERS_AS_THE_MESSAGE_LISTS_THEM}) or to a cva-made function whose name ends in \`Variants\`, and compose classes inside that call. A helper drops empty, false and undefined parts; composed by hand they render as stray spaces or the class "undefined".`
const { invalidCase, validCase } = caseBuildersFor(FILENAME)

// The valid array's type does not reach a case built inside .map, so those cases name the options
// type outright.
type RequireClassHelperOptions = ESLintUtils.InferOptionsTypeFromRule<
  (typeof housePlugin.rules)['require-class-helper']
>

houseRuleTester.run('require-class-helper', housePlugin.rules['require-class-helper'], {
  valid: [
    validCase('stays silent on string literals, bare and in braces', stringLiteralClasses),
    validCase('stays silent on a template literal with nothing interpolated', staticTemplateClass),
    validCase('stays silent on a prop, a CSS module member, a computed lookup and an optional member', lookedUpClasses),
    ...DEFAULT_CLASS_HELPERS.map((helper) =>
      validCase<RequireClassHelperOptions>(
        `stays silent on a call to ${helper}, a default helper`,
        classNameFromCallTo(helper),
      ),
    ),
    validCase(
      'stays silent on templates and ternaries inside a helper call, which are its arguments',
      composingInsideHelperArguments,
    ),
    validCase(
      'stays silent on classes composed outside className and class, inputClassName included',
      composingOutsideClassAttributes,
    ),
    validCase('stays silent on a call to a helper its helpers option names', callToAnotherHelper, {
      options: [{ helpers: [OTHER_HELPER] }],
    }),
    validCase(
      'stays silent on a call to cn when its options object leaves helpers out, so the default helpers apply',
      classNameFromCallTo('cn'),
      { options: [{}] },
    ),
    validCase(
      'stays silent on a call to a function whose name ends in Variants, given an options object as cva-made ones are',
      variantsCallWithOptions,
    ),
    validCase(
      'stays silent on a call to a function whose name ends in Variants, given no arguments',
      variantsCallWithNoArguments,
    ),
    validCase('stays silent on a Variants-suffixed function called through an object', variantsCallThroughAnObject),
    validCase('stays silent on an optional call to a Variants-suffixed function', optionalVariantsCall),
    validCase(
      'stays silent on a ternary inside a Variants-suffixed call, which is its argument',
      variantsCallWithATernaryArgument,
    ),
    validCase('stays silent on a call to Variants itself, a name that ends in Variants', callToVariantsItself),
  ],
  invalid: [
    invalidCase('reports a template literal composing classes, once for the whole value', templateComposingClasses, {
      errors: [{ messageId: 'useClassHelper', line: 2 }],
    }),
    invalidCase('reports a template literal joining a CSS module class and a prop', templateJoiningLookups, {
      errors: [{ messageId: 'useClassHelper', line: 4 }],
    }),
    // `${className}` renders "undefined" when the prop is absent; a helper drops it.
    invalidCase('reports a template literal wrapping one optional prop', templateWrappingOneOptionalProp, {
      errors: [{ messageId: 'useClassHelper', line: 2 }],
    }),
    invalidCase('reports a template literal wrapping one ternary', templateWrappingOneTernary, {
      errors: [{ messageId: 'useClassHelper', line: 2 }],
    }),
    invalidCase('reports classes joined with +', concatenatedClasses, {
      errors: [{ messageId: 'useClassHelper', line: 2 }],
    }),
    invalidCase('reports a ternary choosing one of two classes', ternaryChoosingOneClass, {
      errors: [{ messageId: 'useClassHelper', line: 4 }],
    }),
    invalidCase('reports a ternary adding a class or none', ternaryAddingAClass, {
      errors: [{ messageId: 'useClassHelper', line: 2 }],
    }),
    invalidCase('reports ??, && and || in className, one report each', logicalClasses, {
      errors: [
        { messageId: 'useClassHelper', line: 3 },
        { messageId: 'useClassHelper', line: 4 },
        { messageId: 'useClassHelper', line: 5 },
      ],
    }),
    invalidCase('reports a call to a helper the default helpers do not name', callToAnotherHelper, {
      errors: [{ messageId: 'useClassHelper', line: 2 }],
    }),
    invalidCase('reports an array of classes joined by .join', joinedArrayOfClasses, {
      errors: [{ messageId: 'useClassHelper', line: 2 }],
    }),
    invalidCase(
      'reports a call to cn when the helpers option names others, as the option replaces the defaults',
      classNameFromCallTo('cn'),
      {
        options: [{ helpers: [OTHER_HELPER] }],
        errors: [{ messageId: 'useClassHelper', line: 2 }],
      },
    ),
    invalidCase('reports a template literal in class, and not the string literal beside it', classAttribute, {
      errors: [{ messageId: 'useClassHelper', line: 4 }],
    }),
    invalidCase(
      'lists every default helper in its message, classNames and classnames included, in order',
      concatenatedClasses,
      {
        errors: [
          {
            messageId: 'useClassHelper',
            line: 2,
            data: { attribute: 'className', helpers: DEFAULT_HELPERS_AS_THE_MESSAGE_LISTS_THEM },
          },
        ],
      },
    ),
    invalidCase(
      'reports cn and not the Variants-suffixed call beside it when the helpers option names others',
      variantsCallBesideACnCall,
      {
        options: [{ helpers: [OTHER_HELPER] }],
        errors: [{ messageId: 'useClassHelper', line: 3 }],
      },
    ),
    invalidCase('reports a call to a function whose name ends in Variant, singular', callToASingularVariant, {
      errors: [{ messageId: 'useClassHelper', line: 2 }],
    }),
    invalidCase(
      'reports a call to a function whose name ends in variants with a lowercase v',
      callToLowercaseVariants,
      { errors: [{ messageId: 'useClassHelper', line: 2 }] },
    ),
    invalidCase('reports a call to variants, all lowercase', callToLowercaseVariantsAlone, {
      errors: [{ messageId: 'useClassHelper', line: 2 }],
    }),
    invalidCase(
      'reports a call to a function with Variants inside its name rather than at the end',
      callWithVariantsMidName,
      { errors: [{ messageId: 'useClassHelper', line: 2 }] },
    ),
    invalidCase(
      'reports a call to a function that returns a class name but is neither a helper nor Variants-suffixed',
      callToAClassNameGetter,
      { errors: [{ messageId: 'useClassHelper', line: 2 }] },
    ),
    invalidCase('reports a template literal wrapping a Variants-suffixed call', templateWrappingAVariantsCall, {
      errors: [{ messageId: 'useClassHelper', line: 2 }],
    }),
  ],
})

describe('require-class-helper message, as ESLint renders it', () => {
  it('names the default helpers and the Variants ending of a cva-made function', () => {
    const messages = lintWithHouseRule(RULE_NAME, [], concatenatedClassesModule, JAVASCRIPT_FILENAME)

    expect(messages.map(({ ruleId, message }) => ({ ruleId, message }))).toStrictEqual([
      { ruleId: RULE_ID, message: MESSAGE_ON_CLASS_NAME },
    ])
  })

  it('stays silent on a call to a function whose name ends in Variants', () => {
    expect(lintWithHouseRule(RULE_NAME, [], variantsCallModule, JAVASCRIPT_FILENAME)).toStrictEqual([])
  })
})

describe('require-class-helper options, as ESLint checks them', () => {
  it('accepts a helpers option and applies it: a call to cn is reported when helpers names others', () => {
    const messages = lintWithHouseRule(RULE_NAME, [{ helpers: [OTHER_HELPER] }], cnCallModule, JAVASCRIPT_FILENAME)

    expect(messages.map(({ ruleId }) => ruleId)).toStrictEqual([RULE_ID])
  })

  it('refuses an option key other than helpers', () => {
    expect(() =>
      lintWithHouseRule(RULE_NAME, [{ helper: [OTHER_HELPER] }], cnCallModule, JAVASCRIPT_FILENAME),
    ).toThrowError(/Unexpected property "helper"/)
  })
})
