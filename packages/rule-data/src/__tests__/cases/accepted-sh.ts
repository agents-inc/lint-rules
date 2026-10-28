import type { RuleCase } from './changed-settings.ts'

// The shadcn rule the owner accepted on 2026-10-24: it reports a colour from Tailwind's own palette in a class, and a
// colour written out on an SVG element, a check its options cannot turn off. It stays silent on a theme token, on the
// colours it leaves to an option (white and black) or never judges (transparent, current), on an SVG painted with
// currentColor, and on a string that is no class, at its defaults. The case project has no Tailwind theme, so a token
// is silent here for want of a theme to judge it by; on a Tailwind v4 project the rule also reports a token its theme
// does not declare (measured in the lane's real run: the runner writes no stylesheet).

/** The shipped accepted shadcn rule's report cases beside their silent twins. */
export const ACCEPTED_SHADCN_CASES: readonly RuleCase[] = [
  {
    rule: 'shadcn/no-raw-colors',
    subject: 'a palette colour in a class',
    silentIn: [
      { path: 'src/payment-error-token.tsx', source: 'export const PaymentError = () => <p className="text-destructive">Payment failed</p>\n' },
      { path: 'src/plain-card.tsx', source: 'export const PlainCard = () => <div className="bg-white text-black">Receipt</div>\n' },
      { path: 'src/ghost-button.tsx', source: 'export const GhostButton = () => <button className="border-current bg-transparent text-current">Cancel</button>\n' },
      {
        path: 'src/payment-error.test.tsx',
        source: `import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { PaymentError } from './payment-error'

it('marks the failure in red', () => {
  render(<PaymentError />)

  expect(screen.getByText('Payment failed')).toHaveClass('text-red-500')
})
`,
      },
    ],
    reportedIn: [
      { path: 'src/payment-error.tsx', source: 'export const PaymentError = () => <p className="text-red-500">Payment failed</p>\n' },
      {
        path: 'src/amount-field.tsx',
        source: `import { cn } from '@/lib/utils'

export const AmountField = ({ invalid }: { invalid: boolean }) => <input className={cn('rounded-md border px-3', invalid && 'border-red-600')} />
`,
      },
      { path: 'src/invoice-row.tsx', source: 'export const InvoiceRow = () => <li className="px-2 hover:bg-slate-100">Invoice</li>\n' },
      {
        path: 'src/badge-variants.ts',
        source: `import { cva } from 'class-variance-authority'

export const badgeVariants = cva('rounded px-2', { variants: { tone: { danger: 'bg-red-600', calm: 'bg-primary' } } })
`,
      },
      { path: 'src/overdue-notice.jsx', source: 'export const OverdueNotice = () => <div role="alert" className="border-amber-300">Overdue</div>\n' },
    ],
  },
  {
    rule: 'shadcn/no-raw-colors',
    subject: 'a colour written out on an SVG element',
    silentIn: [
      {
        path: 'src/status-dot-current.tsx',
        source: `export const StatusDot = () => (
  <svg className="text-destructive" viewBox="0 0 8 8">
    <circle cx="4" cy="4" r="3" fill="none" stroke="currentColor" />
  </svg>
)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/status-dot.tsx',
        source: `export const StatusDot = () => (
  <svg viewBox="0 0 8 8">
    <circle cx="4" cy="4" r="4" fill="#ef4444" />
  </svg>
)
`,
      },
    ],
  },
]
