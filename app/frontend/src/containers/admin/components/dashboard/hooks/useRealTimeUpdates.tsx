import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Configuration for useRealTimeUpdates.
 * Each handler is called when the corresponding real-time event occurs.
 */
interface RealTimeConfig {
  onStatsUpdate?: () => void;
  onEmbeddingUpdate?: () => void;
  onAnalyticsUpdate?: () => void;
  onUserActivityUpdate?: () => void;
}

/**
 * useRealTimeUpdates
 *
 * Establishes a WebSocket connection to receive live dashboard updates.
 * Handles reconnection, heartbeat/ping, and triggers callback handlers on update events.
 *
 * @param accessToken  The JWT/authorization token.
 * @param enabled      If true, will connect and listen.
 * @param config       Handlers for each event type.
 *
 * @returns {
 *   isConnected: boolean,
 *   lastUpdate: Date | null,
 *   error: string | null,
 *   connect: Function to manually connect,
 *   disconnect: Function to manually disconnect
 * }
 */
export const useRealTimeUpdates = (
  accessToken: string | null,
  enabled: boolean,
  config: RealTimeConfig = {},
) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Initiates or re-establishes a WebSocket connection.
   */
  const connect = useCallback(() => {
    if (!accessToken || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      // Use WebSocket for real-time updates (adjust URL as needed)
      const wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/dashboard`;
      wsRef.current = new WebSocket(`${wsUrl}?token=${accessToken}`);

      wsRef.current.onopen = () => {
        console.log("Dashboard WebSocket connected");
        setIsConnected(true);
        setError(null);

        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastUpdate(new Date());

          // Handle different types of updates
          switch (data.type) {
            case "stats_update":
              config.onStatsUpdate?.();
              break;
            case "embedding_update":
              config.onEmbeddingUpdate?.();
              break;
            case "analytics_update":
              config.onAnalyticsUpdate?.();
              break;
            case "user_activity_update":
              config.onUserActivityUpdate?.();
              break;
            case "pong":
              // Heartbeat response
              break;
            default:
              console.log("Unknown WebSocket message type:", data.type);
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      wsRef.current.onclose = () => {
        console.log("Dashboard WebSocket disconnected");
        setIsConnected(false);

        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Attempt to reconnect if enabled
        if (enabled) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        }
      };

      wsRef.current.onerror = (err) => {
        console.error("Dashboard WebSocket error:", err);
        setError("WebSocket connection error");
      };
    } catch (err) {
      console.error("Failed to create WebSocket connection:", err);
      setError("Failed to establish real-time connection");
    }
  }, [accessToken, enabled, config]);

  /**
   * Disconnects and cleans up the WebSocket and timers.
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    setIsConnected(false);
  }, []);

  // Connect/disconnect based on enabled state
  useEffect(() => {
    if (enabled && accessToken) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, accessToken, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    lastUpdate,
    error,
    connect,
    disconnect,
  };
};
