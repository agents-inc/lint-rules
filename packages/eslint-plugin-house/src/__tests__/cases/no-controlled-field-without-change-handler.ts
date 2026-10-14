export const valueWithoutHandler = `export function SearchBox({ query }: { query: string }) {
  return <input value={query} placeholder="Search" />
}`

export const readOnlyField = `export function InvoiceId({ id }: { readonly id: string }) {
  return <input aria-label="Invoice id" readOnly value={id} />
}
`

export const fieldWithSpreadProps = `import { useController } from 'react-hook-form'

export function NameField({ control }: { readonly control: unknown }) {
  const { field } = useController({ name: 'name', control } as never)
  return <input value={field.value} {...field} />
}
`

export const defaultValueField = `export function UncontrolledName({ initialName }: { readonly initialName: string }) {
  return <input defaultValue={initialName} name="name" />
}
`

export const fieldsWithOnChange = `import { useState } from 'react'

export function Editor() {
  const [text, setText] = useState('')
  const [size, setSize] = useState('m')
  return (
    <form>
      <input onChange={e => setText(e.target.value)} value={text} />
      <textarea onChange={e => setText(e.target.value)} value={text} />
      <select onChange={e => setSize(e.target.value)} value={size}>
        <option value="s">Small</option>
      </select>
    </form>
  )
}
`

export const hiddenResetAndSubmitInputs = `export function SubmitRow({ token }: { readonly token: string }) {
  return (
    <form action="/save" method="post">
      <input name="csrf" type="hidden" value={token} />
      <input type="reset" value="Clear" />
      <input type="submit" value="Save changes" />
    </form>
  )
}
`

export const disabledFieldAndOnInputHandler = `import { useState } from 'react'

export function Filters({ locked }: { readonly locked: boolean }) {
  const [term, setTerm] = useState('')
  return (
    <>
      <input disabled={locked} value={term} />
      <textarea onInput={e => setTerm(e.currentTarget.value)} value={term} />
    </>
  )
}
`

export const componentFieldUndefinedValueAndNoValue = `import { Input } from './ui/Input'

export function Row({ value }: { readonly value: string }) {
  return (
    <>
      <Input value={value} />
      <input ref={node => node?.focus()} value={undefined} />
      <input placeholder="type here" />
    </>
  )
}
`

export const radioAndCheckboxValues = `export function PlanPicker({ plan }: { readonly plan: string }) {
  return (
    <form action="/subscribe" method="post">
      <label><input defaultChecked={plan === 'free'} name="plan" type="radio" value="free" /> Free</label>
      <label><input name="plan" type="radio" value="pro" /> Pro</label>
      <label><input name="terms" type="checkbox" value="accepted" /> I agree</label>
    </form>
  )
}
`

export const formLevelOnChange = `import { useState } from 'react'

export function OneHandlerForm() {
  const [draft, setDraft] = useState({ title: '', body: '' })
  const update = (e: React.ChangeEvent<HTMLFormElement>) =>
    setDraft(d => ({ ...d, [e.target.name]: e.target.value }))
  return (
    <form onChange={update}>
      <input name="title" value={draft.title} />
      <label>
        <textarea name="body" value={draft.body} />
      </label>
    </form>
  )
}
`

export const formLevelOnChangeAroundMappedFields = `import { useState } from 'react'

export function RowEditor({ rows }: { readonly rows: Array<{ id: string; v: string }> }) {
  const [draft, setDraft] = useState(rows)
  const save = (e: React.ChangeEvent<HTMLFormElement>) =>
    setDraft(d => d.map(r => (r.id === e.target.name ? { ...r, v: e.target.value } : r)))
  return (
    <form onChange={save}>
      {draft.map(r => (
        <input key={r.id} name={r.id} value={r.v} />
      ))}
    </form>
  )
}
`
