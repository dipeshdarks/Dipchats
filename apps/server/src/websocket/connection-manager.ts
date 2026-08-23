import { WebSocket } from 'ws';
import { WSFrame } from './protocol';

export interface ConnectedSocket {
  id: string;
  ws: WebSocket;
  userId?: string;
  displayName?: string;
  isAlive: boolean;
  subscribedChannels: Set<string>;
  connectedAt: Date;
}

export class ConnectionManager {
  private sockets = new Map<string, ConnectedSocket>();
  private userSockets = new Map<string, Set<ConnectedSocket>>();
  private channelSubscriptions = new Map<string, Set<ConnectedSocket>>();

  register(socketId: string, ws: WebSocket): ConnectedSocket {
    const conn: ConnectedSocket = {
      id: socketId,
      ws,
      isAlive: true,
      subscribedChannels: new Set(),
      connectedAt: new Date()
    };
    this.sockets.set(socketId, conn);
    return conn;
  }

  authenticateUser(conn: ConnectedSocket, userId: string, displayName: string) {
    conn.userId = userId;
    conn.displayName = displayName;

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(conn);
  }

  subscribeChannel(conn: ConnectedSocket, channelId: string) {
    conn.subscribedChannels.add(channelId);

    if (!this.channelSubscriptions.has(channelId)) {
      this.channelSubscriptions.set(channelId, new Set());
    }
    this.channelSubscriptions.get(channelId)!.add(conn);
  }

  unsubscribeChannel(conn: ConnectedSocket, channelId: string) {
    conn.subscribedChannels.delete(channelId);
    const channelSet = this.channelSubscriptions.get(channelId);
    if (channelSet) {
      channelSet.delete(conn);
      if (channelSet.size === 0) {
        this.channelSubscriptions.delete(channelId);
      }
    }
  }

  unregister(socketId: string): ConnectedSocket | null {
    const conn = this.sockets.get(socketId);
    if (!conn) return null;

    // Unregister from user map
    if (conn.userId) {
      const userSet = this.userSockets.get(conn.userId);
      if (userSet) {
        userSet.delete(conn);
        if (userSet.size === 0) {
          this.userSockets.delete(conn.userId);
        }
      }
    }

    // Unregister from channels
    for (const channelId of conn.subscribedChannels) {
      const channelSet = this.channelSubscriptions.get(channelId);
      if (channelSet) {
        channelSet.delete(conn);
        if (channelSet.size === 0) {
          this.channelSubscriptions.delete(channelId);
        }
      }
    }

    this.sockets.delete(socketId);
    return conn;
  }

  sendToSocket(conn: ConnectedSocket, frame: WSFrame) {
    try {
      if (conn.ws && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(JSON.stringify(frame));
      }
    } catch {}
  }

  broadcastToChannel(channelId: string, frame: WSFrame, excludeSocketId?: string) {
    const data = JSON.stringify(frame);
    const subscribers = this.channelSubscriptions.get(channelId);

    if (subscribers) {
      for (const conn of subscribers) {
        try {
          if (conn.id !== excludeSocketId && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
            conn.ws.send(data);
          }
        } catch {}
      }
    } else {
      // Fallback: broadcast to all connected sockets if channel sub is missing
      for (const conn of this.sockets.values()) {
        try {
          if (conn.id !== excludeSocketId && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
            conn.ws.send(data);
          }
        } catch {}
      }
    }
  }

  broadcastGlobal(frame: WSFrame, excludeSocketId?: string) {
    const data = JSON.stringify(frame);
    for (const conn of this.sockets.values()) {
      try {
        if (conn.id !== excludeSocketId && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.send(data);
        }
      } catch {}
    }
  }

  getConnectedCount(): number {
    return this.sockets.size;
  }

  getAllSockets(): ConnectedSocket[] {
    return Array.from(this.sockets.values());
  }
}

export const connectionManager = new ConnectionManager();
