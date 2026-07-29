import { memo, useState, useEffect, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Clock, Loader2, MessageSquare, X } from "lucide-react"
import "./GamePage.css"

import fishingRodImg from "../assets/fishing-rod.png"
import playerImg from "../assets/blue.png"
import redPlayerImg from "../assets/red.png"
import { getPlayerFingerprint } from "../services/gameApi"
import PayoffsTable from "./PayoffsTable"
import { useWebSocketCPR } from "../hooks/useWebSocketCPR"
import SurveyForm from "../components/SurveyForm"


const MAX_FISH_STOCK = 100
const FISH_COUNT = 100
const FISH_LAYOUT_COUNT = Math.max(100, FISH_COUNT, MAX_FISH_STOCK)


const seededRandom = (seed) => {
  const value = Math.sin(seed * 127.1) * 43758.5453123
  return value - Math.floor(value)
}



const LivingFishPool = memo(({ targetStock, pendingExtraction, phase, maxExtraction, fishCount, maxFishStock, layoutCount }) => {
  const [displayedFishStock, setDisplayedFishStock] = useState(targetStock)

  useEffect(() => {
    const target = Math.max(0, Math.min(maxFishStock, Math.round(targetStock)))

    const timer = setInterval(() => {
      setDisplayedFishStock((current) => {
        if (current === target) {
          clearInterval(timer)
          return current
        }

        const direction = target > current ? 1 : -1
        const distance = Math.abs(target - current)
        const step = Math.max(1, Math.ceil(distance / 18))
        const next = current + direction * step

        if ((direction > 0 && next >= target) || (direction < 0 && next <= target)) {
          clearInterval(timer)
          return target
        }

        return next
      })
    }, 70)

    return () => clearInterval(timer)
  }, [targetStock, maxFishStock])

  const fish = useMemo(
    () => {
      const gridColumns = Math.max(1, Math.ceil(Math.sqrt(layoutCount)))
      const gridRows = Math.max(1, Math.ceil(layoutCount / gridColumns))

      const fishItems = Array.from({ length: layoutCount }, (_, index) => {
        const depth = seededRandom(index + 11)
        const row = Math.floor(index / gridColumns)
        const column = index % gridColumns
        const yJitter = (seededRandom(index + 37) - 0.5) * 4
        const xJitter = (seededRandom(index + 43) - 0.5) * 0.32
        const yBase = gridRows === 1 ? 50 : 11 + row * (64 / (gridRows - 1))
        const y = Math.max(11, Math.min(75, yBase + yJitter))
        const verticalRatio = Math.abs(y - 50) / 48
        const laneHalfWidth = Math.sqrt(Math.max(0.1, 1 - verticalRatio * verticalRatio)) * 47
        const leftInset = 3.4 + depth * 1.5
        const rightInset = 7.2 + depth * 2.2
        const laneStart = 50 - laneHalfWidth + leftInset
        const laneEnd = 50 + laneHalfWidth - rightInset
        const laneWidth = Math.max(10, laneEnd - laneStart)
        const rowSpread = ((row % 5) - 2) * 0.014
        const xProgress = Math.max(0.04, Math.min(0.935, (column + 0.48 + xJitter) / gridColumns + rowSpread - 0.012))
        const x = laneStart + laneWidth * xProgress
        const edgeDistance = Math.max(0, Math.min(x - laneStart, laneEnd - x))
        const targetSwimRange = Math.min(edgeDistance * 0.58, laneWidth * (0.06 + seededRandom(index + 41) * 0.065))
        const swimRange = Math.max(Math.min(1.8, edgeDistance * 0.5), targetSwimRange)
        const expandedSwimRange = Math.max(swimRange, Math.min(edgeDistance * 0.82, laneWidth * (0.11 + seededRandom(index + 79) * 0.08)))
        const verticalClearance = Math.max(1, Math.min((y - 11) * 1.45, (77 - y) * 1.45))
        const driftLimit = Math.min(8, Math.max(2, (1 - verticalRatio) * 12), verticalClearance)

        return {
          id: index,
          x,
          y,
          swimRange,
          expandedSwimRange,
          drift: (seededRandom(index + 59) - 0.5) * driftLimit,
          duration: 8 + seededRandom(index + 61) * 13,
          delay: -seededRandom(index + 67) * 18,
          scale: 0.52 + depth * 0.5,
          opacity: 0.76 + depth * 0.22,
          blur: depth < 0.12 ? 0.25 : 0,
          hueStart: 178 + seededRandom(index + 71) * 42,
          hueEnd: 198 + seededRandom(index + 73) * 42,
        }
      })

      fishItems
        .slice()
        .sort((firstFish, secondFish) => seededRandom(firstFish.id + 211) - seededRandom(secondFish.id + 211))
        .forEach((item, visibilityRank) => {
          item.visibilityRank = visibilityRank
        })

      return fishItems
    },
    [layoutCount]
  )

  const bubbles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => ({
        id: index,
        left: 8 + seededRandom(index + 101) * 84,
        size: 3 + seededRandom(index + 103) * 8,
        duration: 5 + seededRandom(index + 107) * 6,
        delay: -seededRandom(index + 109) * 8,
      })),
    []
  )

  const visibleStock = Math.max(0, Math.min(fishCount, maxFishStock, Math.round(displayedFishStock)))
  const visibleCapacity = Math.max(1, maxFishStock)
  const freedom = 1 - visibleStock / visibleCapacity
  const swimActivity = 1 + freedom * 0.9
  const driftActivity = 1 + freedom * 0.65
  const speedActivity = 1 - freedom * 0.22
  const pressure = phase === "contribution" ? Math.min(1, Math.max(0, pendingExtraction) / Math.max(1, maxExtraction)) : 0
  const stockRatio = visibleStock / Math.max(1, maxFishStock)
  const healthClass =
    stockRatio > 0.7 ? "cpr-fish-pool-healthy" : stockRatio > 0.35 ? "cpr-fish-pool-stressed" : "cpr-fish-pool-low"
  const visibleFish = useMemo(() => {
    const activityBlend = (swimActivity - 1) / 0.9

    return fish
      .filter((item) => item.visibilityRank < visibleStock)
      .map((item) => {
        const activeSwimRange = item.swimRange + (item.expandedSwimRange - item.swimRange) * activityBlend

        return {
          ...item,
          activeSwimPixels: Math.round(activeSwimRange * 3),
          activeDrift: item.drift * driftActivity,
          activeDuration: item.duration * speedActivity,
        }
      })
  }, [fish, visibleStock, swimActivity, driftActivity, speedActivity])

  return (
    <div className="cpr-living-fish-pool-shell">
      <div
        className={`cpr-living-fish-pool ${healthClass} ${pressure > 0 ? "cpr-pool-harvesting" : ""}`}
        role="img"
        aria-label={`Common pool fish stock: ${visibleStock} of ${maxFishStock}`}
        style={{ "--harvest-pressure": pressure }}
      >
      <div className="cpr-water-bed" />
      <div className="cpr-water-surface" />
      <div className="cpr-water-shimmer" />
      <div className="cpr-bubble-field" aria-hidden="true">
        {bubbles.map((bubble) => (
          <span
            key={bubble.id}
            className="cpr-bubble"
            style={{
              left: `${bubble.left}%`,
              width: `${bubble.size}px`,
              height: `${bubble.size}px`,
              animationDuration: `${bubble.duration}s`,
              animationDelay: `${bubble.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="cpr-fish-field" aria-hidden="true">
        {visibleFish.map((item) => (
          <span
            key={item.id}
            className="cpr-fish cpr-fish-visible"
            style={{
              "--fish-x": `${item.x}%`,
              "--fish-y": `${item.y}%`,
              "--fish-swim-start": `-${item.activeSwimPixels}px`,
              "--fish-swim-end": `${item.activeSwimPixels}px`,
              "--fish-drift": `${item.activeDrift}px`,
              "--fish-duration": `${item.activeDuration}s`,
              "--fish-delay": `${item.delay}s`,
              "--fish-scale": item.scale,
              "--fish-opacity": item.opacity,
              "--fish-blur": `${item.blur}px`,
              "--fish-hue-start": item.hueStart,
              "--fish-hue-end": item.hueEnd,
              zIndex: Math.round(item.scale * 10),
            }}
          >
            <span className="cpr-fish-body" />
          </span>
        ))}
      </div>
      </div>
      <div className="cpr-fish-stock-meter">
        <span>{visibleStock}</span>
        <small className="cpr-fish-stock-meter-label">/{maxFishStock} fish</small>
      </div>
    </div>
  )
})

const ResultsPopup = ({ roundResults, onClose, roomType, playerIndex, roundNumber, TOTAL_ROUNDS, gameOver }) => {
  const isBasic = roomType === "basic" || !roomType;
  const isFinalized = isBasic || (roundResults && roundResults.stage2Actions);

  return (
    <>
      <div className="cpr-results-overlay" onClick={onClose}></div>
      <div className="cpr-results-popup-card">
        <h2>Round {roundResults.round} Results</h2>
        {roundResults.players.map((p, i) => {
          const pIdx = i + 1;
          const isMe = pIdx === playerIndex;

          return (
            <div key={i} className="cpr-result-row-container">
              <div className="cpr-result-row">
                <span style={{ fontWeight: isMe ? "bold" : "normal", color: isMe ? "#818CF8" : "inherit" }}>
                  {isMe ? "You" : `Player ${pIdx}`}
                </span>
                <span>Extracted: {p.contribution ?? 0}</span>
                <span>Payoff: {(p.payoff ?? 0).toFixed(2)}</span>
              </div>

              {roundResults.stage2Actions && (
                <div className="cpr-action-details">
                  {roundResults.stage2Actions.filter(a => a.target === pIdx && (a.actor === playerIndex || a.target === playerIndex)).map((a, idx) => (
                    <div key={`rx-${idx}`} className="cpr-action-tag cpr-incoming">
                      {a.actor === playerIndex ? "You" : `P${a.actor}`} {a.type.toUpperCase()}ED {isMe ? "you" : `P${pIdx}`}
                    </div>
                  ))}
                  {roundResults.stage2Actions.filter(a => a.actor === pIdx && (a.actor === playerIndex || a.target === playerIndex)).map((a, idx) => (
                    <div key={`tx-${idx}`} className="cpr-action-tag cpr-outgoing">
                      {isMe ? "You" : `P${pIdx}`} {a.type.toUpperCase()}ED {a.target === playerIndex ? "you" : `P${a.target}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div className="cpr-result-summary">
          Total Extracted: {roundResults.total ?? 0} | Group Return: {(roundResults.groupReturn ?? 0).toFixed(2)}
        </div>
        <button
          type="button"
          className="cpr-results-close-btn"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onClose()
          }}
        >
          {isFinalized ? ((gameOver || roundNumber >= TOTAL_ROUNDS) ? "Finish Game" : "Next Round") : "Continue"}
        </button>
      </div>
    </>
  );
}

export default function CommonPoolResourceGamePage() {
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
    fishStock: wsFishStock,
    error,
    disconnect
  } = useWebSocketCPR(matchId, playerFingerprint)

  // Use dynamic parameters from the laboratory
  const maxFishStock = gameParams?.maxFishStock || 100
  const fishCount = gameParams?.initialFishStock || 100
  const layoutCount = Math.max(100, fishCount, maxFishStock)
  const MAX_EXTRACTION = gameParams?.maxExtraction || 10;
  const TOTAL_ROUNDS = gameParams?.totalRounds || 2;
  const ROUND_TIME = 30; // Standard phase time
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
  const [gameOver, setGameOver] = useState(false)
  const [roundNumber, setRoundNumber] = useState(1)
  const [history, setHistory] = useState([])
  const [gameEndedReason, setGameEndedReason] = useState(null)
  const contributionSubmitted = useRef(false)
  const [showSurvey, setShowSurvey] = useState(false)
  const [surveySubmitted, setSurveySubmitted] = useState(false)
  const [showGameOverPopup, setShowGameOverPopup] = useState(true)
  const [fishStock, setFishStock] = useState(maxFishStock)

  useEffect(() => {
    if (wsFishStock !== undefined && wsFishStock !== null) {
      setFishStock(wsFishStock)
    }
  }, [wsFishStock])

  useEffect(() => {
    setFishStock(maxFishStock)
  }, [matchId, maxFishStock])





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

          if (data.next_fish_stock !== undefined && data.next_fish_stock !== null) {
            setFishStock(data.next_fish_stock)
          }

          const updatedPlayers = Array.from({ length: 4 }, (_, i) => {
            const pIdx = i + 1;
            const key = `player_${pIdx}`;
            const isYou = pIdx === playerIndex;
            const fingerprint = isYou ? playerFingerprint : key;
            return {
              id: pIdx,
              fingerprint: fingerprint,
              contribution: data.contributions[key] || 0,
              actualCatch: data.actual_catches?.[key] || 0,
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
            fishStock: data.fish_stock,
            nextFishStock: data.next_fish_stock,
            newFishBorn: data.new_fish_born,
            game_over: data.game_over || false
          };

          setGameOver(data.game_over || false);
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
              actualCatch: data.actual_catches?.[key] ?? (roundResults?.players?.[i]?.actualCatch || 0),
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
            fishStock: data.fish_stock,
            nextFishStock: data.next_fish_stock,
            newFishBorn: data.new_fish_born,
            stage2Actions: data.actions,
            game_over: data.game_over || false
          };

          setGameOver(data.game_over || false);
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
  }, [socket, playerIndex, maxFishStock]);



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
    if (gameOver || roundNumber >= TOTAL_ROUNDS) {
      setGameEndedReason(gameOver ? "Game finished! The fish stock has dropped to 0." : "Game finished! All rounds completed.")
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
    <div className="cpr-game-page">
      <div className="cpr-game-container">
        {!isReady && phase !== "finished" && (
          <div className="cpr-connection-blocker">
            <div className="cpr-connection-blocker__card">
              <div className="cpr-connection-blocker__spinner" />
              <div className="cpr-connection-blocker__title">
                {connectionStatus === "connecting" && "🔌 Connecting to game…"}
                {connectionStatus === "disconnected" && "⚠️ Disconnected from server"}
                {connectionStatus === "error" && `❌ ${error || "Connection error"}`}
              </div>
            </div>
          </div>
        )}
        {isReady && phase === "lobby" && (
          <div className="cpr-countdown-overlay">
            <div className="cpr-countdown-number" style={{ fontSize: "2rem" }}>
              {connectedPlayers.length}/4
            </div>
            <div className="cpr-countdown-text">Waiting for all players to connect WebSocket…</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.8rem", marginTop: "1rem" }}>
              {connectedPlayers.map((fp, i) => fp === playerFingerprint ? "You" : `Player ${i + 1}`).join(", ")}
            </div>
          </div>
        )}

        {isReady && phase === "countdown" && (
          <div className="cpr-countdown-overlay">
            <div className="cpr-countdown-number">{countdown}</div>
            <div className="cpr-countdown-text">Get ready…</div>
          </div>
        )}

        <div className="cpr-game-header">
          <h1 className="cpr-game-title cpr-simultaneous">Common-pool Resource Game</h1>
          <p className="cpr-game-subtitle">
            {phase === "finished" ? "Game Finished" : `Round ${roundNumber}`}
          </p>
          <p className="cpr-match-id">Match ID: {matchId}</p>
          <p className="cpr-player-id">
            You are: {playerIndex ? `Player ${playerIndex}` : "Connecting..."}
          </p>
          <button
            className="cpr-leave-game-btn"
            onClick={() => {
              if (mode === "online" && socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                  action: "terminate",
                  reason: `Player ${playerIndex} left the game.`
                }));
              }
              disconnect();
              const exitPath = experimentId ? `/experiments/${experimentId}/home` : "/common-pool";
              navigate(exitPath);
            }}
          >
            Leave Game
          </button>
        </div>

        {isReady && phase !== "finished" && (
          <div className="cpr-game-board">
            <div className="cpr-game-cardd">
              <div className="cpr-game-cardd-header">
                <div className="cpr-timer">
                  <Clock className="cpr-timer-icon" />
                  <span>{timeLeft}s</span>
                </div>
                <h2 className="cpr-phase-title">
                  {phase === "contribution"
                    ? "YOUR TURN TO EXTRACT"
                    : phase === "waiting"
                      ? "Waiting for other players to extract..."
                      : phase === "stage2"
                        ? `STAGE 2: ${rawType.toUpperCase()}`
                        : "RESULTS"}
                </h2>
              </div>

              <div className="cpr-game-cardd-content">
                <div className="cpr-instructions-compact">
                  {phase === "stage2" ? (
                    <p><strong>You can choose to reward or punish other players. Rewarding adds to their payoff, while punishing reduces it.</strong></p>
                  ) : (
                    <p><strong>Decide how many units you want to extract from the common pool. Over-extraction might lead to lower total yields for everyone.</strong></p>
                  )}
                </div>

                <div className="cpr-common-pool-table-area">
                  <LivingFishPool
                    key={`${fishCount}-${maxFishStock}-${layoutCount}`}
                    targetStock={fishStock}
                    pendingExtraction={currentContribution}
                    phase={phase}
                    maxExtraction={MAX_EXTRACTION}
                    fishCount={fishCount}
                    maxFishStock={maxFishStock}
                    layoutCount={layoutCount}
                  />
                  {players.map((p, i) => {
                    const pos = ["top-left", "top-right", "bottom-left", "bottom-right"][i];
                    return (
                      <div key={i}>
                        <img src={p.img}
                          alt=""
                          className={`cpr-player cpr-player-${pos}`} />
                        
                        {/* Fishing Rod */}
                        <img 
                          src={fishingRodImg} 
                          alt="" 
                          className={`cpr-fishing-rod cpr-fishing-rod-${pos}`}
                        />

                        <span className={`cpr-pgg-player-label cpr-label-${pos}`}>
                          {p.label || (p.fingerprint === playerFingerprint ? "You" : p.fingerprint)}
                        </span>

                        {phase === "stage2" && p.fingerprint !== playerFingerprint && (
                          <div className={`cpr-stage2-btn-group cpr-btn-group-${pos}`}>
                            {isRewardRoom && (
                              <button
                                className="cpr-stage2-btn cpr-reward-btn"
                                onClick={() => handleStage2Action(p.id, "reward")}
                                disabled={stage2ActionDone}
                              >
                                REWARD
                              </button>
                            )}
                            {isPunishRoom && (
                              <button
                                className="cpr-stage2-btn cpr-punish-btn"
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
                  <div className="cpr-horizontal-contribution-area">
                    <div className="cpr-coin-stack cpr-contribution-stack">
                      <div
                        className="cpr-coin-stack-visual"
                        style={{ width: `${(currentContribution / MAX_EXTRACTION) * 300 + 30}px` }}
                      >
                        <div className="cpr-coin-amount">{currentContribution}</div>
                      </div>
                      <div className="cpr-stack-label">YOU EXTRACT</div>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max={MAX_EXTRACTION}
                      value={currentContribution}
                      onChange={handleSliderChange}
                      className="cpr-horizontal-slider"
                    />

                    <button className="cpr-submit-button-visual" onClick={handleSubmit}>
                      SUBMIT
                    </button>
                  </div>
                )}
                {phase === "waiting" && (
                  <div className="cpr-waiting-section">
                    <div className="cpr-waiting-animation">
                      <Loader2 className="cpr-waiting-spinner" />
                      <p className="cpr-waiting-text">Waiting for other players to extract...</p>
                    </div>
                  </div>
                )}
                {phase === "stage2" && (
                  <button
                    className="cpr-skip-stage-btn"
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
          <div className="cpr-payoffs-area">
            <PayoffsTable history={history} playerIndex={playerIndex} />
          </div>
        )}
      </div>

      {showSurvey && (
        <div
          className="cpr-survey-modal-overlay"
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
            className="cpr-survey-modal-content"
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
              gameType="common-pool"
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
          gameOver={gameOver}
        />
      )}
      {connectionStatus === "error" && phase !== "finished" && (
        <div className="cpr-ws-error-box">
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
          <div className="cpr-results-overlay" />
          <div className="cpr-results-popup-card" style={{
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

            <div className="cpr-final-summary-card" style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '1rem',
              padding: '1.5rem',
              width: '100%',
              border: '1px solid rgba(255, 255, 255, 0.1)'
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
                className="cpr-survey-button"
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
                const exitPath = experimentId ? `/experiments/${experimentId}/home` : "/common-pool";
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
