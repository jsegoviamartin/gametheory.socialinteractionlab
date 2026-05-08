import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import { Clock, Users, Bot, Trophy, Target, Zap, Shield, MessageSquare, Music, Mic2 } from "lucide-react"
import { getPlayerFingerprint } from "../services/gameApi"
import PayoffMatrix from "./PayoffMatrix"
import "./GameBoard.css"
import Modal from "./Modal"
import PayoffsTable from "./PayoffsTable"
import GameTimer from "./GameTimer"
import SurveyForm from "./SurveyForm"
function GameBoard({ playerFingerprint }) {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const experimentId = searchParams.get("experiment_id") || searchParams.get("experiment")
  const [connected, setConnected] = useState(false)
  const [gameState, setGameState] = useState({
    currentRound: 1,
    maxRounds: 25,
    player1Score: 0,
    player2Score: 0,
    player1CooperationPercent: 0,
    player2CooperationPercent: 0,
    roundHistory: [],
    waitingForOpponent: true,
    gameOver: false,
    player1LastAction: null,
    player2LastAction: null,
    gameMode: "online",
    gameType: "prisoners-dilemma",
    labelA: "Cooperate",
    labelB: "Defect"
  })
  // Calculate P1 and P2 safely
  const P1 = gameState.roundHistory && gameState.roundHistory.length > 0
    ? gameState.roundHistory[gameState.roundHistory.length - 1]?.player1Points
    : 0;
  const P2 = gameState.roundHistory && gameState.roundHistory.length > 0
    ? gameState.roundHistory[gameState.roundHistory.length - 1]?.player2Points
    : 0;

  // console.log("gameState:", gameState);
  // last round history
  console.log("last round history p1 points:", P1);
  console.log("P1:", P1, "P2:", P2)
  const [timeLeft, setTimeLeft] = useState(15)
  const [canMakeChoice, setCanMakeChoice] = useState(true)
  const [isPlayer1, setIsPlayer1] = useState(true)
  const [waitingForMyAction, setWaitingForMyAction] = useState(false)
  const [myFingerprint, setMyFingerprint] = useState("")
  const [showSurvey, setShowSurvey] = useState(false)
  const [surveySubmitted, setSurveySubmitted] = useState(false)
  const socketRef = useRef(null)
  const timedOutRef = useRef(false)
  const [modal, setModal] = useState({ open: false, title: "", msg: "", redirectTo: "/prisoners" })
  const [roundPhase, setRoundPhase] = useState("choosing") // 'choosing', 'results', 'transition'
  const [lastRoundResult, setLastRoundResult] = useState(null)
  const [transitionCountdown, setTransitionCountdown] = useState(3)
  const [showInitialCountdown, setShowInitialCountdown] = useState(false)
  const [initialCountdown, setInitialCountdown] = useState(3)

  // Connect to WebSocket
  useEffect(() => {
    if (!matchId) {
      navigate("/prisoners")
      return
    }
    const fingerprint = playerFingerprint || getPlayerFingerprint()
    if (!fingerprint) {
      navigate("/prisoners")
      return
    }

    setMyFingerprint(fingerprint)
    console.log("Connecting with fingerprint:", fingerprint)

    // Dynamic WebSocket URL
    const isLocalhost = window.location.hostname === 'localhost';
    const wsUrl = isLocalhost
      ? `ws://localhost:8001/ws/game/${matchId}/`  // Use backend port in development
      : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/game/${matchId}/`;

    const socket = new WebSocket(wsUrl)
    socketRef.current = socket

    socket.onopen = () => {
      console.log("WebSocket connected")
      setConnected(true)
      socket.send(
        JSON.stringify({
          action: "join",
          player_fingerprint: fingerprint,
        }),
      )
    }

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      console.log("WebSocket message received:", data)

      if (data.game_state) {
        console.log("Game state update:", data.game_state)
        updateGameState(data.game_state, fingerprint)
      }

      if (data.game_aborted) {
        console.log("Game aborted:", data)
        setModal({
          open: true,
          title: "Match Ended",
          msg: data.message,
          redirectTo: data.redirect_to || "/prisoners"  // Use redirect_to from server, default to prisoners
        })
        return
      }

      if (data.player_fingerprint && data.action) {
        console.log(`Player ${data.player_fingerprint} performed action: ${data.action}`)
        handlePlayerAction(data.player_fingerprint, data.action, fingerprint)
      }

      if (data.game_over) {
        console.log("Game over received:", data)
        setGameState((prevState) => ({
          ...prevState,
          gameOver: true,
          player1Score: data.player1_score,
          player2Score: data.player2_score,
          player1CooperationPercent: data.player1_cooperation,
          player2CooperationPercent: data.player2_cooperation,
        }))
      }

      if (data.error) {
        console.error("Error from server:", data.error)
        alert(data.error)
        return
      }
    }

    socket.onclose = () => {
      console.log("WebSocket disconnected")
      // setConnected(false)
      // Only show the “connecting” screen for *unexpected* drops
      if (!timedOutRef.current) {
        setConnected(false)
      }
    }

    socket.onerror = (error) => {
      console.error("WebSocket error:", error)
    }

    return () => {
      if (socket) {
        socket.close()
      }
    }
  }, [matchId, navigate, playerFingerprint])

  // Effect for the initial "3, 2, 1, Go!" countdown
  useEffect(() => {
    if (showInitialCountdown) {
      if (initialCountdown > 0) {
        const timer = setTimeout(() => {
          setInitialCountdown(prev => prev - 1)
        }, 1000)
        return () => clearTimeout(timer)
      } else {
        // After "Go!" is shown for a second (implicitly, since countdown is 0), hide the countdown
        const timer = setTimeout(() => {
          setShowInitialCountdown(false)
        }, 1000) // Show "Go!" for 1 second
        return () => clearTimeout(timer)
      }
    }
  }, [showInitialCountdown, initialCountdown])

  // Effect to manage the results display duration and round transitions
  useEffect(() => {
    if (roundPhase === "results") {
      const timer = setTimeout(() => {
        setRoundPhase("transition")
        setTransitionCountdown(3)
      }, 4000) // Show results for 4 seconds

      return () => clearTimeout(timer)
    } else if (roundPhase === "transition") {
      if (transitionCountdown > 0) {
        const timer = setTimeout(() => {
          setTransitionCountdown(prev => prev - 1)
        }, 1000)
        return () => clearTimeout(timer)
      } else {
        // Transition countdown finished, start new round
        setRoundPhase("choosing")
        setLastRoundResult(null)
        setTimeLeft(15) // Reset timer for the new round
        setCanMakeChoice(true)
      }
    }
  }, [roundPhase, transitionCountdown])

  const updateGameState = (newState, fingerprint) => {
    console.log("Updating game state with fingerprint:", fingerprint)
    console.log("New state:", newState)

    setGameState((prev) => {
      // Check if a round has just ended
      if (newState.currentRound > prev.currentRound && !newState.gameOver) {
        const lastRoundData = newState.roundHistory.find((r) => r.roundNumber === prev.currentRound)
        if (lastRoundData) {
          setLastRoundResult({
            player1Action: lastRoundData.player1Action,
            player2Action: lastRoundData.player2Action,
            player1Payoff: lastRoundData.player1Payoff,
            player2Payoff: lastRoundData.player2Payoff,
          })
          setRoundPhase("results")
          setCanMakeChoice(false) // Disable choices during results phase
        }
      }

      // Check if the game is starting
      if (prev.waitingForOpponent && !newState.waitingForOpponent) {
        setShowInitialCountdown(true)
      }

      const merged = { ...prev, ...newState }
      const iAmP1 = merged.player1Fingerprint === fingerprint

      setIsPlayer1(iAmP1)
      if (roundPhase === "choosing") {
        checkIfWaitingForMyAction(merged, iAmP1)
      } else {
        setWaitingForMyAction(false)
      }
      return merged
    })
  }

  const checkIfWaitingForMyAction = (state, iAmP1) => {
    if (state.waitingForOpponent || state.gameOver) {
      setWaitingForMyAction(false)
      return
    }
    const thisRound = state.roundHistory.find((r) => r.roundNumber === state.currentRound)

    if (!thisRound) {
      setWaitingForMyAction(true)
    } else if (iAmP1) {
      setWaitingForMyAction(thisRound.player1Action == null)
    } else {
      setWaitingForMyAction(thisRound.player2Action == null)
    }

    const myLast = iAmP1 ? state.player1LastAction : state.player2LastAction
    setWaitingForMyAction(myLast == null)
  }

  const handlePlayerAction = (actionPlayerFingerprint, action, myFingerprint) => {
    console.log(`Action from ${actionPlayerFingerprint}, my fingerprint: ${myFingerprint}`)

    if (actionPlayerFingerprint === myFingerprint) {
      setWaitingForMyAction(false)
      setCanMakeChoice(false)
      console.log("My action processed")
    }
  }

  const makeChoice = (action) => {
    if (!canMakeChoice || !connected || gameState.waitingForOpponent || !waitingForMyAction) {
      console.log("Cannot make choice:", {
        canMakeChoice,
        connected,
        waitingForOpponent: gameState.waitingForOpponent,
        waitingForMyAction,
      })
      return
    }

    console.log(`Making choice: ${action}`)
    setCanMakeChoice(false)
    setWaitingForMyAction(false)

    if (socketRef.current) {
      socketRef.current.send(
        JSON.stringify({
          action,
          player_fingerprint: myFingerprint,
        }),
      )
    }
  }

  // Handle timeout - send timeout message to server
  const handleTimeout = () => {
    if (!waitingForMyAction || !connected) {
      return
    }

    // console.log("Timeout reached - abandoning match")

    // if (socketRef.current) {
    //   socketRef.current.send(
    //     JSON.stringify({
    //       action: "timeout",
    //       player_fingerprint: myFingerprint,
    //     }),
    //   )
    // }
    console.log("⏱️ 10 s exceeded – aborting match")

    // 1️⃣ show the modal immediately (don’t wait for the server)
    timedOutRef.current = true
    setModal({
      open: true,
      title: "Time’s up!",
      msg: "You didn’t choose within 10 s. Returning to the lobby…",
      redirectTo: "/prisoners",
    })

    // 2️⃣ tell the server (best-effort)
    socketRef.current?.send(
      JSON.stringify({
        action: "timeout",
        player_fingerprint: myFingerprint,
      }),
    )

    // 3️⃣ close the socket yourself so onclose fires instantly
    socketRef.current?.close()
  }

  // Handle modal close with redirection
  const handleModalClose = () => {
    const exitPath = gameState.experimentId ? `/experiments/${gameState.experimentId}/home` : (modal.redirectTo || "/prisoners");
    setModal({ open: false, title: "", msg: "", redirectTo: "/prisoners" })
    navigate(exitPath)
  }

  // if (!connected) {
  //   return (
  //     <div className="game-page">
  //       <div className="connecting-screen">
  //         <div className="connecting-animation">
  //           <div className="connecting-spinner"></div>
  //           <h2 className="connecting-title">Connecting to Game Server</h2>
  //           <p className="connecting-text">Establishing secure connection...</p>
  //         </div>
  //       </div>
  //     </div>
  //   )
  // }
  // 👉 1. Modal always overrides everything else
  if (modal.open) {
    return (
      <div className="game-page">
        <Modal
          open={modal.open}
          title={modal.title}
          message={modal.msg}
          onClose={handleModalClose}
        />
      </div>
    );
  }

  // Survey submission handlers (must be defined before use)
  const handleSurveySubmit = (result) => {
    console.log('Survey submitted successfully:', result);
    setSurveySubmitted(true);
    setShowSurvey(false);
    // Show a success message
    const exitPath = gameState.experimentId ? `/experiment/${gameState.experimentId}` : "/prisoners";
    setModal({
      open: true,
      title: "Survey Submitted",
      msg: "Thank you for your feedback! Your responses have been recorded.",
      redirectTo: exitPath
    });
  };

  const handleSurveyCancel = () => {
    setShowSurvey(false);
  };

  // 👉 2. Survey modal check (should be early in the component flow)
  if (showSurvey) {
    console.log('Rendering survey modal, showSurvey:', showSurvey);
    console.log('Survey modal props:', {
      matchId,
      playerFingerprint: playerFingerprint || localStorage.getItem("playerUUID"),
      gameType: "prisoners"
    });
    console.log('About to render survey modal overlay');
    return (
      <div
        className="survey-modal-overlay"
        style={{
          zIndex: 1000,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onClick={(e) => {
          console.log('Modal overlay clicked');
          if (e.target === e.currentTarget) {
            handleSurveyCancel();
          }
        }}
      >
        <div
          className="survey-modal-content"
          style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
          }}
        >
          <SurveyForm
            matchId={matchId}
            playerFingerprint={playerFingerprint || localStorage.getItem("playerUUID")}
            gameType="prisoners"
            onSubmit={handleSurveySubmit}
            onCancel={handleSurveyCancel}
          />
        </div>
      </div>
    );
  }

  // 👉 2. Only show “connecting” when no modal is displayed
  if (!connected) {
    return (
      <div className="game-page">
        <div className="connecting-screen">
          <div className="connecting-animation">
            <div className="connecting-spinner"></div>
            <h2 className="connecting-title">Connecting to Game Server</h2>
            <p className="connecting-text">Establishing secure connection...</p>
          </div>
        </div>
      </div>
    );
  }
  if (gameState.waitingForOpponent) {
    return (
      <div className="game-page">
        <div className="waiting-screen">
          <div className="waiting-container">
            <div className="waiting-animation">
              <Users className="waiting-icon" />
            </div>
            <h2 className="waiting-title">Waiting for Opponent</h2>
            <p className="waiting-text">
              {gameState.gameMode === "online"
                ? "Please wait while we find another player to join your game..."
                : "Preparing bot opponent..."}
            </p>
            <div className="waiting-info">
              <div className="info-item">
                <span>Match ID:</span>
                <code className="match-id">{matchId}</code>
              </div>
              <div className="info-item">
                <span>Game Mode:</span>
                <span className="game-mode">
                  {gameState.gameMode === "online" ? (
                    <>
                      <Users className="mode-icon" />
                      Online
                    </>
                  ) : (
                    <>
                      <Bot className="mode-icon" />
                      Bot
                    </>
                  )}
                </span>
              </div>
            </div>
            <PayoffMatrix 
              room={gameState.roomName || "prisoners-dilemma"}
              customPayoffs={gameState}
            />
          </div>
        </div>
      </div>
    )
  }

  if (showInitialCountdown) {
    return (
      <div className="game-page">
        <div className="timer-section round-transition">
          <div className="transition-content">
            <div className="transition-number">{initialCountdown > 0 ? initialCountdown : "Go!"}</div>
            <h4>Round 1</h4>
            <p>Get ready for the first round!</p>
          </div>
        </div>
      </div>
    )
  }

  if (gameState.gameOver) {
    const myScore = isPlayer1 ? gameState.player1Score : gameState.player2Score
    const opponentScore = isPlayer1 ? gameState.player2Score : gameState.player1Score
    const isWinner = myScore > opponentScore
    const isTie = myScore === opponentScore

    return (
      <div className="game-page">
        <div className="game-over-screen">
          <div className="game-over-container">
            <div className="game-over-header">
              <div className={`result-icon-container ${isWinner ? "winner" : isTie ? "tie" : "loser"}`}>
                <Trophy className="result-icon" />
              </div>
              <h1 className="game-over-title">{isWinner ? "Victory!" : isTie ? "It's a Tie!" : "Game Over"}</h1>
              <p className="game-over-subtitle">
                {isWinner
                  ? "Congratulations! You outplayed your opponent."
                  : isTie
                    ? "You and your opponent scored equally well."
                    : "Better luck next time! Learn from this experience."}
              </p>
            </div>

            <div className="final-scores-grid">
              <div className={`score-card ${isPlayer1 ? "my-score" : "opponent-score"}`}>
                <div className="score-header">
                  <Target className="score-icon" />
                  <h3>Your Score</h3>
                </div>
                <div className="score-value">{myScore}</div>
                <div className="score-details">
                  <span>{gameState.maxRounds} rounds played</span>
                </div>
              </div>

              <div className={`score-card ${!isPlayer1 ? "my-score" : "opponent-score"}`}>
                <div className="score-header">
                  {gameState.gameMode === "online" ? <Users className="score-icon" /> : <Bot className="score-icon" />}
                  <h3>{gameState.gameMode === "online" ? "Opponent" : "Bot"}</h3>
                </div>
                <div className="score-value">{opponentScore}</div>
                <div className="score-details">
                  <span>{gameState.maxRounds} rounds played</span>
                </div>
              </div>
            </div>

            <div className="game-actions">
              {!surveySubmitted && (
                <button
                  className="survey-button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Survey button clicked! Current showSurvey state:', showSurvey);
                    console.log('Setting showSurvey to true');
                    setShowSurvey(true);
                    console.log('showSurvey state after setShowSurvey(true):', showSurvey);
                  }}
                >
                  <MessageSquare className="button-icon" />
                  PLEASE COMPLETE SURVEY - We'd appreciate your feedback!
                </button>
              )}
              <button className="play-again-button" onClick={() => {
                const exitPath = gameState.experimentId ? `/experiments/${gameState.experimentId}/home` : "/prisoners";
                navigate(exitPath);
              }}>
                <Zap className="button-icon" />
                {gameState.experimentId ? "Back to Laboratory" : "Play Again"}
              </button>
              <button className="menu-button" onClick={() => {
                const exitPath = gameState.experimentId ? `/join-custom` : "/";
                navigate(exitPath);
              }}>
                <Shield className="button-icon" />
                {gameState.experimentId ? "Laboratory Menu" : "Main Menu"}
              </button>
            </div>

            {/* Hide the payoffs table in victory screen for cleaner look */}
            {/* <div className="round-history-section">
              <PayoffsTable history={gameState.roundHistory} />
            </div> */}
          </div>
        </div>
      </div>
    )
  }


  const roomConfigs = {
    "prisoners-dilemma": {
      title: "Prisoner's Dilemma",
      actionA: "Cooperate",
      actionB: "Defect",
      iconA: <Shield className="button-icon" />,
      iconB: <Zap className="button-icon" />,
    },
    "bach-stravinsky-1": {
      title: "Battle of the Sexes (1)",
      actionA: "Prize Fight",
      actionB: "Ballet",
      iconA: <Music className="button-icon" />,
      iconB: <Mic2 className="button-icon" />,
    },
    "bach-stravinsky-2": {
      title: "Battle of the Sexes (2)",
      actionA: "Prize Fight",
      actionB: "Ballet",
      iconA: <Music className="button-icon" />,
      iconB: <Mic2 className="button-icon" />,
    },
    "stag-hunt": {
      title: "Stag and Hunt",
      actionA: "Stag",
      actionB: "Hare",
      iconA: <Target className="button-icon" />,
      iconB: <Zap className="button-icon" />,
    },
  }
  
  // Custom experiment override
  if (gameState.gameType === 'custom' || !roomConfigs[gameState.gameType]) {
    roomConfigs[gameState.gameType] = {
      title: gameState.roomName || "Custom Economic Game",
      actionA: gameState.labelA || "Choice A",
      actionB: gameState.labelB || "Choice B",
      iconA: <Shield className="button-icon" />,
      iconB: <Zap className="button-icon" />,
    }
  }

  const currentRoom = roomConfigs[gameState.gameType] || roomConfigs["prisoners-dilemma"]

  return (
    <div className="game-page">
      <div className="game-screen">
        <div className="game-header">
          <div className="game-title-section">
            <h1 className="game-title">{currentRoom.title}</h1>
            <p className="game-subtitle">
              Round {roundPhase === "choosing" ? gameState.currentRound : gameState.currentRound - 1} of {gameState.maxRounds}
            </p>
          </div>

          <div className="game-status">
            <div className="player-info">
              <span className="player-label">You are Player {isPlayer1 ? "1" : "2"}</span>
              <div className="game-mode-indicator">
                {gameState.gameMode === "online" ? (
                  <>
                    <Users className="mode-icon" />
                    Online
                  </>
                ) : (
                  <>
                    <Bot className="mode-icon" />
                    vs Bot
                  </>
                )}
              </div>
            </div>

            <div className="action-status">
              {waitingForMyAction ? (
                <div className="status-active">
                  <Zap className="status-icon" />
                  Your turn to choose!
                </div>
              ) : (
                <div className="status-waiting">
                  <Clock className="status-icon" />
                  Waiting for opponent...
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="game-content">
          <div className="game-main">
            {roundPhase === "choosing" ? (
              <div className="timer-section">
                <GameTimer
                  timeLeft={timeLeft}
                  setTimeLeft={setTimeLeft}
                  canMakeChoice={canMakeChoice && waitingForMyAction}
                  onTimeUp={handleTimeout} // Calls handleTimeout when timer expires
                />
              </div>
            ) : roundPhase === "results" ? (
              <div className="timer-section results-display">
                <Trophy className="results-icon" />
                <h4>Round {gameState.currentRound > 1 ? gameState.currentRound - 1 : 1} Results</h4>
              </div>
            ) : (
              <div className="timer-section round-transition">
                <div className="transition-content">
                  <div className="transition-number">{transitionCountdown}</div>
                  <h4>Round {gameState.currentRound}</h4>
                  <p>Get ready for the next round!</p>
                </div>
              </div>
            )}

            <div className="scores-section">
              <div className="score-card player1">
                <div className="score-header">
                  <Target className="score-icon" />
                  <h3>Player 1</h3>
                </div>
                <div className="score-value">
                  {roundPhase === "results" ? (
                    P1
                  ) : (
                    ""
                  )}
                </div>
                <div className="score-label">
                  {roundPhase === "results" ? "Total Score" : roundPhase === "choosing" ? "This Round" : ""}
                </div>
              </div>

              <div className="score-card player2">
                <div className="score-header">
                  {gameState.gameMode === "online" ? <Users className="score-icon" /> : <Bot className="score-icon" />}
                  <h3>Player 2</h3>
                </div>
                <div className="score-value">
                  {roundPhase === "results" ? (
                    P2
                  ) : (
                    ""
                  )}
                </div>
                <div className="score-label">
                  {roundPhase === "results" ? "Total Score" : roundPhase === "choosing" ? "This Round" : ""}
                </div>
              </div>
            </div>

            <div className="action-section">
              <h3 className="action-title">
                {roundPhase === "choosing" ? "Make Your Choice" : roundPhase === "results" ? "Round Over" : "Next Round Starting..."}
              </h3>
              <div className="action-buttons">
                <button
                  className={`action-button cooperate-button ${!canMakeChoice || !waitingForMyAction || roundPhase !== "choosing" ? "disabled" : ""
                    }`}
                  onClick={() => makeChoice(currentRoom.actionA)}
                  disabled={!canMakeChoice || !waitingForMyAction || roundPhase !== "choosing"}
                >
                  {currentRoom.iconA}
                  {currentRoom.actionA}
                </button>
                <button
                  className={`action-button defect-button ${!canMakeChoice || !waitingForMyAction || roundPhase !== "choosing" ? "disabled" : ""
                    }`}
                  onClick={() => makeChoice(currentRoom.actionB)}
                  disabled={!canMakeChoice || !waitingForMyAction || roundPhase !== "choosing"}
                >
                  {currentRoom.iconB}
                  {currentRoom.actionB}
                </button>
              </div>
            </div>
          </div>

          <div className="game-sidebar">
            <PayoffMatrix
              highlightedCell={roundPhase === "results" ? lastRoundResult : null}
              room={gameState.gameType}
              customPayoffs={{
                p1_cc: gameState.p1_cc, p2_cc: gameState.p2_cc,
                p1_cd: gameState.p1_cd, p2_cd: gameState.p2_cd,
                p1_dc: gameState.p1_dc, p2_dc: gameState.p2_dc,
                p1_dd: gameState.p1_dd, p2_dd: gameState.p2_dd,
                labelA: gameState.labelA, labelB: gameState.labelB
              }}
            />

            <div className="round-progress">
              <h3 className="progress-title">Round Progress</h3>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${(gameState.currentRound / gameState.maxRounds) * 100}%` }}
                ></div>
              </div>
              <div className="progress-text">
                {gameState.currentRound} / {gameState.maxRounds} rounds
              </div>
            </div>
          </div>
        </div>

        <div className="round-history-section">
          <PayoffsTable history={gameState.roundHistory} />
        </div>
      </div>

      <Modal
        open={modal.open}
        title={modal.title}
        message={modal.msg}
        onClose={handleModalClose} // Updated to use handleModalClose
      />
    </div>
  )
}

export default GameBoard
