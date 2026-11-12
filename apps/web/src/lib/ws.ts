/**
 * WebSocket client for LA Chat messaging.
 *
 * Connects to /ws on the API origin, authenticates with the JWT from
 * localStorage (passed via Sec-WebSocket-Protocol subprotocol as 'jwt.<token>'),
 * and exposes a simple event-emitter API for the chat UI.
 *
 * Includes automatic reconnect with exponential backoff and a pending-message
 * queue so messages typed while offline are sent on reconnect.
 */

import {
  WsClientEvent,
  WsServerEvent,
  WsSendMessagePayload,
  WsAuthorizedPayload,
  WsErrorPayload,
  MessageDto,
} from '@la-chat/shared-types';

type ServerEventMap = {
  [WsServerEvent.MESSAGE_NEW]: { message: MessageDto; echoed?: boolean };
  [WsServerEvent.MESSAGE_EDITED]: { message: MessageDto };
  [WsServerEvent.MESSAGE_DELETED]: { id: string; deletedAt: string };
  [WsServerEvent.MESSAGE_REACTION_ADDED]: { messageId: string; emoji: string; userId: string; reactions: unknown[] };
  [WsServerEvent.MESSAGE_REACTION_REMOVED]: { messageId: string; emoji: string; userId: string; reactions: unknown[] };
  [WsServerEvent.TYPING_UPDATE]: { conversationId: string; userId: string; fullName?: string; typing: boolean };
  [WsServerEvent.READ_RECEIPT]: { conversationId: string; userId: string; lastReadMessageId: string };
  [WsServerEvent.DELIVERY_UPDATE]: { messageId: string; state: string };
  [WsServerEvent.AUTHORIZED]: WsAuthorizedPayload;
  [WsServerEvent.ERROR]: WsErrorPayload;
};

type EventHandler<T> = (data: T) => void;

export class MessagingSocket {
  private ws: WebSocket | null = null;
  private listeners = new Map<WsServerEvent, Set<EventHandler<any>>>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualClose = false;

  /** Pending messages queued while offline; sent on reconnect. */
  private pendingSends: WsSendMessagePayload[] = [];

  /** Conversations we want to join as soon as the socket is authorized. */
  private pendingJoins: Set<string> = new Set();

  private authorized = false;

  constructor(private wsUrl: string, private getToken: () => string | null) {}

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = this.getToken();
    if (!token) {
      // No token — don't bother connecting. The UI should redirect to /login.
      return;
    }

    // Pass the JWT as a WebSocket subprotocol. This is the only header a
    // browser can set on the WS handshake.
    const subprotocols = [`jwt.${token}`];
    this.manualClose = false;

    try {
      this.ws = new WebSocket(this.wsUrl, subprotocols);
    } catch (e) {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      // The server will send AUTHORIZED once it verifies the token.
    };

    this.ws.onmessage = (ev) => {
      try {
        const { event, data } = JSON.parse(ev.data as string) as { event: WsServerEvent; data: unknown };
        this.dispatch(event, data);
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = (ev) => {
      this.authorized = false;
      this.ws = null;
      if (!this.manualClose && ev.code !== 1008) {
        // 1008 = policy violation (auth failure) — don't retry
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after this; let it handle reconnect
    };
  }

  disconnect(): void {
    this.manualClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'client disconnect');
      this.ws = null;
    }
    this.authorized = false;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.authorized;
  }

  // -------------------------------------------------------------------------
  // Event subscription
  // -------------------------------------------------------------------------

  on<K extends WsServerEvent>(event: K, handler: EventHandler<ServerEventMap[K]>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  private dispatch(event: WsServerEvent, data: unknown): void {
    if (event === WsServerEvent.AUTHORIZED) {
      this.authorized = true;
      // Join any conversations that were requested before auth completed
      for (const convId of this.pendingJoins) {
        this.emit(WsClientEvent.JOIN_CONVERSATION, { conversationId: convId });
      }
      // Flush pending sends
      const queued = this.pendingSends.splice(0);
      for (const payload of queued) {
        this.emit(WsClientEvent.SEND_MESSAGE, payload);
      }
    }
    if (event === WsServerEvent.ERROR) {
      const err = data as WsErrorPayload;
      // If auth failed, stop trying to reconnect
      if (err.code === 'BAD_TOKEN' || err.code === 'NO_TOKEN' || err.code === 'INACTIVE') {
        this.manualClose = true;
      }
    }
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const h of handlers) {
        try { h(data as any); } catch { /* handler errors are isolated */ }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Client → server actions
  // -------------------------------------------------------------------------

  joinConversation(conversationId: string): void {
    if (this.isConnected) {
      this.emit(WsClientEvent.JOIN_CONVERSATION, { conversationId });
    }
    this.pendingJoins.add(conversationId);
  }

  leaveConversation(conversationId: string): void {
    if (this.isConnected) {
      this.emit(WsClientEvent.LEAVE_CONVERSATION, { conversationId });
    }
    this.pendingJoins.delete(conversationId);
  }

  sendMessage(payload: WsSendMessagePayload): void {
    if (this.isConnected) {
      this.emit(WsClientEvent.SEND_MESSAGE, payload);
    } else {
      // Queue for later — the server is idempotent on clientMessageId so
      // replaying after reconnect is safe.
      this.pendingSends.push(payload);
    }
  }

  editMessage(messageId: string, body: string): void {
    this.emit(WsClientEvent.EDIT_MESSAGE, { messageId, body });
  }

  deleteMessage(messageId: string): void {
    this.emit(WsClientEvent.DELETE_MESSAGE, { messageId });
  }

  react(messageId: string, emoji: string): void {
    this.emit(WsClientEvent.REACT, { messageId, emoji });
  }

  unreact(messageId: string, emoji: string): void {
    this.emit(WsClientEvent.UNREACT, { messageId, emoji });
  }

  typingStart(conversationId: string): void {
    this.emit(WsClientEvent.TYPING_START, { conversationId });
  }

  typingStop(conversationId: string): void {
    this.emit(WsClientEvent.TYPING_STOP, { conversationId });
  }

  markRead(conversationId: string, lastReadMessageId: string): void {
    this.emit(WsClientEvent.MARK_READ, { conversationId, lastReadMessageId });
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private emit(event: WsClientEvent, data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data }));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const backoff = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30_000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, backoff);
  }
}

// ---------------------------------------------------------------------------
// Singleton for the web app
// ---------------------------------------------------------------------------

let _socket: MessagingSocket | null = null;

export function getMessagingSocket(): MessagingSocket {
  if (!_socket) {
    const wsUrl = buildWsUrl();
    _socket = new MessagingSocket(wsUrl, () => {
      if (typeof window === 'undefined') return null;
      const raw = window.localStorage.getItem('la-chat-tokens');
      if (!raw) return null;
      try {
        return (JSON.parse(raw) as { accessToken: string }).accessToken;
      } catch {
        return null;
      }
    });
  }
  return _socket;
}

function buildWsUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:4000/ws';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // In dev, Next.js proxies /api/v1/* to the API. The WebSocket doesn't go
  // through the Next.js proxy, so we connect directly to the API origin.
  // The API origin is configured via NEXT_PUBLIC_API_WS_URL env var; default
  // to ws://localhost:4000/ws for local dev.
  const apiWs = process.env.NEXT_PUBLIC_API_WS_URL || 'ws://localhost:4000/ws';
  return apiWs;
}
