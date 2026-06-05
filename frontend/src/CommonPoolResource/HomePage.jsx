import { Users, Coins, Bot } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import "./HomePage.css"

export default function CommonPoolResourceHomePage() {
  const navigate = useNavigate()
  const { room } = useParams()

  const handleStartGame = (mode) => {
    navigate(`/common-pool/matchmaking?room=${room}&mode=${mode}`)
  }

  const renderStage2Rules = () => {
    switch (room) {
      case "punishment":
        return (
          <>
            <li>
              After seeing all harvests, you may punish any of the other
              3 players (or punish no one).
            </li>
            <li>
              For each punishment: Punisher pays <strong>4 units</strong>, Target loses <strong>12 units</strong>.
            </li>
            <li>Then the round ends.</li>
          </>
        )

      case "reward":
        return (
          <>
            <li>
              After seeing all harvests, you may reward any of the other
              3 players (or reward no one).
            </li>
            <li>
              For each reward: Giver pays <strong>4 units</strong>, Target gains <strong>12 units</strong>.
            </li>
            <li>Then the round ends.</li>
          </>
        )

      case "mixed":
        return (
          <>
            <li>
              After seeing all harvests, for each of the other 3 players,
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
    <div className="cpr-homepage">
      <div className="cpr-homepage-container">

        <div className="cpr-homepage-header">
          <h1 className="cpr-homepage-title">Common-pool Resource Game</h1>
          <p className="cpr-homepage-subtitle">
            Room type:{" "}
            <strong>{room.replace("_", " ").toUpperCase()}</strong>
          </p>
        </div>

        <div className="cpr-how-to-play-card">
          <div className="cpr-how-to-play-header">
            <Coins className="cpr-how-to-play-icon" />
            <h2 className="cpr-how-to-play-title">How to Play</h2>
          </div>

          <div className="cpr-how-to-play-steps">
            <div className="cpr-step">
              <div className="cpr-step-number"><span>1</span></div>
              <h3 className="cpr-step-title">Monitor the Pool</h3>
              <p className="cpr-step-description">
                The common pool starts with 100 fish. Monitor the stock each round.
              </p>
            </div>

            <div className="cpr-step">
              <div className="cpr-step-number"><span>2</span></div>
              <h3 className="cpr-step-title">Harvest Sustainably</h3>
              <p className="cpr-step-description">
                Request 0–10 fish. Over-harvesting might deplete the pool for everyone.
              </p>
            </div>

            <div className="cpr-step">
              <div className="cpr-step-number"><span>3</span></div>
              <h3 className="cpr-step-title">Regeneration & Bonus</h3>
              <p className="cpr-step-description">
                Remaining fish reproduce. A healthy final stock grants a 0.4x bonus.
              </p>
            </div>
          </div>

          <div className="cpr-how-to-play-instructions">
            <div className="cpr-instruction-section">

              <div className="cpr-instruction-details">
                <h4>Stage 1 — Harvesting</h4>
                <ul>
                  <li>The pool starts with <strong>100 fish</strong> (Maximum 100).</li>
                  <li>In each round, each player chooses to extract <strong>0 to 10 fish</strong>.</li>
                  <li>
                    <strong>Harvest Rule:</strong> If total requests ≤ stock, everyone gets their request. 
                    If total requests &gt; stock, fish are allocated <strong>proportionally</strong> to requests.
                  </li>
                  <li><strong>Decision Time:</strong> You have 30 seconds to make your choice.</li>
                  <li>
                    <strong>Regeneration Rule:</strong> After harvest, the pool regenerates:
                    <br/>
                    <code>New Fish = round(0.8 × fish_left × (1 - fish_left / 100))</code>
                  </li>
                </ul>
              </div>

              <div className="cpr-instruction-details">
                <h4>Payoffs & Bonus</h4>
                <ul>
                  <li><strong>Round Points:</strong> 1 point per fish actually caught.</li>
                  <li><strong>Final Bonus:</strong> At the end of the match, you receive <strong>0.4 × final fish stock</strong>.</li>
                  <li>
                    <strong>Total Payoff:</strong> Sum of all fish caught + Final bonus.
                  </li>
                  <li><strong>Sustainability:</strong> If the pool is depleted, no more fish can be caught!</li>
                </ul>
              </div>

              {room !== "basic" && (
                <div className="cpr-instruction-details">
                  <h4>Stage 2 — Room Rules</h4>
                  <ul>{renderStage2Rules()}</ul>
                </div>
              )}

              <div className="cpr-instruction-details">
                <h4>Information</h4>
                <ul>{renderInformationRules()}</ul>
              </div>

            </div>
          </div>
        </div>

        <div className="cpr-game-modes">
          <div className="cpr-game-mode-card">
            <div className="cpr-game-mode-icon-container">
              <Users className="cpr-game-mode-icon" />
            </div>
            <h3 className="cpr-game-mode-title">Play Online</h3>
            <p className="cpr-game-mode-description">
              Join real players in this room
            </p>
            <button
              onClick={() => handleStartGame("online")}
              className="cpr-game-mode-button cpr-online-button"
            >
              Find Group
            </button>
          </div>

          <div className="cpr-game-mode-card">
            <div className="cpr-game-mode-icon-container">
              <Bot className="cpr-game-mode-icon" />
            </div>
            <h3 className="cpr-game-mode-title">Play with Bot</h3>
            <p className="cpr-game-mode-description">
              Practice in this room setup
            </p>
            <button
              onClick={() => handleStartGame("bot")}
              className="cpr-game-mode-button cpr-bot-button"
            >
              Start Game
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}