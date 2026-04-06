import './SocialWorkerHomePage.css'

const placeholderCases = [
  { id: 1042, status: 'Active', updated: '2 days ago' },
  { id: 1038, status: 'Active', updated: '5 days ago' },
  { id: 1021, status: 'Review', updated: '1 week ago' },
]

function SocialWorkerHomePage() {
  return (
    <div className="sw-home">
      <div className="sw-home-header">
        <h1>My Cases</h1>
      </div>

      <div className="sw-home-cases">
        {placeholderCases.map((c) => (
          <div key={c.id} className="case-card">
            <div className="case-card-top">
              <span className="case-card-id">Case #{c.id}</span>
              <span className={`case-card-status case-card-status--${c.status.toLowerCase()}`}>
                {c.status}
              </span>
            </div>
            <p className="case-card-updated">Last updated {c.updated}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SocialWorkerHomePage
