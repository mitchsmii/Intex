import { useParams } from 'react-router-dom'
import './ResidentDetailPage.css'

function ResidentDetailPage() {
  const { id } = useParams()

  return (
    <div className="resident-detail-page">
      <h1>Resident Detail</h1>
      <p className="resident-detail-placeholder">
        Viewing resident #{id} — detail view coming soon.
      </p>
    </div>
  )
}

export default ResidentDetailPage
