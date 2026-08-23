import { WSFrame, WSEventType, createWSFrame } from '@dipchats/shared';

type FrameHandler = (frame: WSFrame) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private handlers = new Set<FrameHandler>();
  private isConnected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private onStateChangeCb: ((connected: boolean) => void) | null = null;
  private retryAttempt = 0;
  private retryDelays = [1000, 2000, 5000, 10000, 30000];

  public connect(token: string, onStateChange?: (connected: boolean) => void) {
    this.token = token;
    if (onStateChange) this.onStateChangeCb = onStateChange;

    let wsUrl: string;
    if (import.meta.env.VITE_WS_URL) {
      wsUrl = import.meta.env.VITE_WS_URL;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      wsUrl = `${protocol}//${host}/ws`;
    }

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.retryAttempt = 0;
      this.startHeartbeat();
      // Authenticate socket with session token
      this.send('auth.join', { token: this.token });
    };

    this.ws.onmessage = (event) => {
      try {
        const frame: WSFrame = JSON.parse(event.data);
        if (frame.type === 'auth.success') {
          this.isConnected = true;
          if (this.onStateChangeCb) this.onStateChangeCb(true);
        }
        this.notifyHandlers(frame);
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    this.ws.onclose = () => {
      console.warn('WebSocket closed, attempting reconnect...');
      this.cleanup();
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  public send<T>(type: WSEventType, payload: T, requestId?: string): string {
    const reqId = requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const frame = createWSFrame(type, payload, reqId);
      this.ws.send(JSON.stringify(frame));
    }
    return reqId;
  }

  public subscribe(handler: FrameHandler) {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  private notifyHandlers(frame: WSFrame) {
    for (const handler of this.handlers) {
      handler(frame);
    }
  }

  private startHeartbeat() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.token) {
        this.send('presence.update', { status: 'online' });
      }
    }, 25000);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = this.retryDelays[Math.min(this.retryAttempt, this.retryDelays.length - 1)]!;
    this.retryAttempt++;

    console.log(`Scheduling WS reconnect in ${delay}ms (attempt ${this.retryAttempt})`);
    this.reconnectTimer = setTimeout(() => {
      if (this.token) {
        this.connect(this.token, this.onStateChangeCb || undefined);
      }
    }, delay);
  }

  private cleanup() {
    this.isConnected = false;
    if (this.onStateChangeCb) this.onStateChangeCb(false);
    if (this.pingInterval) clearInterval(this.pingInterval);
  }

  public disconnect() {
    this.cleanup();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) this.ws.close();
  }
}

export const wsClient = new WebSocketClient();
