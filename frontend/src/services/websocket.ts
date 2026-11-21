export type WebSocketMessageHandler = (data: any) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private eventId: string | null = null;
  private handlers: Set<WebSocketMessageHandler> = new Set();
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private isExplicitlyClosed = false;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 15000;

  connect(eventId: string) {
    if (this.ws && this.eventId === eventId && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.disconnect();
    this.eventId = eventId;
    this.isExplicitlyClosed = false;

    const defaultWsHost = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
    const rawWs = (import.meta as any).env?.VITE_WS_BASE_URL || defaultWsHost;
    const baseWs = String(rawWs).replace(/\/$/, '');
    const wsUrl = `${baseWs}/ws/${eventId}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        // Reset exponential backoff on successful connection
        this.reconnectDelay = 1000;
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handlers.forEach((handler) => handler(data));
        } catch {
          // ignore invalid json
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.stopHeartbeat();
        this.ws?.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('ping');
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer || this.isExplicitlyClosed || !this.eventId) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.eventId && !this.isExplicitlyClosed) {
        this.connect(this.eventId);
      }
    }, this.reconnectDelay);

    // Exponential backoff with jitter up to max limit
    this.reconnectDelay = Math.min(
      this.maxReconnectDelay,
      Math.floor(this.reconnectDelay * 1.5 + Math.random() * 500)
    );
  }

  disconnect() {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectDelay = 1000;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.eventId = null;
  }

  subscribe(handler: WebSocketMessageHandler) {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
}

export const wsClient = new WebSocketClient();
