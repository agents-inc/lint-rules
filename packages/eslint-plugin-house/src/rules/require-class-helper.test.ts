import type { ESLintUtils } from '@typescript-eslint/utils'

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
  composingInsideHelperArguments,
  composingOutsideClassAttributes,
  concatenatedClasses,
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
  variantsCallThroughAnObject,
  variantsCallWithATernaryArgument,
  variantsCallWithNoArguments,
  variantsCallWithOptions,
} from '../__tests__/cases/require-class-helper.ts'
import { buildInvalidCase, buildValidCase } from '../__tests__/factories/rule-case-factories.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

// Owner, 2026-10-10: className and class are a literal, a name or lookup, or a call to a class
// helper; classes composed inline are reported. A helper's own arguments are not the target.
// Owner, 2026-10-11 and 2026-10-14: classNames and classnames are helpers too, a ternary choosing one
// of two classes stays reported, and a call to a function whose name ends in `Variants`, as cva-made
// functions are named, passes like a helper call. Our reading, not the owner's words: that holds
// whatever the helpers option names, or a team that lists its own helper would lose it.
//
// One shape the owner's wording reports is silent here, from the ~/dev measurement: a template with
// nothing interpolated, which is a string literal in backticks and composes nothing.
//
// No invalid case declares an `output` or `suggestions`: the tester then fails any fix or
// suggestion the rule offers. Which helper a file imports is not the rule's to guess.
const FILENAME = 'require-class-helper.tsx'
const OTHER_HELPER = 'joinClasses'
const DEFAULT_HELPERS_AS_THE_MESSAGE_LISTS_THEM = 'cn, clsx, cx, cva, twMerge, classNames, classnames'

// The valid array's type does not reach a case built inside .map, so those cases name the rule's
// options outright. Left to infer from a case with no options, they would be `readonly unknown[]`.
type RequireClassHelperOptions = ESLintUtils.InferOptionsTypeFromRule<
  (typeof housePlugin.rules)['require-class-helper']
>

