import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Users, Bot, Coins, Trophy, Target, Music, Mic2, Lock } from "lucide-react"
import PayoffMatrix from "./PayoffMatrix"
import { getPlayerFingerprint } from "../services/gameApi"
import "./GameRules.css"

// Add this dynamic API URL configuration
const PORT = 8001
const API_BASE_URL =
  window.location.hostname === "localhost"
    ? `http://localhost:${PORT}/api/prisoners`
    : `${window.location.protocol}//${window.location.host}/api/prisoners`

const roomInfo = {
  "prisoners-dilemma": {
    title: "Prisoner's Dilemma",
    subtitle: "Engage in strategic decision-making with another player. Will you cooperate or defect? Your choices shape the outcome.",
    icon: <Lock className="how-to-play-icon" />,
    step1: "Choose Your Action",
    step1Desc: "Each round, decide whether to Cooperate or Defect within 15 seconds",
  },
  "bach-stravinsky-1": {
    title: "Battle of the Sexes (1)",
    subtitle: "Both players prefer to coordinate their choices (Prize Fight or Ballet), but have different preferences for which is better.",
    icon: <Music className="how-to-play-icon" />,
    step1: "Coordinate Choices",
    step1Desc: "Try to choose the same option as your partner (Prize Fight or Ballet) to maximize points.",
  },
  "bach-stravinsky-2": {
    title: "Battle of the Sexes (2)",
    subtitle: "A variation of the coordination game with a safety option when coordinate fails.",
    icon: <Mic2 className="how-to-play-icon" />,
    step1: "Coordinate Choices",
    step1Desc: "Try to agree on Prize Fight or Ballet to maximize total points.",
  },
  "stag-hunt": {
    title: "Stag and Hunt",
    subtitle: "A game that describes a conflict between safety and social cooperation. Will you trust your partner?",
    icon: <Target className="how-to-play-icon" />,
    step1: "Choose Your Hunt",
    step1Desc: "Decide whether to hunt the big Stag (cooperate) or the safe Hare (defect).",
  },
}

function GameRules({ setMatchId, setPlayerFingerprint }) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { room = "prisoners-dilemma" } = useParams()

  const currentRoom = roomInfo[room] || roomInfo["prisoners-dilemma"]

  useEffect(() => {
    const uuid = getPlayerFingerprint()
    setPlayerFingerprint(uuid)
    console.log("Your player UUID:", uuid)
  }, [setPlayerFingerprint])

  const handleStartGame = async (gameMode) => {
    setIsLoading(true)
    try {
      const playerFingerprint = getPlayerFingerprint()
      console.log("Starting game with fingerprint:", playerFingerprint)

      const response = await fetch(`${API_BASE_URL}/create_match/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          game_mode: gameMode,
          player_fingerprint: playerFingerprint,
          game_type: room, // Pass room type to backend
        }),
      })

      const data = await response.json()
      console.log("Server response:", data)

      if (data.status === "error") {
        window.dispatchEvent(
          new CustomEvent("GLOBAL_MODAL", {
            detail: { title: "Hold on!", msg: data.message },
          }),
        )
        return
      }
      if (data.status && (data.status.includes("match") || data.status === "already_joined")) {
        setMatchId(data.match_id)
        navigate(`/prisoners/game/${data.match_id}`)
      } else {
        console.error("Error creating game:", data.message)
        alert("Failed to create game. Please try again.")
      }
    } catch (error) {
      console.error("Error starting game:", error)
      window.dispatchEvent(
        new CustomEvent("GLOBAL_MODAL", {
          detail: { title: "Network problem", msg: "Could not reach the server." },
        }),
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="game-rules-page">
      <div className="game-rules-container">
        <div className="game-rules-header">
          <h1 className="game-rules-title">{currentRoom.title}</h1>
          <p className="game-rules-subtitle">
            {currentRoom.subtitle}
          </p>
        </div>

        {/* How to Play Section */}
        <div className="how-to-play-card">
          <div className="how-to-play-header">
            {currentRoom.icon}
            <h2 className="how-to-play-title">How to Play</h2>
          </div>
          <div className="how-to-play-steps">
            <div className="step">
              <div className="step-number">
                <span>1</span>
              </div>
              <h3 className="step-title">{currentRoom.step1}</h3>
              <p className="step-description">{currentRoom.step1Desc}</p>
            </div>
            <div className="step">
              <div className="step-number">
                <span>2</span>
              </div>
              <h3 className="step-title">See the Results</h3>
              <p className="step-description">Points are awarded based on both players' choices</p>
            </div>
            <div className="step">
              <div className="step-number">
                <span>3</span>
              </div>
              <h3 className="step-title">Play 25 Rounds</h3>
              <p className="step-description">Accumulate points across multiple rounds to win</p>
            </div>
            <div className="step">
              <div className="step-number">
                <span>4</span>
              </div>
              <h3 className="step-title">Time Limit</h3>
              <p className="step-description">You have 15 seconds per round to make your choice</p>
            </div>
          </div>
        </div>

        {/* Payoff Matrix */}
        <div className="payoff-section">
          <h3 className="payoff-title">Payoff Matrix</h3>
          <PayoffMatrix room={room} />
        </div>

        {/* Game Mode Selection */}
        <div className="game-modes">
          <div className="game-mode-card">
            <div className="game-mode-icon-container">
              <Users className="game-mode-icon" />
            </div>
            <h3 className="game-mode-title">Play Online</h3>
            <p className="game-mode-description">Challenge a real player in strategic decision-making</p>
            <button
              onClick={() => handleStartGame("online")}
              className="game-mode-button online-button"
              disabled={isLoading}
            >
              {isLoading ? "Creating Game..." : "Find Opponent"}
            </button>
          </div>

          <div className="game-mode-card">
            <div className="game-mode-icon-container">
              <Bot className="game-mode-icon" />
            </div>
            <h3 className="game-mode-title">Play with Bot</h3>
            <p className="game-mode-description">Practice against our intelligent AI opponent</p>
            <button
              onClick={() => handleStartGame("bot")}
              className="game-mode-button bot-button"
              disabled={isLoading}
            >
              {isLoading ? "Creating Game..." : "Start Game"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GameRules