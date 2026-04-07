import type { ActionItem } from '../../../types/ActionItem'

interface Props {
  items: ActionItem[]
  onItemClick?: (residentId: number) => void
}

const REASON_LABEL: Record<ActionItem['reason'], string> = {
  'overdue-visit': 'Overdue visit',
  'plan-review': 'Plan review',
  'high-risk': 'High risk',
}

function ActionItems({ items, onItemClick }: Props) {
  return (
    <section className="sw-dash-section">
      <header className="sw-dash-section-header">
        <h2>Action Items</h2>
        <span className="sw-dash-mock">{items.length} need attention</span>
      </header>
      {items.length === 0 ? (
        <p className="sw-dash-empty">All caught up — no action items.</p>
      ) : (
        <ul className="sw-dash-actions">
          {items.map((it, i) => (
            <li key={`${it.residentId}-${it.reason}-${i}`}>
              <button
                type="button"
                className={`action-row action-row--${it.severity}`}
                onClick={() => onItemClick?.(it.residentId)}
              >
                <span className={`action-tag action-tag--${it.reason}`}>
                  {REASON_LABEL[it.reason]}
                </span>
                <span className="action-resident">{it.residentCode}</span>
                <span className="action-detail">{it.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default ActionItems
