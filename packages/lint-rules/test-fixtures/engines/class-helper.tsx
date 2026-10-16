export function Badge({ active }: { readonly active: boolean }) {
  return <span className={`badge ${active ? 'badge-active' : ''}`}>new</span>
}

export function Tag({ active }: { readonly active: boolean }) {
  return <span className={classNames('tag', active && 'tag-active')}>new</span>
}

export function Button({ active }: { readonly active: boolean }) {
  return <button className={buttonVariants({ active })}>go</button>
}

declare function classNames(...names: readonly (string | false)[]): string
declare function buttonVariants(variants: { readonly active: boolean }): string
