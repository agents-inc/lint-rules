// Each fix check would apply here turned a passing Vitest test red under jsdom 29.1.1 or 30.1.3 (measured with
// eslint-plugin-unicorn 78.0.0, eslint-plugin-testing-library and oxlint 1.87.0), apart from the three the owner kept
// and the plain useless spread.

/** A file, the line check reports it on, and the rule that reports it there. */
type ReportedFile = { readonly file: string; readonly source: string; readonly line: number; readonly rule: string }

/** A file as written and as a fix leaves it. */
type FixedFile = { readonly file: string; readonly source: string; readonly fixed: string }

type WrittenFile = { readonly file: string; readonly source: string }

// Kept out of the address so this repository's own prefer-https does not report the fixture.
const INSECURE_SCHEME = 'http'

/**
 * Each file whose fix check withholds, in path order as check prints their findings, and what the fix would break:
 * a handler bound twice running twice, `CSS.escape` before jsdom 30, a snapshot of the http:// address, a link's test
 * no longer typechecking, a list that no longer updates itself, an insert into an empty list throwing, a missing
 * attribute reading undefined, and a key event built with only a key code.
 */
export const CODE_A_WITHHELD_JSDOM_FIX_WOULD_BREAK: readonly ReportedFile[] = [
  {
    file: 'src/bind-counter.ts',
    source: `export const bindCounter = (button: HTMLButtonElement, counter: { clicks: number }) => {
  button.onclick = () => {
    counter.clicks += 1
  }
}
`,
    line: 2,
    rule: 'unicorn/prefer-add-event-listener',
  },
  {
    file: 'src/find-row.ts',
    source: 'export const findRow = (id: string) => document.querySelector(`[data-row-id="${id}"]`)\n',
    line: 1,
    rule: 'unicorn/require-css-escape',
  },
  {
    file: 'src/guide-link.ts',
    source: `export const guideLink = () => {
  const link = document.createElement('a')
  link.href = '${INSECURE_SCHEME}://docs.example.com/guide'
  link.textContent = 'Guide'
  return link
}
`,
    line: 3,
    rule: 'unicorn/prefer-https',
  },
  {
    file: 'src/help-link.test.tsx',
    source: `import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

it('opens the help in the same tab', () => {
  render(<a href="/help">Help</a>)

  expect(screen.getByRole('link', { name: 'Help' }).getAttribute('target')).toBeNull()
})
`,
    line: 7,
    rule: 'testing-library/prefer-presence-queries',
  },
  {
    file: 'src/items-in.ts',
    source: "export const itemsIn = (root: Element) => root.getElementsByClassName('item')\n",
    line: 1,
    rule: 'unicorn/prefer-query-selector',
  },
  {
    file: 'src/prepend-to.ts',
    source: `export const prependTo = (list: Element, item: Element) => {
  const first = list.firstChild
  list.insertBefore(item, first)
}
`,
    line: 3,
    rule: 'unicorn/prefer-modern-dom-apis',
  },
  {
    file: 'src/state-of.ts',
    source: "export const stateOf = (element: HTMLElement) => element.getAttribute('data-state')\n",
    line: 1,
    rule: 'unicorn/dom-node-dataset',
  },
  {
    file: 'src/watch-enter.ts',
    source: `export const watchEnter = (input: HTMLInputElement, onEnter: () => void) => {
  input.addEventListener('keydown', (event) => {
    if (event.keyCode === 13) {
      onEnter()
    }
  })
}
`,
    line: 3,
    rule: 'unicorn/prefer-keyboard-event-key',
  },
]

/**
 * Each file whose fix the owner kept, in path order: no-selector-as-dom-name drops the dot, no-unnecessary-fetch-options
 * drops `{ method: 'GET' }` from a fetch of a literal address, which it tells from a Request without type information,
 * prefer-queue-microtask swaps `process.nextTick`.
 */
export const CODE_A_KEPT_FIX_REWRITES: readonly FixedFile[] = [
  {
    file: 'src/activate.ts',
    source: `export const activate = (element: Element) => {
  element.classList.add('.active')
}
`,
    fixed: `export const activate = (element: Element) => {
  element.classList.add('active')
}
`,
  },
  {
    file: 'src/load-greeting.ts',
    source: `export const loadGreeting = async () => {
  const response = await fetch('/greeting', { method: 'GET' })
  return response.text()
}
`,
    fixed: `export const loadGreeting = async () => {
  const response = await fetch('/greeting')
  return response.text()
}
`,
  },
  {
    file: 'src/soon.ts',
    source: `export const soon = (callback: () => void) => {
  process.nextTick(callback)
}
`,
    fixed: `export const soon = (callback: () => void) => {
  queueMicrotask(callback)
}
`,
  },
]

/** prefer-location-assign's fix writes `window.location.assign(address)`, which a test's stand-in location lacks. */
export const A_LOCATION_WRITE: WrittenFile = {
  file: 'src/go-to.ts',
  source: `export const goTo = (address: string) => {
  window.location.href = address
}
`,
}

/**
 * oxlint's no-useless-spread removes this spread, so the function returns an iterator; ESLint's leaves it, and
 * prefer-iterator-to-array reports it, its rewrite to `.toArray()` a suggestion check never applies.
 */
export const A_SPREAD_OF_AN_ITERATOR_MAP: WrittenFile & { readonly finding: string } = {
  file: 'src/item-texts.ts',
  source: "export const itemTexts = (list: Element) => [...list.querySelectorAll('li').values().map((item) => item.textContent)]\n",
  finding: 'src/item-texts.ts:1 unicorn/prefer-iterator-to-array',
}

/** Both engines' no-useless-spread report this spread and remove it; held, the rule runs in neither. */
export const A_USELESS_SPREAD: WrittenFile = {
  file: 'src/unique-names.ts',
  source: 'export const uniqueNames = (names: Iterable<string>) => new Set([...names])\n',
}

/**
 * Each loop walks a copy of a live list it shrinks, in path order. ESLint's no-useless-spread removes the copy, so the
 * loop skips items; held, the rule runs in neither engine. The class lookup is prefer-query-selector's.
 */
export const LOOPS_OVER_A_COPY_OF_A_LIVE_LIST: ReadonlyArray<WrittenFile & { readonly findings: readonly string[] }> = [
  {
    file: 'src/clear-items.ts',
    source: `export const clearItems = (root: Element) => {
  for (const item of [...root.getElementsByClassName('item')]) {
    item.classList.remove('item')
  }
}
`,
    findings: ['src/clear-items.ts:2 unicorn/prefer-query-selector'],
  },
  {
    file: 'src/empty-out.ts',
    source: `export const emptyOut = (parent: Element) => {
  for (const child of [...parent.childNodes]) {
    child.remove()
  }
}
`,
    findings: [],
  },
]
