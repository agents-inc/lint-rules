import type { HeldCase } from '../accepted-rules-out-of-place.ts'
import type { RuleCase } from './changed-settings.ts'

// Each file is a test that passes under Vitest 5.0.5 with jsdom, Testing Library and jest-dom 6.9.1 (measured).

const TEST_WITH_JEST_DOM = `import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'

`

/** On jest-dom 6.9.1 the last reported file of each, and the last two of prefer-in-document, pass as written and fail as fixed. */
export const ACCEPTED_JEST_DOM_CASES: readonly RuleCase[] = [
  {
    rule: 'jest-dom/prefer-checked',
    silentIn: [
      {
        path: 'src/terms-checked.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('starts with the terms accepted', () => {
  render(<input type="checkbox" aria-label="Accept the terms" defaultChecked />)

  expect(screen.getByRole('checkbox')).toBeChecked()
})
`,
      },
      {
        path: 'src/newsletter-unchecked.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('leaves the newsletter unticked', () => {
  render(<input type="checkbox" aria-label="Send me the newsletter" />)

  expect(screen.getByRole('checkbox')).not.toBeChecked()
})
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/terms-checked-attribute.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('starts with the terms accepted', () => {
  render(<input type="checkbox" aria-label="Accept the terms" defaultChecked />)

  expect(screen.getByRole('checkbox')).toHaveAttribute('checked')
})
`,
      },
      {
        path: 'src/newsletter-checked-property.test.jsx',
        source: `${TEST_WITH_JEST_DOM}it('leaves the newsletter unticked', () => {
  render(<input type="checkbox" aria-label="Send me the newsletter" />)

  expect(screen.getByRole('checkbox').checked).toBe(false)
})
`,
      },
      {
        path: 'src/dark-mode-switch.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('turns dark mode on', () => {
  render(<button type="button" role="switch" aria-checked="true">Dark mode</button>)

  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
})
`,
      },
      {
        path: 'src/dark-mode-switch-presence.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('offers dark mode as a switch', () => {
  render(<button type="button" role="switch" aria-checked="false">Dark mode</button>)

  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked')
})
`,
      },
    ],
  },
  {
    rule: 'jest-dom/prefer-empty',
    silentIn: [
      {
        path: 'src/empty-cart.test.tsx',
        source: `${TEST_WITH_JEST_DOM}const EmptyCart = () => null

it('renders nothing for an empty cart', () => {
  const { container } = render(<EmptyCart />)

  expect(container).toBeEmptyDOMElement()
})
`,
      },
      {
        path: 'src/saved-status-markup.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('announces the save', () => {
  render(<p role="status">Saved</p>)

  expect(screen.getByRole('status').innerHTML).toBe('Saved')
})
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/empty-cart-first-child.test.tsx',
        source: `${TEST_WITH_JEST_DOM}const EmptyCart = () => null

it('renders nothing for an empty cart', () => {
  const { container } = render(<EmptyCart />)

  expect(container.firstChild).toBeNull()
})
`,
      },
      {
        path: 'src/quiet-status-markup.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('announces nothing before a save', () => {
  render(<p role="status" />)

  expect(screen.getByRole('status').innerHTML).toBe('')
})
`,
      },
      {
        path: 'src/fragment-first-child-null.test.tsx',
        source: `import { render } from '@testing-library/react'
import { expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'

const NoNotice = () => null

it('renders nothing without a notice', () => {
  const { asFragment } = render(<NoNotice />)

  expect(asFragment().firstChild).toBeNull()
})
`,
      },
    ],
  },
  {
    rule: 'jest-dom/prefer-in-document',
    silentIn: [
      {
        path: 'src/payment-error-absent.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('shows no error before a payment', () => {
  render(<form aria-label="Payment" />)

  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
`,
      },
      {
        path: 'src/three-invoices.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('lists every invoice', () => {
  render(
    <ul>
      <li>March</li>
      <li>April</li>
      <li>May</li>
    </ul>,
  )

  expect(screen.getAllByRole('listitem')).toHaveLength(3)
})
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/payment-error-null.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('shows no error before a payment', () => {
  render(<form aria-label="Payment" />)

  expect(screen.queryByRole('alert')).toBeNull()
})
`,
      },
      {
        path: 'src/share-button-without-jest-dom.test.tsx',
        source: `import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

