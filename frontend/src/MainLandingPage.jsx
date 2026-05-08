import React from "react"
import { Link } from "react-router-dom"
import { Gamepad2, Settings, ArrowRight } from "lucide-react"
import "./MainLandingPage.css"

function MainLandingPage() {
  return (
    <div className="main-landing">
      <div className="landing-container">
        <header className="landing-header">
          <h1 className="landing-title">Game Theory Platform</h1>
          <p className="landing-subtitle">
            Choose your environment and start experimenting with strategic interactions
          </p>
        </header>

        <div className="landing-options">
          <div className="landing-card standard-card">
            <div className="card-content">
              <div className="card-icon-wrapper">
                <Gamepad2 className="card-icon" size={48} />
              </div>
              <h2 className="card-title">Standard Games</h2>
              <p className="card-description">
                Participate in pre-defined economic experiments like Prisoner's Dilemma, Ultimatum Game, and Public Goods.
              </p>
              <ul className="card-features">
                <li>Fixed parameters and payoffs</li>
                <li>Standard research protocols</li>
                <li>Instant matchmaking</li>
              </ul>
              <div className="card-actions">
                <Link to="/standard" className="landing-button">
                  Enter Standard Lobby
                  <ArrowRight className="button-icon" />
                </Link>
              </div>
            </div>
          </div>

          <div className="landing-card customized-card">
            <div className="card-content">
              <div className="card-icon-wrapper">
                <Settings className="card-icon" size={48} />
              </div>
              <h2 className="card-title">Customized Games</h2>
              <p className="card-description">
                Create or join custom rooms with personalized parameters, payoffs, and game conditions.
              </p>
              <ul className="card-features">
                <li>Custom payoff matrices</li>
                <li>Adjustable round numbers</li>
                <li>Private room links</li>
              </ul>
              <div className="card-actions">
                <Link to="/auth" className="landing-button creator-btn">
                  Create Custom Room
                  <ArrowRight className="button-icon" />
                </Link>
                <Link to="/join-custom" className="landing-button join-btn">
                  Join Custom Room
                  <ArrowRight className="button-icon" size={16} />
                </Link>
              </div>
            </div>
          </div>
        </div>

        <footer className="landing-footer site-footer">
          <p>© 2026 José Segovia-Martin. All rights reserved.</p>
          <a
            href="https://jsegoviamartin.github.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            jsegoviamartin.github.io
          </a>
        </footer>
      </div>
    </div>
  )
}

export default MainLandingPage
