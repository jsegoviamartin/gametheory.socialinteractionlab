import { Users, Coins, Bot } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import "./HomePage.css"

export default function PublicGoodsHomePage() {
  const navigate = useNavigate()
  const { room } = useParams()

  const handleStartGame = (mode) => {
    navigate(`/public-goods/matchmaking?room=${room}&mode=${mode}`)
  }

  const renderStage2Rules = () => {
    switch (room) {
      case "punishment":
        return (
          <>
            <li>
              After seeing all contributions, you may punish any of the other
              3 players (or punish no one).
            </li>
            <li>
              For each punishment: Punisher pays 4 units, Target loses 12 units.
            </li>
            <li>Then the round ends.</li>
          </>
        )

      case "reward":
        return (
          <>
            <li>
              After seeing all contributions, you may reward any of the other
              3 players (or reward no one).
            </li>
            <li>
              For each reward: Giver pays 4 units, Target gains 12 units.
            </li>
            <li>Then the round ends.</li>
          </>
        )

      case "mixed":
        return (
          <>
            <li>
              After seeing all contributions, for each of the other 3 players,
              choose exactly one action:
            </li>
            <ul>
              <li>Reward: pay 4 units, target gains 12 units</li>
              <li>Punish: pay 4 units, target loses 12 units</li>
              <li>Do nothing</li>
            </ul>
            <li>Then the round ends.</li>
          </>
        )

      default:
        return null
    }
  }

  const renderInformationRules = () => {
    if (room === "basic") {
      return (
        <>
          <li>After Stage 1 payoff is computed, the round ends immediately.</li>
          <li>Move to the next round.</li>
        </>
      )
    }

    return (
      <>
        <li>
          You will learn if someone rewarded or punished <strong>you</strong>.
        </li>
        <li>You will not see actions taken toward other players.</li>
      </>
    )
  }

  return (
    <div className="homepage">
      <div className="homepage-container">

        <div className="homepage-header">
          <h1 className="homepage-title">Public Goods Game</h1>
          <p className="homepage-subtitle">
            Room type:{" "}
            <strong>{room.replace("_", " ").toUpperCase()}</strong>
          </p>
        </div>

        <div className="how-to-play-card">
          <div className="how-to-play-header">
            <Coins className="how-to-play-icon" />
            <h2 className="how-to-play-title">How to Play</h2>
          </div>

          <div className="how-to-play-steps">
            <div className="step">
              <div className="step-number"><span>1</span></div>
              <h3 className="step-title">Receive Your Endowment</h3>
              <p className="step-description">
                At the start of each round, you receive 20 units.
              </p>
            </div>

            <div className="step">
              <div className="step-number"><span>2</span></div>
              <h3 className="step-title">Choose Your Contribution</h3>
              <p className="step-description">
                Decide how much (0–20) to contribute to the public pool.
              </p>
            </div>

            <div className="step">
              <div className="step-number"><span>3</span></div>
              <h3 className="step-title">See the Outcome</h3>
              <p className="step-description">
                The total contribution is increased and shared equally among all players.
              </p>
            </div>
          </div>

          <div className="how-to-play-instructions">
            <div className="instruction-section">

              <div className="instruction-details">
                <h4>Stage 1 — Contribution</h4>
                <ul>
                  <li>Each player receives <strong>20 units</strong>.</li>
                  <li>
                    Each player chooses a contribution{" "}
                    <strong>c ∈ [0, 20]</strong>.
                  </li>
                  <li>The total pool is multiplied by <strong>1.6</strong>.</li>
                  <li>The result is split equally among all 4 players.</li>
                  <li>
                    Per player payoff after Stage 1:{" "}
                    <strong>
                      (20 − own contribution) + (1.6 × total contributions / 4)
                    </strong>
                  </li>
                </ul>
              </div>

              {room !== "basic" && (
                <div className="instruction-details">
                  <h4>Stage 2 — Room Rules</h4>
                  <ul>{renderStage2Rules()}</ul>
                </div>
              )}

              <div className="instruction-details">
                <h4>Information</h4>
                <ul>{renderInformationRules()}</ul>
              </div>

            </div>
          </div>
        </div>

        <div className="game-modes">
          <div className="game-mode-card">
            <div className="game-mode-icon-container">
              <Users className="game-mode-icon" />
            </div>
            <h3 className="game-mode-title">Play Online</h3>
            <p className="game-mode-description">
              Join real players in this room
            </p>
            <button
              onClick={() => handleStartGame("online")}
              className="game-mode-button online-button"
            >
              Find Group
            </button>
          </div>

          <div className="game-mode-card">
            <div className="game-mode-icon-container">
              <Bot className="game-mode-icon" />
            </div>
            <h3 className="game-mode-title">Play with Bot</h3>
            <p className="game-mode-description">
              Practice in this room setup
            </p>
            <button
              onClick={() => handleStartGame("bot")}
              className="game-mode-button bot-button"
            >
              Start Game
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}