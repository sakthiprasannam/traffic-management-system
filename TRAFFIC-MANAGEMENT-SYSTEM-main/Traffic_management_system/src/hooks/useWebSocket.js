import { useEffect, useRef, useState, useCallback } from 'react';

const getWsBase = () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    const cleanUrl = apiUrl.replace(/\/+$/, '');
    return cleanUrl.replace(/^http/, 'ws');
  }
  return 'ws://localhost:8000';
};

const WS_BASE = getWsBase();

export const useWebSocket = (path, onMessage) => {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const reconnectTimer = useRef(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    try {
      const token = localStorage.getItem('traffic_token');
      const url = `${WS_BASE}${path}${token ? `?token=${token}` : ''}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (mountedRef.current) {
          setConnected(true);
          setError(null);
        }
      };

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (mountedRef.current && onMessage) onMessage(data);
        } catch (e) {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        if (mountedRef.current) setError('Connection error');
      };

      ws.onclose = () => {
        if (mountedRef.current) {
          setConnected(false);
          reconnectTimer.current = setTimeout(connect, 3000);
        }
      };
    } catch (e) {
      setError(e.message);
    }
  }, [path]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { connected, error, send };
};

export const useTrafficWebSocket = () => {
  const [trafficData, setTrafficData] = useState({
    cameras: {},
    alerts: [],
    stats: {
      total_vehicles: 0,
      active_cameras: 0,
      alerts_today: 0,
      avg_density: 'Low',
    },
  });

  const handleMessage = useCallback((data) => {
    setTrafficData(prev => ({
      ...prev,
      ...data,
      cameras: { ...prev.cameras, ...(data.cameras || {}) },
      alerts: data.alerts || prev.alerts,
      stats: { ...prev.stats, ...(data.stats || {}) },
    }));
  }, []);

  const { connected, error } = useWebSocket('/ws/traffic', handleMessage);
  return { trafficData, connected, error };
};
