export const placeholderOnlyInput = `export function SearchBar() {
  return <input type="search" placeholder="Search projects" onChange={() => {}} />
}`

export const namedByAriaLabel = `export function SearchBar() {
  return <input aria-label="Search projects" placeholder="e.g. invoices" type="search" />
}
`

export const namedByIdAndLabelFor = `export function EmailField() {
  return (
    <>
      <label htmlFor="email">Work email</label>
      <input id="email" placeholder="name@work.com" type="email" />
    </>
  )
}
`

export const noPlaceholder = `export function Toggle({ checked, onChange }: { readonly checked: boolean; readonly onChange: () => void }) {
  return <input checked={checked} onChange={onChange} type="checkbox" />
}
`

export const spreadMayCarryName = `export function Notes(props: { readonly placeholder: string }) {
  return <textarea {...props} rows={4} />
}
`

export const wrappedInLabel = `export function Bio() {
  return (
    <label>
      Short bio
      <textarea placeholder="A sentence or two" rows={3} />
    </label>
  )
}
`

export const componentField = `import { Form,FormLabel,TextField } from './ui'
export function City() {
  return <TextField placeholder="Amsterdam" />
}
`

export const namedByLabelledbyTitleOrEmptyPlaceholder = `export function Filter({ labelId }: { readonly labelId: string }) {
  return (
    <>
      <select aria-labelledby={labelId} placeholder="All statuses">
        <option value="all">All</option>
      </select>
      <input placeholder="25" title="Rows per page" />
      <input placeholder="" type="text" />
    </>
  )
}
`

export const wrappedInFormLabelComponent = `import { Form,FormLabel,TextField } from './ui'
export function Nickname() {
  return (
    <FormLabel>
      Nickname
      <input placeholder="What your team calls you" />
    </FormLabel>
  )
}
`

export const wrappedInLabelWithCaption = `export function EmailField() {
  return (
    <label className="field">
      <span className="field__caption">Work email</span>
      <input placeholder="name@work.com" type="email" />
    </label>
  )
}
`

export const namedByTemplateIdAndLabelFor = `import { useId } from 'react'
export function CityField() {
  const id = useId()
  return (
    <div className="row">
      <label htmlFor={\`\${id}-city\`}>City</label>
      <input id={\`\${id}-city\`} placeholder="Amsterdam" />
    </div>
  )
}
`

export const restSpreadAfterPlaceholder = `export function Search({ ...rest }: React.ComponentProps<'input'>) {
  return <input placeholder="Search" type="search" {...rest} />
}
`

export const wrappedInNamespacedLabel = `import { Form,FormLabel,TextField } from './ui'
export function Team() {
  return (
    <Form.Label>
      Team name
      <input placeholder="Platform" />
    </Form.Label>
  )
}
`
