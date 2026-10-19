export const ariaHiddenAroundButton = `export function Toolbar() {
  return (
    <div aria-hidden="true">
      <span>Decorative</span>
      <button onClick={() => {}}>Undo</button>
    </div>
  )
}`

export const decorationOnly = `export function Badge() {
  return (
    <div aria-hidden="true">
      <span>★</span>
      <i className="icon-star" />
    </div>
  )
}
`

export const focusableSibling = `export function Field() {
  return (
    <label>
      <span aria-hidden="true">
        <svg viewBox="0 0 16 16"><path d="M0 0h16v16H0z" /></svg>
      </span>
      <input name="email" type="text" />
      <button type="submit">Go</button>
    </label>
  )
}
`

export const controlsParkedWithNegativeTabIndex = `export function Ghost() {
  return (
    <div aria-hidden="true">
      <button tabIndex={-1} type="button">Placeholder</button>
      <a href="/docs" tabIndex={-1}>Docs</a>
    </div>
  )
}
`

export const inertDynamicFalseHreflessAndHidden = `export function Skeleton({ busy }: { readonly busy: boolean }) {
  return (
    <>
      <div aria-hidden="true" inert>
        <button type="button">Loading</button>
      </div>
      <div aria-hidden={busy}>
        <a href="/next">Next</a>
      </div>
      <div aria-hidden="false">
        <select name="sort"><option>A</option></select>
      </div>
      <div aria-hidden="true">
        <a>Not a link, no href</a>
        <input name="csrf" type="hidden" value="x" />
      </div>
    </>
  )
}
`

export const focusableElementPassedAsProp = `import { Modal } from './modal'

export function Decor() {
  return (
    <div aria-hidden="true">
      <Modal footer={<button type="button">Close</button>} />
      <span>—</span>
    </div>
  )
}
`

export const componentAndNonFocusableDescendants = `import * as Icons from './icons'
import { Star } from './star'

export function Stars({ rate }: { readonly rate: number }) {
  return (
    <div aria-hidden="true">
      <Star value={rate} />
      <Icons.Chevron size={12} />
      <svg><use xlinkHref="#star" /></svg>
      <img alt="" src="/x.png" />
      <canvas height={10} width={10} />
    </div>
  )
}
`

export const disabledAndUnreadableTabIndex = `export function Tricky({ decorative, idx }: { readonly decorative: boolean; readonly idx: number }) {
  return (
    <>
      <div aria-hidden={decorative}>
        <button type="button">Maybe hidden</button>
      </div>
      <div aria-hidden="true">
        <button disabled type="button">Never focusable</button>
        <span tabIndex={-1}>parked</span>
        <a href="#x" tabIndex={idx < 0 ? -1 : -1}>unknown tabIndex</a>
      </div>
    </>
  )
}
`

export const checkboxBesideAriaHiddenTrack = `<label className={clsx(className, styles.switch)}>
  <input
    aria-checked={checked}
    aria-disabled={disabled}
    checked={checked}
    disabled={disabled}
    onChange={handleChange}
    role="switch"
    type="checkbox"
    {...props}
  />
  <span aria-hidden="true" className={styles.switchTrack}>
    <span aria-hidden="true" className={styles.switchThumb} />
  </span>
  {label ? <span className={clsx(styles.switchLabel)}>{label}</span> : null}
</label>
`

export const inertAncestor = `export function Backdrop({ children }: { readonly children: React.ReactNode }) {
  return (
    <div inert>
      <div aria-hidden="true" className="scrim">
        <button type="button">Dismiss</button>
      </div>
      {children}
    </div>
  )
}
`

export const decorativeListConditionalAndCall = `export function Rating({ score, icons }: { readonly icons: string[]; readonly score: number; }) {
  return (
    <div aria-hidden="true">
      {icons.map(icon => <span className={icon} key={icon} />)}
      {score > 0 ? <strong>{score}</strong> : null}
      {renderTicks()}
    </div>
  )
}
`

export const ariaHiddenBesideSpreads = `export function Chip({ rest, iconProps }: { readonly iconProps: object; readonly rest: object; }) {
  return (
    <>
      <div {...rest} aria-hidden="true">
        <span {...iconProps} />
      </div>
      <div {...{ 'aria-hidden': true }}>
        <span>plain</span>
      </div>
    </>
  )
}
`

export const nestedDecorativeWrappers = `export function Track() {
  return (
    <span aria-hidden="true" className="track">
      <span aria-hidden="true" className="thumb">
        <svg><path d="M0 0h4v4H0z" /></svg>
      </span>
    </span>
  )
}
`

export const inertPartWayDown = `export function Shell() {
  return (
    <div aria-hidden="true">
      <span>label</span>
      <div inert>
        <button type="button">Retry</button>
      </div>
    </div>
  )
}
`

export const ariaHiddenControlsOutOfTabOrder = `export function Row({ on }: { readonly on: boolean }) {
  return (
    <>
      <Switch aria-hidden="true" checked={on} tabIndex={-1} />
      <a aria-hidden="true">no href, not focusable</a>
      <input aria-hidden="true" disabled />
      <span aria-hidden="true" tabIndex={-1} />
    </>
  )
}
`

/** An input whose type is written as `typeAttribute`, inside an aria-hidden wrapper on line 3. */
export function inputTypedByInsideAriaHidden(typeAttribute: string): string {
  return `export function Honeypot({ kind }: { readonly kind: string }) {
  return (
    <div aria-hidden="true">
      <input name="website" ${typeAttribute} />
    </div>
  )
}
`
}

/** A button inside a wrapper whose aria-hidden is written as `ariaHiddenAttribute`, on line 3. */
export function buttonInsideWrapperWith(ariaHiddenAttribute: string): string {
  return `export function Toolbar({ hidden }: { readonly hidden: string }) {
  return (
    <div ${ariaHiddenAttribute}>
      <button type="button">Undo</button>
    </div>
  )
}
`
}

/** A div whose tabIndex is written as `tabIndexAttribute`, inside an aria-hidden wrapper on line 3. */
export function divWithTabIndexInsideAriaHidden(tabIndexAttribute: string): string {
  return `export function Carousel({ index }: { readonly index: number }) {
  return (
    <div aria-hidden="true">
      <div ${tabIndexAttribute}>Slide</div>
    </div>
  )
}
`
}

/** A button whose tabIndex is written as `tabIndexAttribute`, inside an aria-hidden wrapper on line 3. */
export function buttonWithTabIndexInsideAriaHidden(tabIndexAttribute: string): string {
  return `export function Pager() {
  return (
    <div aria-hidden="true">
      <button ${tabIndexAttribute} type="button">Next</button>
    </div>
  )
}
`
}
