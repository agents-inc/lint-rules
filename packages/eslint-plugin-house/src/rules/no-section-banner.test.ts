import {
  bannerAloneOnItsLine,
  bannerAndLabelBlock,
  bareReturnAboveUnreachableValue,
  blockBannerAfterASpacedKeyword,
  blockBannerBeforeAMemberAccess,
  blockBannerBetweenADivisionAndARegularExpression,
  blockBannerBetweenANumberAndAParenthesis,
  blockBannerBetweenAParenthesisAndAName,
  blockBannerInsideEmptyParentheses,
  blockBannerJoiningAComparisonToANegation,
  blockBannerJoiningAComparisonToATypeAssertion,
  blockBannerJoiningAKeywordToADollarName,
  blockBannerJoiningAKeywordToAName,
  blockBannerJoiningAKeywordToANameOutsideTheBasicPlane,
  blockBannerJoiningAKeywordToAnEscapedName,
  blockBannerJoiningANameOutsideTheBasicPlaneToAKeyword,
  blockBannerJoiningANegationToADecrement,
  blockBannerJoiningANonNullAssertionToAnAssignment,
  blockBannerJoiningANumberToAMemberAccess,
  blockBannerJoiningARegularExpressionToAName,
  blockBannerJoiningTwoMinuses,
  blockBannerJoiningTwoPluses,
  blockBannerTrailingCode,
  blockCommentListingTwoLabels,
  blockLabel,
  callOnAName,
  callOnANumber,
  cliFlagComments,
  comparisonInProse,
  comparisonSpacedFromANegation,
  comparisonSpacedFromATypeAssertion,
  dashNote,
  declarationsWithoutComment,
  divisionSpacedFromARegularExpression,
  docBlockWithMarkdownHeading,
  docBlockWithTitledHeading,
  emptyCall,
  explanatoryComment,
  functionWithoutComment,
  indentedTitledBanner,
  keywordSpacedFromADollarName,
  keywordSpacedFromAName,
  keywordSpacedFromANameOutsideTheBasicPlane,
  keywordSpacedFromAnEscapedName,
  labelLeftAfterFirstPass,
  labelTrailingCode,
  lintDirectiveReason,
  markdownTableComments,
  memberAccessOnAName,
  minusSpacedFromAUnaryMinus,
  multiLineBlockBannerAfterReturn,
  multiLineBlockBannerBetweenStatements,
  multiLineBlockBannerEndingItsLine,
  nameOutsideTheBasicPlaneSpacedFromAKeyword,
  negationSpacedFromADecrement,
  nonNullAssertionSpacedFromAnAssignment,
  numberSpacedFromAMemberAccess,
  paragraphBetweenRuns,
  plusSpacedFromAUnaryPlus,
  regularExpressionSpacedFromAName,
  spacedHyphens,
  titledAsteriskBanner,
  titledBannerFramingASentence,
  titledBannerTrailingCode,
  titledBannerWithShortLeadingRun,
  titledBlockBanner,
  titledBlockBannerTrailingCode,
  titledDashBanner,
  titledEqualsBanner,
  titledLineAmongBlankLines,
  todoWithDashes,
  totalDeclaration,
  twoCharacterFrame,
  unevenTitledBanner,
} from '../__tests__/cases/no-section-banner.ts'
import { caseBuildersFor } from '../__tests__/factories/rule-case-factories.ts'
import { houseRuleTester } from '../__tests__/house-rule-tester.ts'
import { housePlugin } from '../index.ts'

const { invalidCase, validCase } = caseBuildersFor('no-section-banner.ts')

