import { useCallback, useEffect, useRef, useState } from "react";

const WS_BASE = "ws://127.0.0.1:8000/api/reminders/ws";
const RECONNECT_DELAY_MS = 5000;
const MAX_QUEUE = 20;

export function useReminderWebSocket(token) {
  const [notifications, setNotifications] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const mountedRef = useRef(true);
  const failCountRef = useRef(0);

  const push = useCallback((notification) => {
    setNotifications((prev) => [notification, ...prev].slice(0, MAX_QUEUE));
    // Soft audio alert via Web Audio API
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = notification.reminder?.priority === "high" ? 880 : 660;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } catch (_) {}
  }, []);

  const dismiss = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => setNotifications([]), []);

  const connect = useCallback(() => {
    if (!token || !mountedRef.current) return;
    // Don't open a second connection if one is already open/connecting
    const ws = wsRef.current;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    try {
      const socket = new WebSocket(`${WS_BASE}?token=${encodeURIComponent(token)}`);
      wsRef.current = socket;

      socket.onopen = () => {
        if (!mountedRef.current) { socket.close(); return; }
        failCountRef.current = 0;
        setConnected(true);
      };

      socket.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === "reminder_due") {
            push({
              id: `${data.reminder.id}-${Date.now()}`,
              reminder: data.reminder,
              receivedAt: new Date(),
            });
          }
        } catch (_) {}
      };

      socket.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        wsRef.current = null;
        // Exponential backoff capped at 30s
        failCountRef.current += 1;
        const delay = Math.min(RECONNECT_DELAY_MS * failCountRef.current, 30000);
        reconnectTimer.current = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        // onclose fires right after, handles reconnect
        socket.close();
      };
    } catch (err) {
      // WebSocket constructor can throw if URL is invalid
      console.warn("WS connect error:", err);
    }
  }, [token, push]);

  useEffect(() => {
    mountedRef.current = true;
    // Small delay so the app is fully mounted before connecting
    const t = setTimeout(connect, 500);
    return () => {
      mountedRef.current = false;
      clearTimeout(t);
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // Keepalive ping every 25s
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send("ping");
      }
    }, 25000);
    return () => clearInterval(interval);
  }, []);

  return { notifications, dismiss, dismissAll, connected };
}
