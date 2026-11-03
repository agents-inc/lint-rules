import type { CaseFile } from '../rule-case-runs.ts'
import type { RuleCase } from './changed-settings.ts'

// A rule another case list or the ESLint fallback proves is left to it, as vitest's rules routed to ESLint are.

type Proof = {
  readonly reported: string
  readonly corrected: string
  /** Files the shipped options leave alone and other options of the rule report. */
  readonly silentAsShippedIn?: readonly CaseFile[]
}

function inTestFiles(rule: string, { reported, corrected, silentAsShippedIn = [] }: Proof): RuleCase {
  return {
    rule,
    silentIn: [{ path: 'src/corrected.test.tsx', source: corrected }, ...silentAsShippedIn],
    reportedIn: [{ path: 'src/reported.test.tsx', source: reported }],
  }
}

function inStories(rule: string, { reported, corrected }: Proof): RuleCase {
  return {
    rule,
    silentIn: [{ path: 'src/corrected.stories.tsx', source: corrected }],
    reportedIn: [{ path: 'src/reported.stories.tsx', source: reported }],
  }
}

export const PROOF_TESTING_LIBRARY_CASES: readonly RuleCase[] = [
  inTestFiles('testing-library/await-async-queries', {
    reported: "import { screen } from '@testing-library/react'\ntest('a', () => { const el = screen.findByRole('button') })\n",
    corrected: "import { screen } from '@testing-library/react'\ntest('a', async () => { const el = await screen.findByRole('button') })\n",
  }),
  inTestFiles('testing-library/await-async-utils', {
    reported: "import { waitFor } from '@testing-library/react'\ntest('a', () => { waitFor(() => {}) })\n",
    corrected: "import { waitFor } from '@testing-library/react'\ntest('a', async () => { await waitFor(() => {}) })\n",
  }),
  inTestFiles('testing-library/no-await-sync-events', {
    reported: "import { fireEvent } from '@testing-library/react'\ntest('a', async () => { await fireEvent.click(document.body) })\n",
    corrected: "import { fireEvent } from '@testing-library/react'\ntest('a', () => { fireEvent.click(document.body) })\n",
    silentAsShippedIn: [
      {
        path: 'src/awaited-user-event.test.tsx',
        source: "import userEvent from '@testing-library/user-event'\ntest('a', async () => { await userEvent.click(document.body) })\n",
      },
    ],
  }),
  inTestFiles('testing-library/no-await-sync-queries', {
    reported: "import { screen } from '@testing-library/react'\ntest('a', async () => { const el = await screen.getByRole('button') })\n",
    corrected: "import { screen } from '@testing-library/react'\ntest('a', () => { const el = screen.getByRole('button') })\n",
  }),
  inTestFiles('testing-library/no-debugging-utils', {
    reported: "import { screen } from '@testing-library/react'\ntest('a', () => { screen.debug() })\n",
    corrected: "import { screen } from '@testing-library/react'\ntest('a', () => { expect(screen.getByRole('button')).toBeTruthy() })\n",
  }),
  inTestFiles('testing-library/no-global-regexp-flag-in-query', {
    reported: "import { screen } from '@testing-library/react'\ntest('a', () => { screen.getByText(/foo/g) })\n",
    corrected: "import { screen } from '@testing-library/react'\ntest('a', () => { screen.getByText(/foo/) })\n",
  }),
  inTestFiles('testing-library/no-manual-cleanup', {
    reported: "import { cleanup } from '@testing-library/react'\nafterEach(cleanup)\n",
    corrected: "import { render } from '@testing-library/react'\ntest('a', () => { render(<div />) })\n",
  }),
  inTestFiles('testing-library/no-node-access', {
    reported: "import { screen } from '@testing-library/react'\ntest('a', () => { screen.getByText('a').parentElement })\n",
    corrected: "import { screen } from '@testing-library/react'\ntest('a', () => { expect(screen.getByText('a')).toBeTruthy() })\n",
    silentAsShippedIn: [
      {
        path: 'src/container-first-child.test.tsx',
        source: "import { render } from '@testing-library/react'\ntest('a', () => {\n  const { container } = render(<div />)\n  const first = container.firstChild\n})\n",
      },
    ],
  }),
  inTestFiles('testing-library/no-promise-in-fire-event', {
    reported: "import { fireEvent, screen } from '@testing-library/react'\ntest('a', () => { fireEvent.click(screen.findByRole('button')) })\n",
    corrected: "import { fireEvent, screen } from '@testing-library/react'\ntest('a', async () => { fireEvent.click(await screen.findByRole('button')) })\n",
  }),
  inTestFiles('testing-library/no-render-in-lifecycle', {
    reported: "import { render } from '@testing-library/react'\nbeforeEach(() => { render(<div />) })\n",
    corrected: "import { render } from '@testing-library/react'\ntest('a', () => { render(<div />) })\n",
  }),
  inTestFiles('testing-library/no-test-id-queries', {
    reported: "import { screen } from '@testing-library/react'\ntest('a', () => { screen.getByTestId('a') })\n",
    corrected: "import { screen } from '@testing-library/react'\ntest('a', () => { screen.getByRole('button') })\n",
  }),
  inTestFiles('testing-library/no-unnecessary-act', {
    reported: "import { act, render } from '@testing-library/react'\ntest('a', () => { act(() => { render(<div />) }) })\n",
    corrected: "import { render } from '@testing-library/react'\ntest('a', () => { render(<div />) })\n",
  }),
  inTestFiles('testing-library/no-wait-for-multiple-assertions', {
    reported: "import { waitFor } from '@testing-library/react'\ntest('a', async () => {\n  await waitFor(() => {\n    expect(el).toBe(1)\n    expect(el).toBe(2)\n  })\n})\n",
    corrected: "import { waitFor } from '@testing-library/react'\ntest('a', async () => {\n  await waitFor(() => {\n    expect(el).toBe(1)\n  })\n  expect(el).toBe(2)\n})\n",
  }),
  inTestFiles('testing-library/no-wait-for-side-effects', {
    reported: "import { waitFor, fireEvent, screen } from '@testing-library/react'\nit('a', async () => { await waitFor(() => { fireEvent.click(screen.getByText('a')) }) })\n",
    corrected:
      "import { waitFor, fireEvent, screen } from '@testing-library/react'\nit('a', async () => {\n  fireEvent.click(screen.getByText('a'))\n  await waitFor(() => { expect(screen.getByText('b')).toBeTruthy() })\n})\n",
  }),
  inTestFiles('testing-library/no-wait-for-snapshot', {
    reported: "import { waitFor } from '@testing-library/react'\nit('a', async () => { await waitFor(() => expect(1).toMatchSnapshot()) })\n",
    corrected: "import { waitFor } from '@testing-library/react'\nit('a', async () => {\n  await waitFor(() => expect(1).toBe(1))\n  expect(1).toMatchSnapshot()\n})\n",
  }),
  inTestFiles('testing-library/prefer-explicit-assert', {
    reported: "import { screen } from '@testing-library/react'\nit('a', () => { screen.getByText('a') })\n",
    corrected: "import { screen } from '@testing-library/react'\nit('a', () => { expect(screen.getByText('a')).toBeTruthy() })\n",
  }),
  inTestFiles('testing-library/prefer-find-by', {
    reported: "import { waitFor, screen } from '@testing-library/react'\nit('a', async () => { await waitFor(() => expect(screen.getByText('a')).toBeTruthy()) })\n",
    corrected: "import { screen } from '@testing-library/react'\nit('a', async () => { expect(await screen.findByText('a')).toBeTruthy() })\n",
  }),
  inTestFiles('testing-library/prefer-presence-queries', {
    reported: "import { screen } from '@testing-library/react'\nit('a', () => { expect(screen.queryByText('a')).toBeInTheDocument() })\n",
    corrected: "import { screen } from '@testing-library/react'\nit('a', () => { expect(screen.getByText('a')).toBeInTheDocument() })\n",
  }),
  inTestFiles('testing-library/prefer-query-by-disappearance', {
    reported: "import { waitForElementToBeRemoved, screen } from '@testing-library/react'\nit('a', async () => { await waitForElementToBeRemoved(() => screen.getByText('a')) })\n",
    corrected: "import { waitForElementToBeRemoved, screen } from '@testing-library/react'\nit('a', async () => { await waitForElementToBeRemoved(() => screen.queryByText('a')) })\n",
  }),
  // The reported file is the shipped options' own: with none, the rule reports nothing.
  inTestFiles('testing-library/prefer-query-matchers', {
    reported: "import { screen } from '@testing-library/react'\nit('a', () => { expect(screen.queryByText('a')).toBeVisible() })\n",
    corrected: "import { screen } from '@testing-library/react'\nit('a', () => { expect(screen.getByText('a')).toBeVisible() })\n",
  }),
  inTestFiles('testing-library/prefer-screen-queries', {
    reported: "import { render } from '@testing-library/react'\nit('a', () => { const view = render(<div />); view.getByText('a') })\n",
    corrected: "import { render, screen } from '@testing-library/react'\nit('a', () => {\n  render(<div />)\n  screen.getByText('a')\n})\n",
  }),
  inTestFiles('testing-library/prefer-user-event', {
    reported: "import { fireEvent, screen } from '@testing-library/react'\nit('a', () => { fireEvent.click(screen.getByText('a')) })\n",
    corrected:
      "import userEvent from '@testing-library/user-event'\nimport { screen } from '@testing-library/react'\nit('a', async () => {\n  const user = userEvent.setup()\n  await user.click(screen.getByText('a'))\n})\n",
  }),
  inTestFiles('testing-library/prefer-user-event-setup', {
    reported: "import userEvent from '@testing-library/user-event'\nimport { screen } from '@testing-library/react'\nit('a', async () => { await userEvent.click(screen.getByText('a')) })\n",
    corrected:
      "import userEvent from '@testing-library/user-event'\nimport { screen } from '@testing-library/react'\nit('a', async () => {\n  const user = userEvent.setup()\n  await user.click(screen.getByText('a'))\n})\n",
  }),
]

