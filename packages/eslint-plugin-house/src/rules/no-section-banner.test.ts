import {
  bannerAloneOnItsLine,
  bannerAndLabelBlock,
  bareReturnAboveUnreachableValue,
  blockBannerTrailingCode,
  cliFlagComments,
  comparisonInProse,
  dashNote,
  declarationsWithoutComment,
  docBlockWithMarkdownHeading,
  docBlockWithTitledHeading,
  explanatoryComment,
  functionWithoutComment,
  indentedTitledBanner,
  labelLeftAfterFirstPass,
  labelTrailingCode,
  lintDirectiveReason,
  markdownTableComments,
  multiLineBlockBannerAfterReturn,
  multiLineBlockBannerBetweenStatements,
  multiLineBlockBannerEndingItsLine,
  paragraphBetweenRuns,
  spacedHyphens,
  titledAsteriskBanner,
  titledBannerFramingASentence,
  titledBannerTrailingCode,
  titledBannerWithShortLeadingRun,
  titledBlockBanner,
  titledBlockBannerTrailingCode,
  titledDashBanner,
  titledEqualsBanner,
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
  ],
})
