export const roleDialogWithoutName = `export const ConfirmDialog = ({ children }) => (
  <div role="dialog" tabIndex="-1">
    {children}
  </div>
)`

export const roleDialogNamedByAriaLabel = `export const SettingsDialog = ({ children }) => (
  <div aria-label="Settings" role="dialog" tabIndex="-1">
    {children}
  </div>
)
`

export const roleDialogNamedByAriaLabelledby = `export const ConfirmDialog = ({ children }) => (
  <div aria-labelledby="confirm-title" role="dialog">
    <h2 id="confirm-title">Delete this file?</h2>
    {children}
  </div>
)
`

export const roleDialogWithSpreadProps = `export const Wrapper = ({ children, ...rest }) => (
  <div role="dialog" {...rest}>
    {children}
  </div>
)
`

export const intrinsicDialogWithDynamicLabelledby = `export const Modal = ({ titleId, children }) => (
  <dialog aria-labelledby={titleId} aria-modal="true">
    {children}
  </dialog>
)
`

export const menuRole = `export const Menu = () => (
  <ul role="menu">
    <li role="menuitem">Rename</li>
  </ul>
)
`

export const dynamicRole = `export const Region = ({ role, label }) => <div aria-label={label} role={role} />
`

export const alertdialogNamedByTitle = `type AlertProps = { readonly message: string }

export const LeaveConfirmation = ({ message }: AlertProps) => (
  <div role="alertdialog" title="Unsaved changes">
    {message}
  </div>
)
`

export const intrinsicDialogWithPresentationRole = `export const Sheet = ({ titleId, children }) => (
  <dialog className="sheet" role="presentation">
    <div aria-labelledby={titleId} role="dialog">
      {children}
    </div>
  </dialog>
)
`

export const alertdialogNamedByTranslatedLabel = `export const RemoveAccountDialog = ({ t, children }) => (
  <div aria-label={t('account.remove.title')} role="alertdialog">
    {children}
  </div>
)
`

export const roleDialogNamedByTemplateLabelledby = `export const FieldDialog = ({ id, children }) => (
  <div aria-labelledby={\`\${id}-title\`} role="dialog">
    <h2 id={\`\${id}-title\`}>Edit field</h2>
    {children}
  </div>
)
`