it('offers to share the document', () => {
  render(<button type="button" data-testid="share-button">Share</button>)

  expect(screen.getByTestId('share-button')).toBeTruthy()
})
`,
      },
      {
        path: 'src/all-invoices-truthy.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('lists the invoices', () => {
  render(
    <ul>
      <li>March</li>
      <li>April</li>
    </ul>,
  )

  expect(screen.getAllByRole('listitem')).toBeTruthy()
})
`,
      },
      {
        path: 'src/detached-row-truthy.test.tsx',
        source: `import { render } from '@testing-library/react'
import { expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'

it('renders the invoice row', () => {
  const { getByText } = render(
    <tr>
      <td>March</td>
    </tr>,
    { container: document.createElement('tbody') },
  )

  expect(getByText('March')).toBeTruthy()
})
`,
      },
    ],
  },
  {
    rule: 'jest-dom/prefer-pressed',
    silentIn: [
      {
        path: 'src/bold-pressed.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('presses bold', () => {
  render(<button type="button" aria-pressed="true">Bold</button>)

  expect(screen.getByRole('button', { name: 'Bold' })).toBePressed()
})
`,
      },
      {
        path: 'src/italic-not-pressed.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('leaves italic off', () => {
  render(<button type="button" aria-pressed="false">Italic</button>)

  expect(screen.getByRole('button', { name: 'Italic' })).not.toBePressed()
})
`,
      },
      {
        path: 'src/menu-expanded-attribute.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('opens the menu', () => {
  render(<button type="button" aria-expanded="true">Menu</button>)

  expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'true')
})
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/bold-pressed-attribute.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('presses bold', () => {
  render(<button type="button" aria-pressed="true">Bold</button>)

  expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true')
})
`,
      },
      {
        path: 'src/italic-not-pressed-attribute.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('leaves italic off', () => {
  render(<button type="button" aria-pressed="false">Italic</button>)

  expect(screen.getByRole('button', { name: 'Italic' })).toHaveAttribute('aria-pressed', 'false')
})
`,
      },
      {
        path: 'src/italic-toggle-presence.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('offers italic as a toggle', () => {
  render(<button type="button" aria-pressed="false">Italic</button>)

  expect(screen.getByRole('button', { name: 'Italic' })).toHaveAttribute('aria-pressed')
})
`,
      },
    ],
  },
  {
    rule: 'jest-dom/prefer-required',
    silentIn: [
      {
        path: 'src/name-required.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('requires a name', () => {
  render(<input aria-label="Name" required />)

  expect(screen.getByRole('textbox', { name: 'Name' })).toBeRequired()
})
`,
      },
      {
        path: 'src/nickname-optional.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('leaves the nickname optional', () => {
  render(<input aria-label="Nickname" />)

  expect(screen.getByRole('textbox', { name: 'Nickname' })).not.toBeRequired()
})
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/name-required-attribute.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('requires a name', () => {
  render(<input aria-label="Name" required />)

  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('required')
})
`,
      },
      {
        path: 'src/email-aria-required.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('requires an email', () => {
  render(<input aria-label="Email" aria-required="true" />)

  expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAttribute('aria-required', 'true')
})
`,
      },
      {
        path: 'src/email-aria-required-presence.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('states whether the email is required', () => {
  render(<input aria-label="Email" aria-required="false" />)

  expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAttribute('aria-required')
})
`,
      },
    ],
  },
  {
    rule: 'jest-dom/prefer-to-have-attribute',
    silentIn: [
      {
        path: 'src/menu-expanded.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('opens the menu', () => {
  render(<button type="button" aria-expanded="true">Menu</button>)

  expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'true')
})
`,
      },
      {
        path: 'src/help-link-same-tab.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('opens the help in the same tab', () => {
  render(<a href="/help">Help</a>)

  expect(screen.getByRole('link', { name: 'Help' })).not.toHaveAttribute('target')
})
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/menu-expanded-get-attribute.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('opens the menu', () => {
  render(<button type="button" aria-expanded="true">Menu</button>)

  expect(screen.getByRole('button', { name: 'Menu' }).getAttribute('aria-expanded')).toBe('true')
})
`,
      },
      {
        path: 'src/help-link-target-null.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('opens the help in the same tab', () => {
  render(<a href="/help">Help</a>)

  expect(screen.getByRole('link', { name: 'Help' }).getAttribute('target')).toBeNull()
})
`,
      },
      {
        path: 'src/parsed-link-rel.test.jsx',
        source: `import { expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'

const linkHtml = (text, href) => \`<a href="\${href}" rel="noopener">\${text}</a>\`

it('renders a link that opens no window reference', () => {
  const link = new DOMParser().parseFromString(linkHtml('Docs', '/docs'), 'text/html').querySelector('a')

  expect(link.getAttribute('rel')).toBe('noopener')
})
`,
      },
    ],
  },
  {
    rule: 'jest-dom/prefer-to-have-class',
    silentIn: [
      {
        path: 'src/active-tab.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('marks the open tab active', () => {
  render(<button type="button" className="tab active">Invoices</button>)

  expect(screen.getByRole('button', { name: 'Invoices' })).toHaveClass('active')
})
`,
      },
      {
        path: 'src/idle-tab.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('leaves the other tab idle', () => {
  render(<button type="button" className="tab">Payments</button>)

  expect(screen.getByRole('button', { name: 'Payments' })).not.toHaveClass('active')
})
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/active-tab-class-list.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('marks the open tab active', () => {
  render(<button type="button" className="tab active">Invoices</button>)

  expect(screen.getByRole('button', { name: 'Invoices' }).classList.contains('active')).toBe(true)
})
`,
      },
      {
        path: 'src/active-tab-class-name.test.tsx',
        source: `${TEST_WITH_JEST_DOM}it('marks the open tab active', () => {
  render(<button type="button" className="tab active">Invoices</button>)

  expect(screen.getByRole('button', { name: 'Invoices' }).className).toContain('active')
})
`,
      },
      {
        path: 'src/active-tab-css-module.test.tsx',
        source: `${TEST_WITH_JEST_DOM}import styles from './tab.module.css'

it('marks the open tab active', () => {
  render(<button type="button" className={\`\${styles.tab} \${styles.active}\`}>Invoices</button>)

  expect(screen.getByRole('button', { name: 'Invoices' }).className).toContain('active')
})
`,
      },
    ],
  },
]

export const ACCEPTED_JD_HELD_CASES: ReadonlyArray<HeldCase<RuleCase>> = []
