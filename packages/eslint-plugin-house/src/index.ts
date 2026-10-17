import { dialogHasAccessibleName } from './rules/dialog-has-accessible-name.ts'
import { hookFileNaming } from './rules/hook-file-naming.ts'
import { maxHooksPerComponent } from './rules/max-hooks-per-component.ts'
import { namedHookCallback } from './rules/named-hook-callback.ts'
import { noClassicLoops } from './rules/no-classic-loops.ts'
import { noControlledFieldWithoutChangeHandler } from './rules/no-controlled-field-without-change-handler.ts'
import { noCreateContextInRender } from './rules/no-create-context-in-render.ts'
import { noCreateObjectUrlInRender } from './rules/no-create-object-url-in-render.ts'
import { noFocusableContentInAriaHidden } from './rules/no-focusable-content-in-aria-hidden.ts'
import { noNestedInteractive } from './rules/no-nested-interactive.ts'
import { noPlaceholderOnlyField } from './rules/no-placeholder-only-field.ts'
import { noSectionBanner } from './rules/no-section-banner.ts'
import { noSideEffectInStateUpdater } from './rules/no-side-effect-in-state-updater.ts'
import { noSuppressions } from './rules/no-suppressions.ts'
import { noUnstableListKeys } from './rules/no-unstable-list-keys.ts'
import { preferLineComments } from './rules/prefer-line-comments.ts'
import { requireClassHelper } from './rules/require-class-helper.ts'

/** Typed with typescript-eslint's rule types, which `ESLint.Plugin` does not fit; ESLint checks the shape at load. */
export const housePlugin = {
  meta: { name: 'house', namespace: 'house' },
  rules: {
    'dialog-has-accessible-name': dialogHasAccessibleName,
    'hook-file-naming': hookFileNaming,
    'max-hooks-per-component': maxHooksPerComponent,
    'named-hook-callback': namedHookCallback,
    'no-classic-loops': noClassicLoops,
    'no-controlled-field-without-change-handler': noControlledFieldWithoutChangeHandler,
    'no-create-context-in-render': noCreateContextInRender,
    'no-create-object-url-in-render': noCreateObjectUrlInRender,
    'no-focusable-content-in-aria-hidden': noFocusableContentInAriaHidden,
    'no-nested-interactive': noNestedInteractive,
    'no-placeholder-only-field': noPlaceholderOnlyField,
    'no-section-banner': noSectionBanner,
    'no-side-effect-in-state-updater': noSideEffectInStateUpdater,
    'no-suppressions': noSuppressions,
    'no-unstable-list-keys': noUnstableListKeys,
    'prefer-line-comments': preferLineComments,
    'require-class-helper': requireClassHelper,
  },
}
