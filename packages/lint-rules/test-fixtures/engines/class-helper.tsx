export function Badge({ active }: { readonly active: boolean }) {
  return <span className={`badge ${active ? 'badge-active' : ''}`}>new</span>
}
