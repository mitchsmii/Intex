interface DeleteConfirmModalProps {
  open: boolean
  itemLabel?: string
  title?: string
  message?: string
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => void
}

export default function DeleteConfirmModal({
  open,
  itemLabel = 'this record',
  title = 'Confirm Delete',
  message,
  confirmLabel = 'Delete',
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) {
  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm deletion"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(16, 34, 39, 0.45)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 10000,
        padding: '1rem',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: 'min(100%, 28rem)',
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: '1.5rem',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        <p>{message ?? `Are you sure you want to delete ${itemLabel}?`}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              background: 'var(--color-error)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '0.65rem 1rem',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
