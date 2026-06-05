import { useState, useEffect, useRef, useCallback } from "react";
import redPlayerImg from "../assets/red.png";
import playerImg from "../assets/blue.png";

const WS_BASE_URL =
  window.location.protocol === "https:"
    ? `wss://${window.location.hostname}`
    : `ws://${window.location.hostname}`;

export const useWebSocketCPR = (matchId, playerFingerprint) => {
  const [socket, setSocket] = useState(null);
  const [playerIndex, setPlayerIndex] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [error, setError] = useState(null);
  const [players, setPlayers] = useState([]);
  const [roomType, setRoomType] = useState("basic");
  const [roundNumber, setRoundNumber] = useState(1);
  const [fishStock, setFishStock] = useState(100);
  const [nextFishStock, setNextFishStock] = useState(100);
  const [newFishBorn, setNewFishBorn] = useState(0);
  const [actualCatches, setActualCatches] = useState({});
  const [latestResults, setLatestResults] = useState(null);
  const [matchTerminated, setMatchTerminated] = useState(false);
  const [terminationReason, setTerminationReason] = useState(null);

  const [params, setParams] = useState({
    totalRounds: 20,
    initialFishStock: 100,
    maxFishStock: 100,
    maxExtraction: 10,
  });

  const connectionRef = useRef(null);
  const didConnect = useRef(false);

  // ----- CONNECT -----
  const connect = useCallback(() => {
    if (!matchId || !playerFingerprint) return;
    if (connectionRef.current === "connecting" || connectionRef.current === "connected") return;

    const wsUrl = `${WS_BASE_URL}/ws/common-pool/${matchId}/`;
    connectionRef.current = "connecting";
    setConnectionStatus("connecting");

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      connectionRef.current = "connected";
      setConnectionStatus("connected");
      setError(null);

      // Send join message
      ws.send(JSON.stringify({
        action: "join",
        player_fingerprint: playerFingerprint,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("📥 [CPR WS] Received message:", data);

        // JOINED (self details)
        if (data.type === "joined") {
          setPlayerIndex(data.player_index);
          setRoomType(data.room_type || "basic");
          
          if (data.total_rounds) {
            setParams({
              totalRounds: data.total_rounds,
              initialFishStock: data.initial_fish_stock,
              maxFishStock: data.max_fish_stock,
              maxExtraction: data.max_extraction,
            });
          }

          const mappedPlayers = (data.all_players || []).map((fp, i) => {
            const pIdx = i + 1;
            const isMe = fp === playerFingerprint;
            return {
              id: pIdx,
              fingerprint: fp,
              contribution: 0,
              payoff: 0,
              img: isMe ? redPlayerImg : playerImg,
              label: isMe ? "You" : `Player ${pIdx}`
            };
          });
          setPlayers(mappedPlayers);
        }

        // PLAYER CONNECTED (broadcast when another player joins)
        if (data.type === "player_connected") {
          setPlayers((prevPlayers) => {
            const exists = prevPlayers.some((p) => p.fingerprint === data.fingerprint);
            if (exists) return prevPlayers;

            const newPlayers = [...prevPlayers];
            const pIdx = data.player_index;
            const isMe = data.fingerprint === playerFingerprint;
            
            // Put it at the correct index (pIdx - 1)
            newPlayers[pIdx - 1] = {
              id: pIdx,
              fingerprint: data.fingerprint,
              contribution: 0,
              payoff: 0,
              img: isMe ? redPlayerImg : playerImg,
              label: isMe ? "You" : `Player ${pIdx}`
            };
            return newPlayers.filter(Boolean); // clear empty items
          });
        }

        // ROUND RESULTS
        if (data.type === "round_results") {
          setRoundNumber(data.round + 1); // move to next round on client
          setFishStock(data.next_fish_stock);
          setNextFishStock(data.next_fish_stock);
          setNewFishBorn(data.new_fish_born);
          setActualCatches(data.actual_catches || {});
          setLatestResults(data);

          // Update player list with round payoffs/contributions
          setPlayers((prevPlayers) => {
            return prevPlayers.map((p) => {
              const key = `player_${p.id}`;
              return {
                ...p,
                contribution: data.contributions[key] !== undefined ? data.contributions[key] : p.contribution,
                payoff: data.payoffs[key] !== undefined ? data.payoffs[key] : p.payoff,
              };
            });
          });
        }

        // STAGE 2 RESULTS (for mixed/punishment/reward stages if active)
        if (data.type === "stage2_results") {
          setLatestResults(data);
          setPlayers((prevPlayers) => {
            return prevPlayers.map((p) => {
              const key = `player_${p.id}`;
              return {
                ...p,
                payoff: data.payoffs[key] !== undefined ? data.payoffs[key] : p.payoff,
              };
            });
          });
        }

        // TERMINATED
        if (data.type === "terminated") {
          setMatchTerminated(true);
          setTerminationReason(data.reason);
          setError(`Match ended: ${data.reason}`);
        }

        // ERROR
        if (data.type === "error") {
          setError(data.message);
        }
      } catch (err) {
        console.error("CPR WS parse error:", err);
      }
    };

    ws.onclose = (event) => {
      console.warn("⚡ CPR WS CLOSED", event);
      connectionRef.current = "disconnected";
      setSocket(null);

      if (event.code === 4000) {
        console.log("🟢 Normal CPR client disconnect");
        setConnectionStatus("disconnected");
      } else {
        console.error("❌ Unexpected CPR WS close", event);
        setConnectionStatus("error");
        setError(`WebSocket closed unexpectedly (code ${event.code})`);
      }
    };

    ws.onerror = (err) => {
      console.error("⚠️ CPR WS ERROR", err);
      setError("WebSocket connection error");
      setConnectionStatus("error");
    };

    setSocket(ws);
  }, [matchId, playerFingerprint]);

  // ----- DISCONNECT -----
  const disconnect = useCallback(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close(4000, "Client disconnected");
    }
    setSocket(null);
    setConnectionStatus("disconnected");
    connectionRef.current = "disconnected";
  }, [socket]);

  // ----- AUTO CONNECT -----
  useEffect(() => {
    if (!didConnect.current) {
      connect();
      didConnect.current = true;
    }
  }, [connect]);

  return {
    socket,
    playerIndex,
    connectionStatus,
    error,
    players,
    roomType,
    roundNumber,
    fishStock,
    nextFishStock,
    newFishBorn,
    actualCatches,
    latestResults,
    matchTerminated,
    terminationReason,
    gameParams: params,
    connect,
    disconnect,
  };
};
