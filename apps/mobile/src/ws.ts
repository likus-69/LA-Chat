import { getTokens } from './storage';
import { WsClientEvent, WsServerEvent, WsSendMessagePayload, MessageDto } from '@la-chat/shared-types';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:4000/ws';

type Handler = (data: any) => void;

export class MessagingSocket {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<Handler>>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualClose = false;
  private pendingSends: WsSendMessagePayload[] = [];
  private pendingJoins: Set<string> = new Set();
  private authorized = false;

  async connect(): Promise<void> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    const tokens = await getTokens();
    if (!tokens) return;

    this.manualClose = false;
    try {
      this.ws = new WebSocket(`${WS_URL}?token=${tokens.accessToken}`);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => { this.reconnectAttempts = 0; };
    this.ws.onmessage = (ev: WebSocketMessageEvent) => {
      try {
        const { event, data } = JSON.parse(ev.data as string);
        this.dispatch(event, data);
      } catch { /* ignore */ }
    };
    this.ws.onclose = (ev: WebSocketCloseEvent) => {
      this.authorized = false;
      this.ws = null;
      if (!this.manualClose && ev.code !== 1008) this.scheduleReconnect();
    };
    this.ws.onerror = () => { /* onclose handles */ };
  }

  disconnect(): void {
    this.manualClose = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { this.ws.close(1000, 'client disconnect'); this.ws = null; }
    this.authorized = false;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.authorized;
  }

  on(event: string, handler: Handler): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  private dispatch(event: string, data: any): void {
    if (event === WsServerEvent.AUTHORIZED) {
      this.authorized = true;
      for (const convId of this.pendingJoins) this.emit(WsClientEvent.JOIN_CONVERSATION, { conversationId: convId });
      const queued = this.pendingSends.splice(0);
      for (const p of queued) this.emit(WsClientEvent.SEND_MESSAGE, p);
    }
    if (event === WsServerEvent.ERROR) {
      const err = data as { code?: string };
      if (err?.code === 'BAD_TOKEN' || err?.code === 'NO_TOKEN' || err?.code === 'INACTIVE') {
        this.manualClose = true;
      }
    }
    const handlers = this.listeners.get(event);
    if (handlers) for (const h of handlers) try { h(data); } catch { /* isolate */ }
  }

  joinConversation(conversationId: string): void {
    if (this.isConnected) this.emit(WsClientEvent.JOIN_CONVERSATION, { conversationId });
    this.pendingJoins.add(conversationId);
  }

  leaveConversation(conversationId: string): void {
    if (this.isConnected) this.emit(WsClientEvent.LEAVE_CONVERSATION, { conversationId });
    this.pendingJoins.delete(conversationId);
  }

  sendMessage(payload: WsSendMessagePayload): void {
    if (this.isConnected) this.emit(WsClientEvent.SEND_MESSAGE, payload);
    else this.pendingSends.push(payload);
  }

  markRead(conversationId: string, lastReadMessageId: string): void {
    this.emit(WsClientEvent.MARK_READ, { conversationId, lastReadMessageId });
  }

  typingStart(conversationId: string): void { this.emit(WsClientEvent.TYPING_START, { conversationId }); }
  typingStop(conversationId: string): void { this.emit(WsClientEvent.TYPING_STOP, { conversationId }); }

  private emit(event: string, data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ event, data }));
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const backoff = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30_000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; this.connect(); }, backoff);
  }
}

let _socket: MessagingSocket | null = null;
export function getSocket(): MessagingSocket {
  if (!_socket) _socket = new MessagingSocket();
  return _socket;
}
