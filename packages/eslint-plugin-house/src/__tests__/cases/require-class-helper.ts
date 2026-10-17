export const DEFAULT_CLASS_HELPERS = ['cn', 'clsx', 'cx', 'cva', 'twMerge', 'classNames', 'classnames']

/** A className passed through a call to `helper`, on line 2. */
export function classNameFromCallTo(helper: string): string {
  return `export function Badge({ className }: { readonly className?: string }) {
  return <span className={${helper}('badge', className)}>new</span>
}
`
}

export const stringLiteralClasses = `export function Card() {
  return (
    <section className="card">
      <h2 className={'card-title'}>Title</h2>
    </section>
  )
}
`

export const staticTemplateClass = `export function Card() {
  return <p className={\`card-body text-sm\`}>Body</p>
}
`

export const lookedUpClasses = `import styles from './card.module.css'

const SIZES = { small: 'text-sm', large: 'text-lg' }

export function Card({ className, size }: { readonly className: string; readonly size: 'small' | 'large' }) {
  return (
    <section className={className}>
      <h2 className={styles.title}>Title</h2>
      <p className={SIZES[size]}>Body</p>
      <footer className={styles?.footer}>Footer</footer>
    </section>
  )
}
`

export const templateWrappingOneOptionalProp = `export function Card({ className }: { readonly className?: string }) {
  return <h2 className={\`\${className}\`}>Title</h2>
}
`

export const composingInsideHelperArguments = `export function Avatar({ size, className }: { readonly size: number; readonly className?: string }) {
  return <img alt="" className={cn(\`avatar avatar-\${size}\`, size > 40 ? 'avatar-large' : 'avatar-small', className)} />
}
`

export const composingOutsideClassAttributes = `const buttonVariants = cva(\`button \${'button-base'}\`)

export function Field({ id, invalid, size }: { readonly id: string; readonly invalid: boolean; readonly size: string }) {
  const hintIds = \`\${id}-hint \${id}-error\`
  return (
    <input
      aria-describedby={hintIds}
      data-state={invalid ? 'invalid' : 'valid'}
      title={'Field ' + id}
      inputClassName={\`field field-\${size}\`}
    />
  )
}
`

export const templateComposingClasses = `export function Panel({ open, className }: { readonly open: boolean; readonly className?: string }) {
  return <div className={\`panel \${open ? 'panel-open' : ''} \${className ?? ''}\`}>content</div>
}
`

export const templateJoiningLookups = `import styles from './select.module.css'

export function SelectLabel({ className }: { readonly className?: string }) {
  return <span className={\`\${styles.selectLabel} \${className}\`}>Label</span>
}
`

export const templateWrappingOneTernary = `export function Reaction({ isFlag }: { readonly isFlag: boolean }) {
  return <span className={\`\${isFlag ? 'icon' : ''}\`}>!</span>
}
`

export const concatenatedClasses = `export function NavTree({ className }: { readonly className?: string }) {
  return <ul className={'nav-tree ' + className}>items</ul>
}
`

export const ternaryChoosingOneClass = `import styles from './form.module.css'

export function FormLayout({ partialPage }: { readonly partialPage: boolean }) {
  return <div className={partialPage ? styles.itemAddDialog : styles.itemAdd}>form</div>
}
`

export const ternaryAddingAClass = `export function Spinner({ busy }: { readonly busy: boolean }) {
  return <i className={busy ? 'animate-spin' : undefined} />
}
`

export const logicalClasses = `export function Tab({ active, className }: { readonly active: boolean; readonly className?: string }) {
  return (
    <div className={className ?? 'tab'}>
      <span className={active && 'tab-active'}>Tab</span>
      <span className={className || undefined}>Label</span>
    </div>
  )
}
`

export const callToAnotherHelper = `export function Badge({ active }: { readonly active: boolean }) {
  return <span className={joinClasses('badge', { 'badge-active': active })}>new</span>
}
`

export const joinedArrayOfClasses = `export function Badge({ size }: { readonly size: string }) {
  return <span className={['badge', \`badge-\${size}\`].join(' ')}>new</span>
}
`

export const classAttribute = `export function Card({ size }: { readonly size: string }) {
  return (
    <section class="card">
      <p class={\`card-body card-\${size}\`}>Body</p>
    </section>
  )
}
`

export const variantsCallWithOptions = `export function Button({ variant, className }: { readonly variant: 'primary' | 'ghost'; readonly className?: string }) {
  return <button className={buttonVariants({ variant, className })}>Save</button>
}
`

export const variantsCallWithNoArguments = `export function MenuItem() {
  return <div className={dropdownMenuItemVariants()}>Rename</div>
}
`

export const variantsCallThroughAnObject = `import * as ui from './variants'

export function Button() {
  return <button className={ui.buttonVariants()}>Save</button>
}
`

export const optionalVariantsCall = `export function Button() {
  return <button className={buttonVariants?.()}>Save</button>
}
`

export const variantsCallWithATernaryArgument = `export function Button({ large }: { readonly large: boolean }) {
  return <button className={buttonVariants({ size: large ? 'lg' : 'sm' })}>Save</button>
}
`

export const callToVariantsItself = `export function Button() {
  return <button className={Variants()}>Save</button>
}
`

export const callToASingularVariant = `export function Button() {
  return <button className={buttonVariant()}>Save</button>
}
`

export const callToLowercaseVariants = `export function Button() {
  return <button className={buttonvariants()}>Save</button>
}
`

export const callToLowercaseVariantsAlone = `export function Button() {
  return <button className={variants()}>Save</button>
}
`

export const callWithVariantsMidName = `export function Button() {
  return <button className={buttonVariantsFor()}>Save</button>
}
`

export const callToAClassNameGetter = `export function Button() {
  return <button className={getButtonClassName()}>Save</button>
}
`

export const templateWrappingAVariantsCall = `export function Button() {
  return <button className={\`\${buttonVariants()} extra\`}>Save</button>
}
`

/** A call to cn on line 3, and a call to a `*Variants` function on line 4. */
export const variantsCallBesideACnCall = `export function Toolbar({ className }: { readonly className?: string }) {
  return (
    <div className={cn('toolbar', className)}>
      <button className={buttonVariants({ variant: 'ghost' })}>Undo</button>
    </div>
  )
}
`
