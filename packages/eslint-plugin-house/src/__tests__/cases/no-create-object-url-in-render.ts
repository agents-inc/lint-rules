export const createObjectUrlInJsxAttribute = `export function AvatarPreview({ file }: { file: File }) {
  return <img src={URL.createObjectURL(file)} alt={file.name} />
}`

export const createdInNamedEffect = `import { useEffect, useState } from 'react'

export function VideoPreview({ blob }: { readonly blob: Blob }) {
  const [src, setSrc] = useState('')
  useEffect(function createPreviewUrl() {
    const url = URL.createObjectURL(blob)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [blob])
  return <video src={src} />
}
`

export const createdInUseMemo = `import { useEffect, useMemo } from 'react'

export function ImagePreview({ blob }: { readonly blob: Blob }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return <img alt="" src={url} />
}
`

export const createdInEventHandler = `export function DownloadButton({ blob, name }: { readonly blob: Blob; readonly name: string }) {
  const handleDownload = () => {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    anchor.click()
    URL.revokeObjectURL(url)
  }
  return <button onClick={handleDownload} type="button">Save</button>
}
`

export const createdAtModuleScope = `import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?raw'
import { pdfjs } from 'react-pdf'

const blob = new Blob([workerUrl], { type: 'application/javascript' })
pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob)

export function Viewer() {
  return <div />
}
`

export const createdInPlainHelper = `export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
`

export const createdInAsyncArrowHelper = `export const createAttachment = async (file: File) => ({
  name: file.name,
  url: URL.createObjectURL(file),
})
`

export const createdInLazyStateInitialiser = `import { useEffect, useState } from 'react'

export function PdfViewer({ blob }: { readonly blob: Blob }) {
  const [fileUrl] = useState(() => URL.createObjectURL(blob))
  useEffect(() => () => URL.revokeObjectURL(fileUrl), [fileUrl])
  return <iframe src={fileUrl} title="pdf" />
}
`

export const createdInHandlerAndInlineEventProp = `export function ExportAll({ blobs }: { readonly blobs: Blob[] }) {
  const exportEverything = () => {
    const urls = blobs.map((b) => URL.createObjectURL(b))
    urls.forEach((u) => URL.revokeObjectURL(u))
  }
  return <button onClick={() => blobs.map((b) => URL.createObjectURL(b))} type="button">Export</button>
}
`

export const createdInAsyncWorkInsideEffect = `import { useEffect, useState } from 'react'

export function Thumb({ id }: { readonly id: string }) {
  const [src, setSrc] = useState('')
  useEffect(function loadThumbnail() {
    let objectUrl = ''
    void (async () => {
      const blob = await fetch(\`/t/\${id}\`).then((r) => r.blob())
      objectUrl = URL.createObjectURL(blob)
      setSrc(objectUrl)
    })()
    return () => URL.revokeObjectURL(objectUrl)
  }, [id])
  return <img alt="" src={src} />
}
`

export const mockedInTestFile = `import { vi } from 'vitest'

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
})

it('creates one url', () => {
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
})
`

export const createdInFunctionDeclarationHandler = `import { useState } from 'react'

export function AttachmentRow({ blob, name }: { readonly blob: Blob; readonly name: string }) {
  const [busy, setBusy] = useState(false)

  function openInNewTab() {
    setBusy(true)
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    URL.revokeObjectURL(url)
    setBusy(false)
  }

  return <button disabled={busy} onClick={openInNewTab} type="button">{name}</button>
}
`

export const createdInCallbackFromHandler = `import { toast } from 'sonner'

export function ShareButton({ blob }: { readonly blob: Blob }) {
  const showPreviewToast = () => {
    toast.custom(() => <img alt="preview" src={URL.createObjectURL(blob)} />)
  }
  return <button onClick={showPreviewToast} type="button">Share</button>
}
`

export const createdInAsyncHelperInsideComponent = `import { useEffect, useState } from 'react'

export function ReportCard({ id }: { readonly id: string }) {
  const [href, setHref] = useState('')

  const fetchReportUrl = async () => {
    const blob = await fetch(\`/reports/\${id}\`).then((r) => r.blob())
    return URL.createObjectURL(blob)
  }

  useEffect(function loadReport() {
    let current = ''
    fetchReportUrl().then((url) => {
      current = url
      setHref(url)
    })
    return () => URL.revokeObjectURL(current)
  }, [id])

  return <a href={href}>Download</a>
}
`

export const createdInExternalStore = `import { useSyncExternalStore } from 'react'

const store = {
  urls: new Map<string, string>(),
  urlFor(blob: Blob, key: string) {
    if (!this.urls.has(key)) this.urls.set(key, URL.createObjectURL(blob))
    return this.urls.get(key) as string
  },
  subscribe: (cb: () => void) => () => cb(),
}

export function CachedImage({ blob, cacheKey }: { readonly blob: Blob; readonly cacheKey: string }) {
  const url = useSyncExternalStore(store.subscribe, () => store.urlFor(blob, cacheKey))
  return <img alt="" src={url} />
}
`
