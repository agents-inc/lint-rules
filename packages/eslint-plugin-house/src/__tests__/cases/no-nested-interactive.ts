export const nestedControlsLinksAndForms = `export function RowActions({ onRename, onOpen, name }: { onRename: (v: string) => void; onOpen: () => void; name: string }) {
  return (
    <div>
      <button type="button" onClick={onOpen}>
        <span>{name}</span>
        <input value={name} onChange={e => onRename(e.target.value)} />
        <button type="button" onClick={onRename as unknown as () => void}>Rename</button>
        <span onClick={onRename as unknown as () => void}>x</span>
      </button>
      <a href="/a">
        <a href="/b">inner</a>
        <img src="/i.png" alt="" onClick={onOpen} />
      </a>
      <form onSubmit={onOpen as unknown as () => void}>
        <form onSubmit={onOpen as unknown as () => void}>
          <button type="submit">go</button>
        </form>
      </form>
    </div>
  )
}`

export const siblingButtons = `export function Toolbar({ onSave, onCancel }: { readonly onCancel: () => void; readonly onSave: () => void; }) {
  return (
    <div className="toolbar">
      <button onClick={onSave} type="button">Save</button>
      <button onClick={onCancel} type="button">Cancel</button>
    </div>
  )
}
`

export const buttonInsideClickableDiv = `export function Card({ onSelect, onDelete, title }: { readonly onDelete: () => void; readonly onSelect: () => void; readonly title: string }) {
  return (
    <div className="card" onClick={onSelect} role="presentation">
      <h3>{title}</h3>
      <button onClick={onDelete} type="button">Delete</button>
    </div>
  )
}
`

export const linksInsideListInsideNav = `export function SiteNav({ links }: { readonly links: Array<{ href: string; label: string }> }) {
  return (
    <nav aria-label="Main">
      <ul>
        {links.map(link => (
          <li key={link.href}>
            <a href={link.href}>{link.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
`

export const controlsInsideOneForm = `export function SearchForm({ onSubmit }: { readonly onSubmit: () => void }) {
  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="q">Query</label>
      <input id="q" name="q" />
      <select name="scope"><option value="all">All</option></select>
      <textarea name="notes" />
      <button type="submit">Search</button>
      <a href="/help">Help</a>
    </form>
  )
}
`

export const nonClickableChildrenInsideLink = `export function IconLink({ href, label }: { readonly href: string; readonly label: string }) {
  return (
    <a className="icon-link" href={href}>
      <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M0 0h16v16H0z" /></svg>
      <span>{label}</span>
      <Badge onClick={undefined} />
    </a>
  )
}
function Badge(props: { readonly onClick?: () => void }) {
  return <em {...props}>new</em>
}
`

export const backdropBesidePanel = `export function Backdrop({ open, onClose, children }: { readonly children: React.ReactNode; readonly onClose: () => void; readonly open: boolean; }) {
  if (!open) return null
  return (
    <>
      <div className="backdrop" onClick={onClose} role="presentation" />
      <div className="panel">
        {children}
        <button onClick={onClose} type="button">Close</button>
      </div>
    </>
  )
}
`

export const clickableChildInsideHreflessAnchor = `export function Breadcrumb({ onExpand }: { readonly onExpand: () => void }) {
  return (
    <a className="crumb">
      <span onClick={onExpand} role="presentation">…</span>
    </a>
  )
}
`

export const labelledFieldsAndClickableDivInsideForm = `export function Filters({ onApply, onReset }) {
  return (
    <form onSubmit={onApply}>
      <fieldset>
        <label>
          Name
          <input name="name" />
        </label>
        <label htmlFor="tier">Tier</label>
        <select id="tier"><option>Free</option></select>
      </fieldset>
      <div className="row">
        <button type="submit">Apply</button>
        <div onClick={onReset} role="presentation">Reset</div>
      </div>
    </form>
  )
}
`

export const triggerBesideMenu = `export function OptionsMenu({ open, onToggle, onRename, onDelete }: {
  readonly onDelete: () => void; readonly onRename: () => void; readonly onToggle: () => void; readonly open: boolean;
}) {
  return (
    <div className="relative">
      <button aria-expanded={open} onClick={onToggle} type="button">
        <span className="sr-only">Options</span>
        <svg aria-hidden="true" viewBox="0 0 4 16"><circle cx="2" cy="2" r="2" /></svg>
      </button>
      {open ? <ul className="absolute right-0" role="menu">
          <li><button onClick={onRename} role="menuitem" type="button">Rename</button></li>
          <li><button onClick={onDelete} role="menuitem" type="button">Delete</button></li>
        </ul> : null}
    </div>
  )
}
`

export const childrenFromPropsInsideLink = `export function TrackedLink({ href, children, onNavigate }: {
  readonly children: React.ReactNode; readonly href: string; readonly onNavigate: (href: string) => void
}) {
  return (
    <a className="tracked" href={href} onClick={() => onNavigate(href)}>
      {children}
    </a>
  )
}
`

export const deepNestingInsideOneForm = `export function AdvancedSearch({ onSubmit, onReset }: { readonly onReset: () => void; readonly onSubmit: () => void; }) {
  return (
    <form onReset={onReset} onSubmit={onSubmit}>
      <details>
        <summary>Advanced</summary>
        <fieldset>
          <legend>Range</legend>
          <label>
            From
            <input name="from" type="date" />
          </label>
          <label>
            To
            <input name="to" type="date" />
          </label>
        </fieldset>
      </details>
      <footer>
        <button type="reset">Reset</button>
        <button type="submit">Search</button>
      </footer>
    </form>
  )
}
`

export const hiddenInputInsideButton = `export function SubmitRow({ token, label }: { readonly label: string; readonly token: string; }) {
  return (
    <form action="/pay" method="post">
      <button name="intent" type="submit" value="pay">
        <input name="csrf" type="hidden" value={token} />
        {label}
      </button>
    </form>
  )
}
`

/** A button holding a select written `type="hidden"`, which hides only an input, on line 4. */
export const selectTypedHiddenInsideButton = `export function SortButton() {
  return (
    <button type="button">
      <select name="sort" type="hidden"><option>A</option></select>
      Sort
    </button>
  )
}
`

/** A button holding an input whose type is written as `typeAttribute`, on line 4. */
export function inputTypedByInsideButton(typeAttribute: string): string {
  return `export function SubmitRow({ kind, token }: { readonly kind: string; readonly token: string }) {
  return (
    <button name="intent" type="submit" value="pay">
      <input name="csrf" ${typeAttribute} value={token} />
      Pay
    </button>
  )
}
`
}

export const textareaInsideButton = `export function Composer() {
  return (
    <button type="button">
      <textarea />
    </button>
  )
}
`

export const linkInsideLinkModule = `export function Crumbs() {
  return <a href="/a"><a href="/b">b</a></a>
}
`

export const inputInsideButtonModule = `export function Composer() {
  return <button type="button"><input /></button>
}
`

export const clickHandlerInsideButtonModule = `export function Row({ open }) {
  return <button type="button"><span onClick={open}>x</span></button>
}
`
