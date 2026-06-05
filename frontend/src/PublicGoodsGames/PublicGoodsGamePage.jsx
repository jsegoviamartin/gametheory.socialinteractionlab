import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Clock, Loader2, MessageSquare, X } from "lucide-react"
import "./GamePage.css"

import tableImg from "../assets/table.png"
import playerImg from "../assets/blue.png"
import redPlayerImg from "../assets/red.png"
import { getPlayerFingerprint, gameApi } from "../services/gameApi"
import PayoffsTable from "./PayoffsTable"
import { useWebSocketPGG } from "../hooks/useWebSocketPGG"
import SurveyForm from "../components/SurveyForm"



const ResultsPopup = ({ roundResults, onClose, roomType, playerIndex, roundNumber, TOTAL_ROUNDS }) => {
  const isBasic = roomType === "basic" || !roomType;
  const isFinalized = isBasic || (roundResults && roundResults.stage2Actions);

  return (
    <>
      <div className="pgg-results-overlay" onClick={onClose}></div>
      <div className="pgg-results-popup-card">
        <h2>Round {roundResults.round} Results</h2>
        {roundResults.players.map((p, i) => {
          const pIdx = i + 1;
          const isMe = pIdx === playerIndex;

          return (
            <div key={i} className="pgg-result-row-container">
              <div className="pgg-result-row">
                <span style={{ fontWeight: isMe ? "bold" : "normal", color: isMe ? "#818CF8" : "inherit" }}>
                  {isMe ? "You" : `Player ${pIdx}`}
                </span>
                <span>Contributed: {p.contribution ?? 0}</span>
                <span>Payoff: {(p.payoff ?? 0).toFixed(2)}</span>
              </div>

              {roundResults.stage2Actions && (
                <div className="pgg-action-details">
                  {roundResults.stage2Actions.filter(a => a.target === pIdx && (a.actor === playerIndex || a.target === playerIndex)).map((a, idx) => (
                    <div key={`rx-${idx}`} className="pgg-action-tag incoming">
                      {a.actor === playerIndex ? "You" : `P${a.actor}`} {a.type.toUpperCase()}ED {isMe ? "you" : `P${pIdx}`}
                    </div>
                  ))}
                  {roundResults.stage2Actions.filter(a => a.actor === pIdx && (a.actor === playerIndex || a.target === playerIndex)).map((a, idx) => (
                    <div key={`tx-${idx}`} className="pgg-action-tag outgoing">
                      {isMe ? "You" : `P${pIdx}`} {a.type.toUpperCase()}ED {a.target === playerIndex ? "you" : `P${a.target}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div className="pgg-result-summary">
          Total Contribution: {roundResults.total ?? 0} | Group Return: {(roundResults.groupReturn ?? 0).toFixed(2)}
        </div>
        <button
          className="results-close-btn"
          onClick={onClose}
        >
          {isFinalized ? (roundNumber >= TOTAL_ROUNDS ? "Finish Game" : "Next Round") : "Continue"}
        </button>
      </div>
    </>
  );
}

export default function PublicGoodsGamePage() {
  const navigate = useNavigate()
  const params = new URLSearchParams(window.location.search)
  const matchId = params.get("match") || params.get("match_id")
  const mode = params.get("mode") || "online"
  const experimentId = params.get("experiment_id") || params.get("experiment")
  const playerFingerprint = getPlayerFingerprint()
  const {
    players: wsPlayers,
    socket,
    playerIndex,
    connectionStatus,
    roomType,
    gameParams,
    error,
    disconnect
  } = useWebSocketPGG(matchId, playerFingerprint)

  // Use dynamic parameters from the laboratory
  const MAX_COINS = gameParams?.endowment || 20;
  const TOTAL_ROUNDS = gameParams?.totalRounds || 25;
  const ROUND_TIME = 25; // Standard phase time
  // ---------------------------------
  // Players
  // ---------------------------------
  const [players, setPlayers] = useState([])
  const isReady = connectionStatus === "connected" && playerIndex
  const [connectedPlayers, setConnectedPlayers] = useState([]);
  const [currentContribution, setCurrentContribution] = useState(0)
  const [phase, setPhase] = useState("lobby") // lobby | countdown | contribution | waiting | results | stage2 | finished
  const [countdown, setCountdown] = useState(3)
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME)
  const [roundResults, setRoundResults] = useState(null)
  const [roundNumber, setRoundNumber] = useState(1)
  const [history, setHistory] = useState([])
  const [gameEndedReason, setGameEndedReason] = useState(null)
  const contributionSubmitted = useRef(false)
  const [showSurvey, setShowSurvey] = useState(false)
  const [surveySubmitted, setSurveySubmitted] = useState(false)
  const [showGameOverPopup, setShowGameOverPopup] = useState(true)


  useEffect(() => {
    const handlePop = () => {
      console.log("⬅️ Browser navigation → disconnect WS");
      disconnect();
      const exitPath = experimentId ? `/experiments/${experimentId}/home` : "/public-goods";
      navigate(exitPath, { replace: true });
    };

    const handleUnload = () => {
      console.log("❌ Page unload → disconnect WS");
      disconnect();
    };

    window.addEventListener("popstate", handlePop);
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("popstate", handlePop);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [disconnect, navigate]);




  // ---------------------------------
  // Lobby → Countdown transition
  // ---------------------------------
  useEffect(() => {
    if (phase !== "lobby") return;

    // In bot mode, we only need ourselves. In online mode, we need all 4.
    const threshold = mode === "bot" ? 1 : 4;

    if (connectedPlayers.length >= threshold) {
      console.log(`🏁 ${connectedPlayers.length} players connected, starting countdown`);
      setPhase("countdown");
    }
  }, [phase, connectedPlayers, mode]);

  // ---------------------------------
  // Countdown (3-2-1)
  // ---------------------------------
  useEffect(() => {
    if (phase !== "countdown") return
    if (countdown === 0) {
      setPhase("contribution")
      setTimeLeft(ROUND_TIME)
      setCountdown(3)
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown])



  // ---------------------------------
  // Real 25s round timer
  // ---------------------------------
  useEffect(() => {
    if (phase !== "contribution" && phase !== "stage2") return
    if (timeLeft === 0) {
      const reason = `⏱️ Time is up in ${phase} phase! Game ended.`;
      setGameEndedReason(reason);

      // Notify others if online
      if (mode === "online" && socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          action: "terminate",
          reason: reason
        }));
      }

      disconnect();
      setPhase("finished");
      return;
    }

    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearTimeout(timer)
  }, [phase, timeLeft, navigate, matchId, mode, socket, disconnect])

  const handleSliderChange = (e) => setCurrentContribution(Number(e.target.value))

  const handleSubmit = () => {
    console.log("🟡 Submit clicked", {
      socketExists: !!socket,
      socketState: socket?.readyState,
      currentContribution,
      contributionSubmitted: contributionSubmitted.current
    });

    if (contributionSubmitted.current) {
      console.warn("⏹️ Already submitted, ignoring");
      return;
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn("❌ Socket not open, cannot submit");
      return;
    }

    contributionSubmitted.current = true;

    console.log("📤 Sending contribution to WS:", currentContribution);
    socket.send(JSON.stringify({
      action: "contribute",
      amount: currentContribution,
      round: roundNumber,
    }));
    setPhase("waiting");
  };









  useEffect(() => {
    if (!wsPlayers || wsPlayers.length === 0) return

    // Use players array from WebSocket
    setPlayers(wsPlayers)
  }, [wsPlayers])



  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event) => {
      console.log("📥 WS MESSAGE RECEIVED", event.data);

      try {
        const data = JSON.parse(event.data);

        // Track who is connected
        if (data.type === "player_connected") {
          setConnectedPlayers(prev => {
            if (prev.includes(data.fingerprint)) return prev;
            return [...prev, data.fingerprint];
          });
        }

        // TERMINATED (Someone left or time up)
        if (data.type === "terminated") {
          console.log("🏁 Match terminated by server:", data.reason);
          setGameEndedReason(data.reason);
          setPhase("finished");
          disconnect();
        }

        // Initial list of who is already there
        if (data.type === "joined") {
          setConnectedPlayers(data.all_players.filter(fp => fp !== null));
        }

        if (data.type === "round_results") {
          console.log("📊 Round results received:", data);
          setRoundNumber(data.round);

          const updatedPlayers = Array.from({ length: 4 }, (_, i) => {
            const pIdx = i + 1;
            const key = `player_${pIdx}`;
            const isYou = pIdx === playerIndex;
            const fingerprint = isYou ? playerFingerprint : key;
            return {
              id: pIdx,
              fingerprint: fingerprint,
              contribution: data.contributions[key] || 0,
              payoff: data.payoffs[key] || 0,
              img: isYou ? redPlayerImg : playerImg,
              label: isYou ? "You" : `Player ${pIdx}`
            };
          });

          setPlayers(updatedPlayers);

          const results = {
            round: data.round,
            players: updatedPlayers,
            total: data.total,
            groupReturn: data.group_return
          };

          setRoundResults(results);
          setHistory(prev => {
            const alreadyIn = prev.some(h => h.round === data.round);
            if (alreadyIn) {
              const newHistory = [...prev];
              const idx = newHistory.findIndex(h => h.round === data.round);
              newHistory[idx] = results;
              return newHistory;
            }
            return [...prev, results];
          });
          contributionSubmitted.current = false;
          setPhase("results");
        }

        if (data.type === "stage2_results") {
          console.log("📊 Stage 2 results received:", data);

          const updatedPlayers = Array.from({ length: 4 }, (_, i) => {
            const pIdx = i + 1;
            const key = `player_${pIdx}`;
            const isYou = pIdx === playerIndex;
            const fingerprint = isYou ? playerFingerprint : key;
            return {
              id: pIdx,
              fingerprint: fingerprint,
              contribution: data.contributions?.[key] ?? (roundResults?.players?.[i]?.contribution || 0),
              payoff: data.payoffs[key] || 0,
              img: isYou ? redPlayerImg : playerImg,
              label: isYou ? "You" : `Player ${pIdx}`
            };
          });

          setPlayers(updatedPlayers);

          const updatedResults = {
            round: data.round,
            players: updatedPlayers,
            total: data.total,
            groupReturn: data.group_return,
            stage2Actions: data.actions
          };

          setRoundResults(updatedResults);

          setHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length > 0) {
              const idx = newHistory.findIndex(h => h.round === data.round);
              if (idx !== -1) {
                newHistory[idx] = updatedResults;
              }
            }
            return newHistory;
          });

          setPhase("results"); // Show results again but with final payoffs
        }

        if (data.type === "error") {
          console.error("❌ WS ERROR RECEIVED:", data.message);
        }
      } catch (err) {
        console.error("WS parse error:", err, event.data);
      }
    };

    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socket, playerIndex]);



  const handleResultsClose = () => {
    const rawType = (roomType || "basic").toLowerCase().trim();
    const isBasic = rawType === "basic" || rawType === "none" || !rawType;
    const isFinalized = isBasic || (roundResults && roundResults.stage2Actions);

    console.log("🎯 handleResultsClose:", { roomType, rawType, isBasic, isFinalized, hasStage2Actions: !!roundResults?.stage2Actions });

    if (isFinalized) {
      advanceRound()
    } else {
      console.log("➡️ Moving to Stage 2");
      setPhase("stage2")
      setTimeLeft(ROUND_TIME) // Reset timer for Stage 2
    }
  }

  const [stage2ActionDone, setStage2ActionDone] = useState(false);

  const handleStage2Action = (targetIndex, actionType) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (stage2ActionDone) return;

    setStage2ActionDone(true);
    setPhase("waiting");

    socket.send(JSON.stringify({
      action: "stage2_action",
      target_index: targetIndex,
      action_type: actionType,
      round: roundNumber
    }));

    socket.send(JSON.stringify({
      action: "stage2_done",
      round: roundNumber
    }));
  };

  const handleStage2Done = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (stage2ActionDone) return;

    setStage2ActionDone(true);
    setPhase("waiting");

    socket.send(JSON.stringify({
      action: "stage2_done",
      round: roundNumber
    }));
  };

  const advanceRound = () => {
    if (roundNumber >= TOTAL_ROUNDS) {
      setGameEndedReason("Game finished! All rounds completed.")
      setPhase("finished")
      return
    }
    setRoundNumber((prev) => prev + 1)
    setPlayers((prev) =>
      prev.map((p) =>
        p.fingerprint === playerFingerprint
          ? { ...p, contribution: 0, payoff: 0, img: redPlayerImg, label: "You" }
          : { ...p, contribution: 0, payoff: 0, img: playerImg }
      )
    )
    setCurrentContribution(0)
    setStage2ActionDone(false)
    contributionSubmitted.current = false
    setRoundResults(null)
    setCountdown(3)
    setPhase("countdown")
  }

  const handleSurveySubmit = (result) => {
    console.log('Survey submitted successfully:', result);
    setSurveySubmitted(true);
    setShowSurvey(false);
    alert("Thank you for your feedback! Your responses have been recorded.");
  };

  const handleSurveyCancel = () => {
    setShowSurvey(false);
  };



  const rawType = (roomType || "basic").toLowerCase().trim();
  const isRewardRoom = rawType === "reward" || rawType === "mixed" || rawType === "reward&punish";
  const isPunishRoom = rawType === "punishment" || rawType === "punish" || rawType === "mixed" || rawType === "reward&punish";

  // ---------------------------------
  // Render
  // ---------------------------------
  return (
    <div className="game-page">
      <div className="game-container">
        {!isReady && (
          <div className="connection-blocker">
            <div className="connection-blocker__card">
              <div className="connection-blocker__spinner" />
              <div className="connection-blocker__title">
                {connectionStatus === "connecting" && "🔌 Connecting to game…"}
                {connectionStatus === "disconnected" && "⚠️ Disconnected from server"}
                {connectionStatus === "error" && `❌ ${error || "Connection error"}`}
              </div>
            </div>
          </div>
        )}
        {isReady && phase === "lobby" && (
          <div className="countdown-overlay">
            <div className="countdown-number" style={{ fontSize: "2rem" }}>
              {connectedPlayers.length}/4
            </div>
            <div className="countdown-text">Waiting for all players to connect WebSocket…</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.8rem", marginTop: "1rem" }}>
              {connectedPlayers.map((fp, i) => fp === playerFingerprint ? "You" : `Player ${i + 1}`).join(", ")}
            </div>
          </div>
        )}

        {isReady && phase === "countdown" && (
          <div className="countdown-overlay">
            <div className="countdown-number">{countdown}</div>
            <div className="countdown-text">Get ready…</div>
          </div>
        )}

        <div className="game-header">
          <h1 className="game-title simultaneous">Public Goods Game</h1>
          <p className="game-subtitle">
            {phase === "finished" ? "Game Finished" : `Round ${roundNumber}`}
          </p>
          <p className="match-id">Match ID: {matchId}</p>
          <p className="player-id">
            You are: {playerIndex ? `Player ${playerIndex}` : "Connecting..."}
          </p>
          <button
            style={{
              marginTop: "0.5rem",
              padding: "1rem 2rem",
              borderRadius: "1rem",
              border: "none",
              background: "#6366F1",
              color: "white",
              fontWeight: "bold",
              cursor: "pointer",
              alignSelf: "center"
            }}
            onClick={() => {
              if (mode === "online" && socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                  action: "terminate",
                  reason: `Player ${playerIndex} left the game.`
                }));
              }
              disconnect();
              const exitPath = experimentId ? `/experiments/${experimentId}/home` : "/public-goods";
              navigate(exitPath);
            }}
          >
            Leave Game
          </button>
        </div>

        {isReady && phase !== "finished" && (
          <div className="game-board">
            <div className="game-cardd">
              <div className="game-cardd-header">
                <div className="timer">
                  <Clock className="timer-icon" />
                  <span>{timeLeft}s</span>
                </div>
                <h2 className="phase-title">
                  {phase === "contribution"
                    ? "YOUR TURN TO CONTRIBUTE"
                    : phase === "waiting"
                      ? "Waiting for other players to contribute..."
                      : phase === "stage2"
                        ? `STAGE 2: ${rawType.toUpperCase()}`
                        : "RESULTS"}
                </h2>
              </div>

              <div className="game-cardd-content">
                <div className="instructions-compact">
                  {phase === "stage2" ? (
                    <p><strong>You can choose to reward or punish other players. Rewarding adds to their payoff, while punishing reduces it.</strong></p>
                  ) : (
                    <p><strong>Decide how many coins you want to contribute to the public pool. The total contribution will be multiplied and redistributed.</strong></p>
                  )}
                </div>

                <div className="public-goods-table-area">
                  <img src={tableImg} alt="Round Table" className="public-goods-table" />
                  {players.map((p, i) => {
                    const pos = ["top-left", "top-right", "bottom-left", "bottom-right"][i];
                    return (
                      <div key={i}>
                        <img src={p.img}
                          alt=""
                          className={`player player-${pos}`} />
                        <span className={`pgg-player-label label-${pos}`}>
                          {p.label || (p.fingerprint === playerFingerprint ? "You" : p.fingerprint)}
                        </span>

                        {phase === "stage2" && p.fingerprint !== playerFingerprint && (
                          <div className={`stage2-btn-group btn-group-${pos}`}>
                            {isRewardRoom && (
                              <button
                                className="stage2-btn reward-btn"
                                onClick={() => handleStage2Action(p.id, "reward")}
                                disabled={stage2ActionDone}
                              >
                                REWARD
                              </button>
                            )}
                            {isPunishRoom && (
                              <button
                                className="stage2-btn punish-btn"
                                onClick={() => handleStage2Action(p.id, "punish")}
                                disabled={stage2ActionDone}
                              >
                                PUNISH
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}


                </div>

                {phase === "contribution" && connectionStatus === "connected" && playerIndex && (
                  <div className="horizontal-contribution-area">
                    <div className="coin-stack contribution-stack">
                      <div
                        className="coin-stack-visual"
                        style={{ width: `${(currentContribution / MAX_COINS) * 300 + 30}px` }}
                      >
                        <div className="coin-amount">{currentContribution}</div>
                      </div>
                      <div className="stack-label">YOU CONTRIBUTE</div>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max={gameParams?.endowment || 20}
                      value={currentContribution}
                      onChange={handleSliderChange}
                      className="horizontal-slider"
                    />

                    <button className="submit-button-visual" onClick={handleSubmit}>
                      SUBMIT
                    </button>
                  </div>
                )}
                {phase === "waiting" && (
                  <div className="waiting-section">
                    <div className="waiting-animation">
                      <Loader2 className="waiting-spinner" />
                      <p className="waiting-text">Waiting for other players to contribute...</p>
                    </div>
                  </div>
                )}
                {phase === "stage2" && (
                  <button
                    className="skip-stage-btn"
                    onClick={handleStage2Done}
                    disabled={stage2ActionDone}
                  >
                    SKIP STAGE
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="pgg-payoffs-area">
            <PayoffsTable history={history} playerIndex={playerIndex} />
          </div>
        )}
      </div>

      {showSurvey && (
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
              playerFingerprint={playerFingerprint}
              gameType="public-goods"
              onSubmit={handleSurveySubmit}
              onCancel={handleSurveyCancel}
            />
          </div>
        </div>
      )}

      {phase === "results" && roundResults && (
        <ResultsPopup
          roundResults={roundResults}
          onClose={handleResultsClose}
          roomType={roomType}
          playerIndex={playerIndex}
          roundNumber={roundNumber}
          TOTAL_ROUNDS={TOTAL_ROUNDS}
        />
      )}
      {connectionStatus === "error" && (
        <div className="ws-error-box">
          <p>⚠️ Lost connection to server.</p>
          <button
            onClick={() => window.location.reload()}
          >
            Reconnect
          </button>
        </div>
      )}

      {phase === "finished" && !showSurvey && showGameOverPopup && (
        <>
          <div className="pgg-results-overlay" />
          <div className="pgg-results-popup-card" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2rem',
            padding: '3rem',
            position: 'fixed',
            top: '5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000
          }}>
            <button
              onClick={() => setShowGameOverPopup(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'white',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
              <X size={20} />
            </button>
            <h2 style={{ fontSize: '2.5rem', margin: 0 }}>Game Over</h2>

            <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.7)', textAlign: 'center', maxWidth: '400px', margin: '0' }}>
              {gameEndedReason}
            </p>

            <div className="pgg-final-summary-card" style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '1rem',
              padding: '1.5rem',
              width: '100%',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <h3 style={{ marginTop: 0, marginBottom: '1rem', textAlign: 'center', fontSize: '1.1rem', color: '#818CF8' }}>Final Match Tally</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {[1, 2, 3, 4].map(pIdx => {
                  const totalPayoff = history.reduce((sum, round) => sum + (round.players[pIdx - 1].payoff || 0), 0);
                  const isMe = pIdx === playerIndex;
                  return (
                    <div key={pIdx} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.5rem',
                      background: isMe ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                      borderRadius: '0.5rem',
                      border: isMe ? '1px solid #6366F1' : '1px solid transparent'
                    }}>
                      <span style={{ fontWeight: isMe ? 'bold' : 'normal' }}>{isMe ? 'YOU' : `Player ${pIdx}`}</span>
                      <span style={{ fontWeight: 'bold', color: '#10B981' }}>{totalPayoff.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {!surveySubmitted && (
              <button
                className="survey-button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowSurvey(true);
                }}
                style={{
                  background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                  color: 'white',
                  padding: '1.2rem 2rem',
                  borderRadius: '1rem',
                  border: 'none',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  cursor: 'pointer',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ background: 'rgba(0,0,0,0.1)', padding: '0.4rem', borderRadius: '0.5rem' }}>
                  <MessageSquare size={24} />
                </div>
                <span>PLEASE COMPLETE SURVEY - We'd appreciate your feedback!</span>
              </button>
            )}

            <button
              onClick={() => {
                const exitPath = experimentId ? `/experiments/${experimentId}/home` : "/public-goods";
                navigate(exitPath);
              }}
              style={{
                padding: "1rem 2rem",
                borderRadius: "1rem",
                border: "none",
                background: "#6366F1",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
                transition: 'all 0.2s',
                opacity: 0.9
              }}
              onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
              onMouseOut={(e) => e.currentTarget.style.opacity = '0.9'}
            >
              {experimentId ? "Back to Laboratory" : "Back to Menu"}
            </button>
          </div>
        </>
      )}

    </div>
  )
}