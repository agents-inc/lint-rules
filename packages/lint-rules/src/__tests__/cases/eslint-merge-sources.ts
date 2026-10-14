// Sources the ESLint merge specs lint, each drawing the rule its comment names.

/** Draws @eslint-react's no-missing-key, under either of its names, once: the list item has no key. */
export const listItemWithoutAKey = `export const Items = ({ items }: { readonly items: readonly string[] }) => (
  <ul>
    {items.map((item) => <li>{item}</li>)}
  </ul>
)
`
