import './HomePage.css'

function HomePage() {
  return (
    <>
      <section className="home-hero">
        <h1>Compassionate Care, Secure Tools</h1>
        <p>A platform built with trauma-informed design for those who support survivors.</p>
      </section>

      <section className="home-roles">
        <div className="home-role-card">
          <h3>For Social Workers</h3>
          <p>
            Manage cases, track progress, document notes, and connect clients
            with resources — all in one secure place.
          </p>
        </div>
        <div className="home-role-card">
          <h3>For Administrators</h3>
          <p>
            Oversee operations, manage user access, generate reports, and
            ensure your team has what they need.
          </p>
        </div>
      </section>
    </>
  )
}

export default HomePage
