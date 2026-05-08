import { Lock, Music, Mic2, Target } from "lucide-react"
import { useNavigate } from "react-router-dom"
import "../PublicGoodsGames/HomePage.css"

export default function PrisonersRoomPage() {
    const navigate = useNavigate()

    const selectRoom = (room) => {
        navigate(`/prisoners/${room}`)
    }

    return (
        <div className="homepage">
            <div className="homepage-container">
                <div className="homepage-header">
                    <h1 className="homepage-title">Choose a Game Room</h1>
                    <p className="homepage-subtitle">
                        Select a strategic game to play. Each room has different payoffs and rules.
                    </p>
                </div>

                <div className="room-grid">
                    <div className="game-mode-card">
                        <div className="game-mode-icon-container">
                            <Lock className="game-mode-icon" />
                        </div>
                        <h3 className="game-mode-title">Prisoners' Dilemma</h3>
                        <p className="game-mode-description">
                            The classic dilemma: cooperate for mutual gain or defect for personal advantage.
                        </p>
                        <button
                            className="game-mode-button online-button"
                            onClick={() => selectRoom("prisoners-dilemma")}
                        >
                            Enter Room
                        </button>
                    </div>

                    <div className="game-mode-card">
                        <div className="game-mode-icon-container">
                            <Music className="game-mode-icon" />
                        </div>
                        <h3 className="game-mode-title">Bach or Stravinsky (1)</h3>
                        <p className="game-mode-description">
                            A coordination game also known as Battle of the Sexes. Can you agree on a choice?
                        </p>
                        <button
                            className="game-mode-button online-button"
                            onClick={() => selectRoom("bach-stravinsky-1")}
                        >
                            Enter Room
                        </button>
                    </div>

                    <div className="game-mode-card">
                        <div className="game-mode-icon-container">
                            <Mic2 className="game-mode-icon" />
                        </div>
                        <h3 className="game-mode-title">Bach or Stravinsky (2)</h3>
                        <p className="game-mode-description">
                            Another variation of the coordination game with different payoff distributions.
                        </p>
                        <button
                            className="game-mode-button online-button"
                            onClick={() => selectRoom("bach-stravinsky-2")}
                        >
                            Enter Room
                        </button>
                    </div>

                    <div className="game-mode-card">
                        <div className="game-mode-icon-container">
                            <Target className="game-mode-icon" />
                        </div>
                        <h3 className="game-mode-title">Stag and Hunt</h3>
                        <p className="game-mode-description">
                            Cooperate to hunt a stag or act alone to hunt a hare. Trust is key.
                        </p>
                        <button
                            className="game-mode-button online-button"
                            onClick={() => selectRoom("stag-hunt")}
                        >
                            Enter Room
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