houseRuleTester.run('no-section-banner', housePlugin.rules['no-section-banner'], {
  valid: [
    validCase('stays silent on a comment that explains something', explanatoryComment),
    validCase('stays silent on a note led by two hyphens', dashNote),
    validCase('stays silent on single hyphens between words', spacedHyphens),
    validCase('stays silent on a run of hyphens between words, with no frame', todoWithDashes),
    // `--` is a dash in prose, so a title framed only by two-character runs is too weak a signal to delete on.
    validCase('stays silent on a title framed by two-character runs on both sides', twoCharacterFrame),
    validCase('stays silent on comments quoting CLI flags and the -- argument separator', cliFlagComments),
    validCase('stays silent on the reason a lint directive gives after --', lintDirectiveReason),
    validCase(
      'stays silent on a paragraph opened by a run on its first line and closed by one on its last',
      paragraphBetweenRuns,
    ),
    validCase('stays silent on a comparison operator in prose', comparisonInProse),
    validCase('stays silent on a doc block holding a framed heading among its prose', docBlockWithTitledHeading),
    validCase('stays silent on a doc block holding a markdown heading', docBlockWithMarkdownHeading),
    validCase('stays silent on a markdown table written in line comments', markdownTableComments),
    validCase('stays silent on a block comment listing two label words, one per line', blockCommentListingTwoLabels),
    validCase(
      'stays silent on a framed title among blank lines of a block comment, which is not a one-line banner',
      titledLineAmongBlankLines,
    ),
  ],
  invalid: [
    invalidCase('reports a banner-and-label block and deletes it line by line', bannerAndLabelBlock, {
      errors: [
        { messageId: 'banner', line: 1 },
        { messageId: 'label', line: 2 },
        { messageId: 'banner', line: 3 },
      ],
      output: [labelLeftAfterFirstPass, totalDeclaration],
    }),
    invalidCase('deletes a banner alone on its line together with that line', bannerAloneOnItsLine, {
      errors: [{ messageId: 'banner', line: 2 }],
      output: declarationsWithoutComment,
    }),
    invalidCase('reports a block comment holding one label word on its own line and deletes it', blockLabel, {
      errors: [{ messageId: 'label', line: 2 }],
      output: declarationsWithoutComment,
    }),
    invalidCase('keeps the line break when deleting a label comment that trails code', labelTrailingCode, {
      errors: [{ messageId: 'label', line: 1 }],
      output: declarationsWithoutComment,
    }),
    invalidCase('keeps the line break when deleting a block banner that trails code', blockBannerTrailingCode, {
      errors: [{ messageId: 'banner', line: 1 }],
      output: declarationsWithoutComment,
    }),
    invalidCase(
      'reports a title framed by hyphen runs as a banner, label word and all, and deletes its line',
      titledDashBanner,
      {
        errors: [{ messageId: 'banner', line: 2 }],
        output: declarationsWithoutComment,
      },
    ),
    invalidCase('reports a title framed by equals runs and deletes its line', titledEqualsBanner, {
      errors: [{ messageId: 'banner', line: 2 }],
      output: declarationsWithoutComment,
    }),
    invalidCase('reports a title framed by asterisk runs and deletes its line', titledAsteriskBanner, {
      errors: [{ messageId: 'banner', line: 2 }],
      output: declarationsWithoutComment,
    }),
    invalidCase('reports a titled block banner and deletes its line', titledBlockBanner, {
      errors: [{ messageId: 'banner', line: 2 }],
      output: declarationsWithoutComment,
    }),
    invalidCase('reports a title framed by runs of unequal length', unevenTitledBanner, {
      errors: [{ messageId: 'banner', line: 2 }],
      output: declarationsWithoutComment,
    }),
    invalidCase(
      'reports a title framed by a two-character run on one side when the other run is longer',
      titledBannerWithShortLeadingRun,
      {
        errors: [{ messageId: 'banner', line: 2 }],
        output: declarationsWithoutComment,
      },
    ),
    invalidCase('reports a framed sentence as a banner', titledBannerFramingASentence, {
      errors: [{ messageId: 'banner', line: 2 }],
      output: declarationsWithoutComment,
    }),
    invalidCase('deletes an indented titled banner together with its indentation and line', indentedTitledBanner, {
      errors: [{ messageId: 'banner', line: 2 }],
      output: functionWithoutComment,
    }),
    invalidCase('keeps the line break when deleting a titled banner that trails code', titledBannerTrailingCode, {
      errors: [{ messageId: 'banner', line: 1 }],
      output: declarationsWithoutComment,
    }),
    invalidCase(
      'keeps the line break when deleting a titled block banner that trails code',
      titledBlockBannerTrailingCode,
      {
        errors: [{ messageId: 'banner', line: 1 }],
        output: declarationsWithoutComment,
      },
    ),
    // The blanks on both sides go, and the code after starts a line indented like the comment's.
    invalidCase(
      'keeps the two statements on separate lines when deleting a block banner spanning lines between them',
      multiLineBlockBannerBetweenStatements,
      {
        errors: [{ messageId: 'banner', line: 1 }],
        output: declarationsWithoutComment,
      },
    ),
    invalidCase(
      'keeps return on its own line when deleting a block banner spanning lines after it, so the function still returns undefined',
      multiLineBlockBannerAfterReturn,
      {
        errors: [{ messageId: 'banner', line: 2 }],
        output: bareReturnAboveUnreachableValue,
      },
    ),
    invalidCase(
      'adds no blank line when deleting a block banner spanning lines that trails code and ends its line',
      multiLineBlockBannerEndingItsLine,
      {
        errors: [{ messageId: 'banner', line: 1 }],
        output: declarationsWithoutComment,
      },
    ),
    invalidCase(
      'leaves a space where deleting a block banner would join a keyword to the name after it',
      blockBannerJoiningAKeywordToAName,
      {
        errors: [{ messageId: 'banner', line: 1 }],
        output: keywordSpacedFromAName,
      },
    ),
    invalidCase(
      'leaves a space where deleting a block banner, with the blank before it, would join a keyword to the name after it',
      blockBannerAfterASpacedKeyword,
      {
        errors: [{ messageId: 'banner', line: 1 }],
        output: keywordSpacedFromAName,
      },
    ),
    invalidCase(
      'leaves a space where deleting a block banner would join two operators into one',
      blockBannerJoiningTwoPluses,
      {
        errors: [{ messageId: 'banner', line: 1 }],
        output: plusSpacedFromAUnaryPlus,
      },
    ),
    invalidCase(
      'adds no space where the tokens around a deleted block banner stay apart without one',
      blockBannerInsideEmptyParentheses,
      {
        errors: [{ messageId: 'banner', line: 1 }],
        output: emptyCall,
      },
    ),
    invalidCase('leaves a space where deleting a block banner would join two minuses into one', blockBannerJoiningTwoMinuses, {
      errors: [{ messageId: 'banner', line: 1 }],
      output: minusSpacedFromAUnaryMinus,
    }),
    invalidCase(
      'leaves a space where deleting a block banner would join a division and a regular expression into a comment',
      blockBannerBetweenADivisionAndARegularExpression,
      {
        errors: [{ messageId: 'banner', line: 1 }],
        output: divisionSpacedFromARegularExpression,
      },
    ),
    invalidCase(
      "leaves a space where deleting a block banner would join a name to a regular expression's flags",
      blockBannerJoiningARegularExpressionToAName,
      {
        errors: [{ messageId: 'banner', line: 1 }],
        output: regularExpressionSpacedFromAName,
      },
    ),
    invalidCase(
      "leaves a space where deleting a block banner would join a member access's dot to a number",
      blockBannerJoiningANumberToAMemberAccess,
      {
        errors: [{ messageId: 'banner', line: 1 }],
        output: numberSpacedFromAMemberAccess,
      },
    ),
    invalidCase(
      'leaves a space where deleting a block banner would join a keyword to a name led by a dollar sign',
      blockBannerJoiningAKeywordToADollarName,
      {
        errors: [{ messageId: 'banner', line: 1 }],
        output: keywordSpacedFromADollarName,
      },
    ),
    invalidCase(
      'leaves a space where deleting a block banner would join a keyword to a name led by a unicode escape',
      blockBannerJoiningAKeywordToAnEscapedName,
      {
        errors: [{ messageId: 'banner', line: 1 }],
        output: keywordSpacedFromAnEscapedName,
      },
    ),
    invalidCase(
      "leaves a space where deleting a block banner would join a keyword to a name led by a character outside Unicode's basic plane",
      blockBannerJoiningAKeywordToANameOutsideTheBasicPlane,
      {
        errors: [{ messageId: 'banner', line: 1 }],
        output: keywordSpacedFromANameOutsideTheBasicPlane,
      },
    ),
    invalidCase(
      "leaves a space where deleting a block banner would join a name ending in a character outside Unicode's basic plane to a keyword",
      blockBannerJoiningANameOutsideTheBasicPlaneToAKeyword,
      {
        errors: [{ messageId: 'banner', line: 2 }],
        output: nameOutsideTheBasicPlaneSpacedFromAKeyword,
      },
    ),
    invalidCase(
      'leaves a space where deleting a block banner would join a non-null assertion and an assignment into a comparison',
      blockBannerJoiningANonNullAssertionToAnAssignment,
      {
        errors: [{ messageId: 'banner', line: 2 }],
        output: nonNullAssertionSpacedFromAnAssignment,
      },
    ),
    invalidCase(
      'leaves a space where deleting a block banner would join a comparison and a type assertion into a shift',
      blockBannerJoiningAComparisonToATypeAssertion,
      {
        errors: [{ messageId: 'banner', line: 1 }],
        output: comparisonSpacedFromATypeAssertion,
      },
    ),
    invalidCase(
      'leaves a space where deleting a block banner would join a comparison and a negation into the opening of an HTML-like comment',
      blockBannerJoiningAComparisonToANegation,
      {
        errors: [{ messageId: 'banner', line: 1 }],
        output: comparisonSpacedFromANegation,
      },
    ),
    invalidCase(
      'leaves a space where deleting a block banner would join a negation and a decrement into the opening of an HTML-like comment',
      blockBannerJoiningANegationToADecrement,
      {
        errors: [{ messageId: 'banner', line: 1 }],
        output: negationSpacedFromADecrement,
      },
    ),
    invalidCase(
      'adds no space between a parenthesis and the name after a deleted block banner',
      blockBannerBetweenAParenthesisAndAName,
      {
        errors: [{ messageId: 'banner', line: 1 }],
        output: callOnAName,
      },
    ),
    invalidCase('adds no space between a name and the member access after a deleted block banner', blockBannerBeforeAMemberAccess, {
      errors: [{ messageId: 'banner', line: 1 }],
      output: memberAccessOnAName,
    }),
    invalidCase(
      'adds no space between a number and the parenthesis after a deleted block banner',
      blockBannerBetweenANumberAndAParenthesis,
      {
        errors: [{ messageId: 'banner', line: 1 }],
        output: callOnANumber,
      },
    ),
  ],
})
