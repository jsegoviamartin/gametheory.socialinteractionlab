import { Link } from "react-router-dom"
import { ArrowRight, Users, Coins, Zap, Shield, ArrowLeft } from "lucide-react"
import "./StandardGamesPage.css"

function StandardGamesPage() {
  return (
    <div className="home-page">
      <div className="home-container">
        <div className="back-link-container">
          <Link to="/" className="back-portal-link">
            <ArrowLeft size={16} /> Back to Portal
          </Link>
        </div>
        <div className="hero-section">
          <h1 className="hero-title">Game Theory Experiments</h1>
          <p className="hero-subtitle">
            Explore strategic decision-making through interactive economic games
          </p>
        </div>

        <div className="games-grid">
          <div className="game-carddd prisoners">
            <div className="game-carddd-content">
              <div className="game-icon-container">
                <Shield className="game-icon" />
                <Zap className="game-icon secondary" />
              </div>
              <h2 className="game-title">2x2 Economic Games</h2>
              <p className="game-description">
                A classic game theory scenario where two players must decide whether to cooperate or defect.
                Will you trust your opponent or prioritize self-interest?
              </p>
              <ul className="game-features">
                <li>
                  <Users className="feature-icon" />
                  <span>Play online with others or against AI</span>
                </li>
                <li>
                  <Coins className="feature-icon" />
                  <span>Earn points based on strategic choices</span>
                </li>
                <li>
                  <Zap className="feature-icon" />
                  <span>25 rounds of strategic decision-making</span>
                </li>
              </ul>
              <Link to="/prisoners" className="game-button">
                Play 2x2 Economic Games
                <ArrowRight className="button-icon" />
              </Link>
            </div>
          </div>

          <div className="game-carddd ultimatum">
            <div className="game-carddd-content">
              <div className="game-icon-container">
                <Coins className="game-icon" />
              </div>
              <h2 className="game-title">Ultimatum Game</h2>
              <p className="game-description">
                One player proposes how to divide a sum of money, and the other can accept or reject.
                If rejected, both get nothing. What's a fair offer?
              </p>
              <ul className="game-features">
                <li>
                  <Users className="feature-icon" />
                  <span>Take turns as proposer and responder</span>
                </li>
                <li>
                  <Coins className="feature-icon" />
                  <span>Test theories of fairness and negotiation</span>
                </li>
                <li>
                  <Zap className="feature-icon" />
                  <span>Multiple rounds with different opponents</span>
                </li>
              </ul>
              <Link to="/ultimatum" className="game-button ultimatum-button">
                Play Ultimatum Game
                <ArrowRight className="button-icon" />
              </Link>
            </div>
          </div>
        
                  <div className="game-carddd public-goods">
            <div className="game-carddd-content">
              <div className="game-icon-container">
                <Users className="game-icon" />
                <Coins className="game-icon secondary" />
              </div>

              <h2 className="game-title">Public Goods Game</h2>

              <p className="game-description">
                Players decide how much to contribute to a shared pool that benefits everyone.
                Will you cooperate for the common good or free-ride on others’ contributions?
              </p>

              <ul className="game-features">
                <li>
                  <Users className="feature-icon" />
                  <span>Multiplayer cooperation experiment</span>
                </li>
                <li>
                  <Coins className="feature-icon" />
                  <span>Study incentives and collective action</span>
                </li>
                <li>
                  <Zap className="feature-icon" />
                  <span>Repeated rounds with group feedback</span>
                </li>
              </ul>

              <Link to="/public-goods" className="game-button">
                Play Public Goods Game
                <ArrowRight className="button-icon" />
              </Link>
            </div>
          </div>

          <div className="game-carddd common-pool">
            <div className="game-carddd-content">
              <div className="game-icon-container">
                <Users className="game-icon" />
                <Coins className="game-icon secondary" />
              </div>

              <h2 className="game-title">Common-pool Resource Game</h2>

              <p className="game-description">
                Players share a common resource and must decide how much to extract.
                Over-extraction can lead to depletion. Can you manage the resource sustainably?
              </p>

              <ul className="game-features">
                <li>
                  <Users className="feature-icon" />
                  <span>Resource management experiment</span>
                </li>
                <li>
                  <Coins className="feature-icon" />
                  <span>Study collective action and sustainability</span>
                </li>
                <li>
                  <Zap className="feature-icon" />
                  <span>Dynamics of shared resource extraction</span>
                </li>
              </ul>

              <Link to="/common-pool" className="game-button">
                Play Common-pool Resource Game
                <ArrowRight className="button-icon" />
              </Link>
            </div>
          </div>

        </div>  

        <div className="about-section">
          <h2 className="section-title">About These Experiments</h2>
          <p className="section-text">
            These interactive games are based on classic economic experiments that reveal insights about
            human behavior, cooperation, fairness, and strategic thinking.
          </p>
          <p className="section-text">
            All games are played anonymously, and your decisions contribute to ongoing research
            in behavioral economics.
          </p>
        </div>

        
        <footer className="site-footer">
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

export default StandardGamesPage
