export const randomUuidKeyInMap = `export function TagList({ tags }: { tags: string[] }) {
  return (
    <ul>
      {tags.map(tag => (
        <li key={crypto.randomUUID()}>{tag}</li>
      ))}
    </ul>
  )
}`

export const keyedOnDataId = `type Item = { id: string; label: string }

export function ItemList({ items }: { readonly items: Item[] }) {
  return (
    <ul>
      {items.map(item => (
        <li key={item.id}>{item.label}</li>
      ))}
    </ul>
  )
}
`

export const keyedOnIndex = `export function Steps({ steps }: { readonly steps: string[] }) {
  return (
    <ol>
      {steps.map((step, index) => (
        <li key={index}>{step}</li>
      ))}
    </ol>
  )
}
`

export const mintedOutsideKey = `import { nanoid } from 'nanoid'

type Draft = { id: string; text: string }

export function DraftList({ drafts, onAdd }: { readonly drafts: Draft[]; readonly onAdd: (d: Draft) => void }) {
  const addDraft = () => onAdd({ id: crypto.randomUUID(), text: '' })
  return (
    <>
      <button data-trace={nanoid()} onClick={addDraft}>Add</button>
      <ul>
        {drafts.map(draft => (
          <li id={\`draft-\${nanoid()}\`} key={draft.id}>{draft.text}</li>
        ))}
      </ul>
    </>
  )
}
`

export const derivedKeys = `const slugify = (value: string) => value.toLowerCase().replaceAll(/\\s+/g, '-')

type Row = { name: string; sku: string; }

export function Catalogue({ rows }: { readonly rows: Row[] }) {
  return (
    <div>
      {rows.map((row, i) => (
        <article key={\`\${row.sku}-\${i}\`}>{row.name}</article>
      ))}
      {rows.map(row => (
        <span key={slugify(row.name)}>{row.name}</span>
      ))}
    </div>
  )
}
`

export const mintedOutsideListCallback = `import { nanoid } from 'nanoid'

export function Remount({ resetToken }: { readonly resetToken: string }) {
  const ids = [nanoid(), nanoid()]
  return (
    <section key={resetToken}>
      <form key={ids[0]} />
      {ids.map(id => (
        <input defaultValue={id} key={id} />
      ))}
    </section>
  )
}
`

export const mintedInsideUseMemo = `import { nanoid } from 'nanoid'
import { useMemo } from 'react'

export function Seats({ labels }: { readonly labels: string[] }) {
  const seats = useMemo(() => labels.map(label => ({ id: nanoid(), label })), [labels])
  return (
    <ul>
      {seats.map(seat => (
        <li key={seat.id}>{seat.label}</li>
      ))}
    </ul>
  )
}
`

export const mintedWhileBuildingList = `import { nanoid } from 'nanoid'

type Upload = { id: string; name: string }

export function Uploads({ uploads }: { readonly uploads: Upload[] }) {
  const withTrace = uploads.map(upload => ({ ...upload, traceId: nanoid() }))
  return (
    <ul>
      {withTrace.map(upload => (
        <li data-trace={upload.traceId} key={upload.id}>{upload.name}</li>
      ))}
    </ul>
  )
}
`

export const mintedOnceInRefAndLazyState = `import { useRef, useState } from 'react'
import { nanoid } from 'nanoid'

export function Fields({ count }: { readonly count: number }) {
  const listId = useRef(nanoid()).current
  const [ids] = useState(() => Array.from({ length: count }, () => crypto.randomUUID()))
  return (
    <fieldset id={listId}>
      {ids.map(id => (
        <input key={id} name={id} />
      ))}
    </fieldset>
  )
}
`

export const methodReadingExistingId = `type TreeNode = { label: string; uuid: () => string; }

export function Outline({ nodes }: { readonly nodes: TreeNode[] }) {
  return (
    <ul>
      {nodes.map(node => (
        <li key={node.uuid()}>{node.label}</li>
      ))}
    </ul>
  )
}
`

export const nameBasedUuid = `import { v5 as uuidv5 } from 'uuid'
import * as uuid from 'uuid'

const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

export function Permalinks({ paths }: { readonly paths: string[] }) {
  return (
    <ul>
      {paths.map(path => (
        <li key={uuidv5(path, NAMESPACE)}>{path}</li>
      ))}
      {paths.map(path => (
        <li key={uuid.v5(path, NAMESPACE)}>{path}</li>
      ))}
    </ul>
  )
}
`

export const mintedInsideHandler = `import { nanoid } from 'nanoid'

type Row = { id: string; label: string }

export function Tracked({ rows, track }: { readonly rows: Row[]; readonly track: (id: string) => void }) {
  return (
    <ul>
      {rows.map(row => (
        <li key={row.id} onClick={() => track(nanoid())}>{row.label}</li>
      ))}
    </ul>
  )
}
`

export const destructuredUuidField = `type Record = { name: string; uuid: string; }

export function Records({ records }: { readonly records: Record[] }) {
  return (
    <ul>
      {records.map(({ uuid, name }) => (
        <li key={uuid}>{name}</li>
      ))}
    </ul>
  )
}
`

export const customMinterKeyInMap = `import { makeId } from './make-id'
export function TagList({ tags }: { tags: string[] }) {
  return (
    <ul>
      {tags.map(tag => (
        <li key={makeId()}>{tag}</li>
      ))}
    </ul>
  )
}`

export const customMinter = 'makeId'

// A lone element has no siblings to reconcile against: a fresh key only remounts it, often on purpose.
export const loneElementKeyedByMinter = `import { nanoid } from 'nanoid'

export function FreshForm() {
  return <form key={nanoid()} />
}
`

// The helper decides when the minter runs: once per row, cached, not on every render.
export const minterHandedToCachingHelperInKey = `import { nanoid } from 'nanoid'

const ids = new WeakMap<object, string>()

function idFor(row: object, mint: () => string): string {
  const known = ids.get(row)
  if (known !== undefined) return known
  const id = mint()
  ids.set(row, id)
  return id
}

export function Rows({ rows }: { readonly rows: { label: string }[] }) {
  return (
    <ul>
      {rows.map(row => (
        <li key={idFor(row, () => nanoid())}>{row.label}</li>
      ))}
    </ul>
  )
}
`

// Plain JavaScript: ESLint's default parser reads no types.
export const customMinterKeyInMapModule = `import { makeId } from './make-id'
export function TagList({ tags }) {
  return (
    <ul>
      {tags.map(tag => (
        <li key={makeId()}>{tag}</li>
      ))}
    </ul>
  )
}
`