houseRuleTester.run('require-class-helper', housePlugin.rules['require-class-helper'], {
  valid: [
    buildValidCase('stays silent on string literals, bare and in braces', stringLiteralClasses, { filename: FILENAME }),
    buildValidCase('stays silent on a template literal with nothing interpolated', staticTemplateClass, {
      filename: FILENAME,
    }),
    buildValidCase(
      'stays silent on a prop, a CSS module member, a computed lookup and an optional member',
      lookedUpClasses,
      { filename: FILENAME },
    ),
    ...DEFAULT_CLASS_HELPERS.map((helper) =>
      buildValidCase<RequireClassHelperOptions>(
        `stays silent on a call to ${helper}, a default helper`,
        classNameFromCallTo(helper),
        { filename: FILENAME },
      ),
    ),
    buildValidCase(
      'stays silent on templates and ternaries inside a helper call, which are its arguments',
      composingInsideHelperArguments,
      { filename: FILENAME },
    ),
    buildValidCase(
      'stays silent on classes composed outside className and class, inputClassName included',
      composingOutsideClassAttributes,
      { filename: FILENAME },
    ),
    buildValidCase('stays silent on a call to a helper its helpers option names', callToAnotherHelper, {
      filename: FILENAME,
      options: [{ helpers: [OTHER_HELPER] }],
    }),
    buildValidCase(
      'stays silent on a call to cn when its options object leaves helpers out, so the default helpers apply',
      classNameFromCallTo('cn'),
      { filename: FILENAME, options: [{}] },
    ),
    buildValidCase(
      'stays silent on a call to a function whose name ends in Variants, given an options object as cva-made ones are',
      variantsCallWithOptions,
      { filename: FILENAME },
    ),
    buildValidCase(
      'stays silent on a call to a function whose name ends in Variants, given no arguments',
      variantsCallWithNoArguments,
      { filename: FILENAME },
    ),
    buildValidCase(
      'stays silent on a Variants-suffixed function called through an object',
      variantsCallThroughAnObject,
      { filename: FILENAME },
    ),
    buildValidCase('stays silent on an optional call to a Variants-suffixed function', optionalVariantsCall, {
      filename: FILENAME,
    }),
    buildValidCase(
      'stays silent on a ternary inside a Variants-suffixed call, which is its argument',
      variantsCallWithATernaryArgument,
      { filename: FILENAME },
    ),
    buildValidCase('stays silent on a call to Variants itself, a name that ends in Variants', callToVariantsItself, {
      filename: FILENAME,
    }),
  ],
  invalid: [
    buildInvalidCase('reports a template literal composing classes, once for the whole value', templateComposingClasses, {
      filename: FILENAME,
      errors: [{ messageId: 'useClassHelper', line: 2 }],
    }),
    buildInvalidCase('reports a template literal joining a CSS module class and a prop', templateJoiningLookups, {
      filename: FILENAME,
      errors: [{ messageId: 'useClassHelper', line: 4 }],
    }),
    // `${className}` renders "undefined" when the prop is absent; a helper drops it.
    buildInvalidCase('reports a template literal wrapping one optional prop', templateWrappingOneOptionalProp, {
      filename: FILENAME,
      errors: [{ messageId: 'useClassHelper', line: 2 }],
    }),
    buildInvalidCase('reports a template literal wrapping one ternary', templateWrappingOneTernary, {
      filename: FILENAME,
      errors: [{ messageId: 'useClassHelper', line: 2 }],
    }),
    buildInvalidCase('reports classes joined with +', concatenatedClasses, {
      filename: FILENAME,
      errors: [{ messageId: 'useClassHelper', line: 2 }],
    }),
    buildInvalidCase('reports a ternary choosing one of two classes', ternaryChoosingOneClass, {
      filename: FILENAME,
      errors: [{ messageId: 'useClassHelper', line: 4 }],
    }),
    buildInvalidCase('reports a ternary adding a class or none', ternaryAddingAClass, {
      filename: FILENAME,
      errors: [{ messageId: 'useClassHelper', line: 2 }],
    }),
    buildInvalidCase('reports ??, && and || in className, one report each', logicalClasses, {
      filename: FILENAME,
      errors: [
        { messageId: 'useClassHelper', line: 3 },
        { messageId: 'useClassHelper', line: 4 },
        { messageId: 'useClassHelper', line: 5 },
      ],
    }),
    buildInvalidCase('reports a call to a helper the default helpers do not name', callToAnotherHelper, {
      filename: FILENAME,
      errors: [{ messageId: 'useClassHelper', line: 2 }],
    }),
    buildInvalidCase('reports an array of classes joined by .join', joinedArrayOfClasses, {
      filename: FILENAME,
      errors: [{ messageId: 'useClassHelper', line: 2 }],
    }),
    buildInvalidCase(
      'reports a call to cn when the helpers option names others, as the option replaces the defaults',
      classNameFromCallTo('cn'),
      {
        filename: FILENAME,
        options: [{ helpers: [OTHER_HELPER] }],
        errors: [{ messageId: 'useClassHelper', line: 2 }],
      },
    ),
    buildInvalidCase('reports a template literal in class, and not the string literal beside it', classAttribute, {
      filename: FILENAME,
      errors: [{ messageId: 'useClassHelper', line: 4 }],
    }),
    buildInvalidCase(
      'lists every default helper in its message, classNames and classnames included, in order',
      concatenatedClasses,
      {
        filename: FILENAME,
        errors: [
          {
            messageId: 'useClassHelper',
            line: 2,
            data: { attribute: 'className', helpers: DEFAULT_HELPERS_AS_THE_MESSAGE_LISTS_THEM },
          },
        ],
      },
    ),
    buildInvalidCase(
      'reports cn and not the Variants-suffixed call beside it when the helpers option names others',
      variantsCallBesideACnCall,
      {
        filename: FILENAME,
        options: [{ helpers: [OTHER_HELPER] }],
        errors: [{ messageId: 'useClassHelper', line: 3 }],
      },
    ),
    buildInvalidCase('reports a call to a function whose name ends in Variant, singular', callToASingularVariant, {
      filename: FILENAME,
      errors: [{ messageId: 'useClassHelper', line: 2 }],
    }),
    buildInvalidCase(
      'reports a call to a function whose name ends in variants with a lowercase v',
      callToLowercaseVariants,
      { filename: FILENAME, errors: [{ messageId: 'useClassHelper', line: 2 }] },
    ),
    buildInvalidCase('reports a call to variants, all lowercase', callToLowercaseVariantsAlone, {
      filename: FILENAME,
      errors: [{ messageId: 'useClassHelper', line: 2 }],
    }),
    buildInvalidCase(
      'reports a call to a function with Variants inside its name rather than at the end',
      callWithVariantsMidName,
      { filename: FILENAME, errors: [{ messageId: 'useClassHelper', line: 2 }] },
    ),
    buildInvalidCase(
      'reports a call to a function that returns a class name but is neither a helper nor Variants-suffixed',
      callToAClassNameGetter,
      { filename: FILENAME, errors: [{ messageId: 'useClassHelper', line: 2 }] },
    ),
    buildInvalidCase('reports a template literal wrapping a Variants-suffixed call', templateWrappingAVariantsCall, {
      filename: FILENAME,
      errors: [{ messageId: 'useClassHelper', line: 2 }],
    }),
  ],
})
