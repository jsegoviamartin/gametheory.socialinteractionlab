import React from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Construction } from "lucide-react"
import "./MainLandingPage.css"

function CustomizedGamesLanding() {
  return (
    <div className="main-landing">
      <div className="landing-container" style={{ textAlign: "center" }}>
        <div className="back-link-container" style={{ textAlign: "left" }}>
          <Link to="/" className="back-portal-link">
            <ArrowLeft size={16} /> Back to Portal
          </Link>
        </div>
        
        <div className="hero-section" style={{ marginTop: "4rem" }}>
          <Construction size={80} color="#f472b6" style={{ marginBottom: "2rem" }} />
          <h1 className="landing-title">Customized Games</h1>
          <p className="landing-subtitle">
            This system is currently under development. Soon you'll be able to create your own game rooms with custom parameters.
          </p>
          <div style={{ marginTop: "3rem" }}>
            <Link to="/" className="landing-button" style={{ display: "inline-flex", width: "auto" }}>
              Return to Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CustomizedGamesLanding