export const PROOF_STORYBOOK_CASES: readonly RuleCase[] = [
  inStories('storybook/await-interactions', {
    reported: 'export default { component: () => null }\nexport const A = { play: async () => { userEvent.click(document.body) } }\n',
    corrected: 'export default { component: () => null }\nexport const A = { play: async () => { await userEvent.click(document.body) } }\n',
  }),
  inStories('storybook/context-in-play-function', {
    reported: 'export default { component: () => null }\nexport const A = { play: async () => {} }\nexport const B = { play: async (ctx) => { await A.play() } }\n',
    corrected: 'export default { component: () => null }\nexport const A = { play: async () => {} }\nexport const B = { play: async (ctx) => { await A.play(ctx) } }\n',
  }),
  inStories('storybook/csf-component', {
    reported: "export default { title: 'Foo' }\nexport const A = {}\n",
    corrected: "export default { title: 'Foo', component: () => null }\nexport const A = {}\n",
  }),
  inStories('storybook/default-exports', {
    reported: 'export const A = {}\n',
    corrected: 'export default { component: () => null }\nexport const A = {}\n',
  }),
  inStories('storybook/hierarchy-separator', {
    reported: "export default { title: 'Foo|Bar', component: () => null }\nexport const A = {}\n",
    corrected: "export default { title: 'Foo/Bar', component: () => null }\nexport const A = {}\n",
  }),
  inStories('storybook/meta-inline-properties', {
    reported: "const t = 'Foo'\nexport default { title: t, component: () => null }\nexport const A = {}\n",
    corrected: "export default { title: 'Foo', component: () => null }\nexport const A = {}\n",
  }),
  inStories('storybook/no-redundant-story-name', {
    reported: "export default { component: () => null }\nexport const MyStory = { name: 'My Story' }\n",
    corrected: "export default { component: () => null }\nexport const MyStory = { name: 'Primary button' }\n",
  }),
  inStories('storybook/no-renderer-packages', {
    reported: "import type { Meta } from '@storybook/react'\nexport default { component: () => null } as Meta\nexport const A = {}\n",
    corrected: "import type { Meta } from '@storybook/react-vite'\nexport default { component: () => null } as Meta\nexport const A = {}\n",
  }),
  inStories('storybook/no-stories-of', {
    reported: "import { storiesOf } from '@storybook/react'\nstoriesOf('Foo', module).add('a', () => null)\n",
    corrected: "export default { title: 'Foo', component: () => null }\nexport const A = {}\n",
  }),
  inStories('storybook/prefer-pascal-case', {
    reported: 'export default { component: () => null }\nexport const myStory = {}\n',
    corrected: 'export default { component: () => null }\nexport const MyStory = {}\n',
  }),
  inStories('storybook/story-exports', {
    reported: 'export default { component: () => null }\n',
    corrected: 'export default { component: () => null }\nexport const A = {}\n',
  }),
  inStories('storybook/use-storybook-expect', {
    reported: 'export default { component: () => null }\nexport const A = { play: async () => { expect(1).toBe(1) } }\n',
    corrected: "import { expect } from 'storybook/test'\nexport default { component: () => null }\nexport const A = { play: async () => { expect(1).toBe(1) } }\n",
  }),
  inStories('storybook/use-storybook-testing-library', {
    reported: "import { within } from '@testing-library/dom'\nexport default { component: () => null }\nexport const A = { play: async () => { within(document.body) } }\n",
    corrected: "import { within } from 'storybook/test'\nexport default { component: () => null }\nexport const A = { play: async () => { within(document.body) } }\n",
  }),
]
