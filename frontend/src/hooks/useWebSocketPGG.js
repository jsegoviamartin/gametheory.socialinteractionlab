import { useState, useEffect, useRef, useCallback } from "react";
import redPlayerImg from "../assets/red.png";
import playerImg from "../assets/blue.png";

const WS_BASE_URL =
  window.location.protocol === "https:"
    ? `wss://${window.location.hostname}`
    : `ws://${window.location.hostname}`;

export const useWebSocketPGG = (matchId, playerFingerprint) => {
  const [socket, setSocket] = useState(null);
  const [playerIndex, setPlayerIndex] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [error, setError] = useState(null);
  const [players, setPlayers] = useState([]);
  const [roomType, setRoomType] = useState("basic");
  const [roundNumber, setRoundNumber] = useState(1);
  const [params, setParams] = useState({
    totalRounds: 25,
    endowment: 20,
    multiplier: 1.6,
    punishmentCost: 4.0,
    punishmentValue: 12.0,
    rewardCost: 4.0,
    rewardValue: 12.0
  });

  const connectionRef = useRef(null);
  const socketRef = useRef(null);
  const cleanupTimeoutRef = useRef(null);
  const terminationSentRef = useRef(false);

  // ----- CONNECT -----
  const connect = useCallback(() => {
    if (!matchId || !playerFingerprint) return;
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
      cleanupTimeoutRef.current = null;
    }
    if (connectionRef.current === "connecting" || connectionRef.current === "connected") return;

    const wsUrl = `${WS_BASE_URL}/ws/public-goods/${matchId}/`;
    connectionRef.current = "connecting";
    setConnectionStatus("connecting");

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;
    terminationSentRef.current = false;

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

        // JOINED
        if (data.type === "joined") {
          setPlayerIndex(data.player_index);
          setRoomType(data.room_type || "basic");
          
          if (data.total_rounds) {
            setParams({
              totalRounds: data.total_rounds,
              endowment: data.endowment,
              multiplier: data.multiplier,
              punishmentCost: data.punishment_cost,
              punishmentValue: data.punishment_value,
              rewardCost: data.reward_cost,
              rewardValue: data.reward_value
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

        // ROUND RESULTS
        if (data.type === "round_results") {
          setRoundNumber(data.round);

          setPlayers((prevPlayers) =>
            Object.keys(data.contributions).map((key, i) => {
              const pIdx = i + 1;
              const fp = prevPlayers[i]?.fingerprint || key;
              const isMe = fp === playerFingerprint;
              return {
                id: pIdx,
                fingerprint: fp,
                contribution: data.contributions[key],
                payoff: data.payoffs[key],
                img: isMe ? redPlayerImg : playerImg,
                label: isMe ? "You" : `Player ${pIdx}`
              };
            })
          );

        }

        // ERROR
        if (data.type === "error") {
          setError(data.message);
        }
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };

    ws.onclose = (event) => {
      console.warn("⚡ WS CLOSED", event);
      connectionRef.current = "disconnected";
      if (socketRef.current === ws) {
        socketRef.current = null;
        setSocket(null);
      }

      if (event.code === 4000 || event.code === 1000) {
        console.log("🟢 Normal client disconnect");
        setConnectionStatus("disconnected");
      } else {
        console.error("❌ Unexpected WS close", event);
        setConnectionStatus("error");
        setError(`WebSocket closed unexpectedly (code ${event.code})`);
      }
    };

    ws.onerror = (err) => {
      console.error("⚠️ WS ERROR", err);
      setError("WebSocket connection error");
      setConnectionStatus("error");
    };

    setSocket(ws);
  }, [matchId, playerFingerprint]);

  // ----- DISCONNECT -----
  const disconnect = useCallback(() => {
    const currentSocket = socketRef.current;
    if (
      currentSocket &&
      (currentSocket.readyState === WebSocket.OPEN || currentSocket.readyState === WebSocket.CONNECTING)
    ) {
      currentSocket.close(4000, "Client disconnected");
    }
    socketRef.current = null;
    setSocket(null);
    setConnectionStatus("disconnected");
    connectionRef.current = "disconnected";
  }, []);

  const terminateMatch = useCallback((reason = "A player left the game.") => {
    const currentSocket = socketRef.current;
    if (currentSocket && currentSocket.readyState === WebSocket.OPEN && !terminationSentRef.current) {
      terminationSentRef.current = true;
      currentSocket.send(JSON.stringify({
        action: "terminate",
        reason,
      }));
    }

    disconnect();
  }, [disconnect]);

  // ----- AUTO CONNECT -----
  useEffect(() => {
    connect();

    return () => {
      cleanupTimeoutRef.current = setTimeout(() => {
        terminateMatch("A player left the game.");
      }, 100);
    };
  }, [connect, terminateMatch]);

  return {
    socket,
    playerIndex,
    connectionStatus,
    error,
    players,
    roomType,
    roundNumber,
    gameParams: params,
    connect,
    disconnect,
    terminateMatch,
  };
};
