import type { AppDispatch } from "@/lib/store";
import {
  addTask,
  updateTask,
  deleteTask,
  addComment as addCommentAction,
} from "@/lib/store/slices/tasks";

// Shapes expected from backend WS payloads
// { type: "task" | "comment", event: "created" | "updated" | "deleted", data: any }
export type WSMessage = {
  type: string;
  event: string;
  data: any;
  meta?: { [key: string]: any };
};

// Connection options
type ConnectOptions = {
  // e.g., "/api/ws" (default)
  basePath?: string;
  // heartbeat ping interval in ms
  heartbeatMs?: number;
  // maximum backoff in ms
  maxBackoffMs?: number;
};

class WebSocketService {
  private sockets: Map<string, WebSocket> = new Map();
  private reconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private backoffMap: Map<string, number> = new Map();
  private heartbeatTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private basePath: string;
  private heartbeatMs: number;
  private maxBackoffMs: number;
  private dispatch?: AppDispatch;
  private currentUserId?: number;

  constructor(options: ConnectOptions = {}) {
    this.basePath = options.basePath ?? "/api/ws";
    this.heartbeatMs = options.heartbeatMs ?? 25000; // 25s
    this.maxBackoffMs = options.maxBackoffMs ?? 10000; // 10s
  }

  // Must be called from a React component after hooks are available
  initDispatch(dispatch: AppDispatch) {
    this.dispatch = dispatch;
  }

  // Optionally set current user id to ignore self-originated events
  setCurrentUser(userId: number) {
    this.currentUserId = userId;
  }

  // Build WS URL for a given channel
  private buildUrl(channel: string) {
    const proto = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss" : "ws";
    const host = typeof window !== "undefined" ? window.location.host : "";
    return `${proto}://${host}${this.basePath}/${channel}`;
  }

  // Public API: connect to tasks channel
  connectTasks() {
    return this.connect("tasks");
  }

  // Connect to a specified channel
  connect(channel: string) {
    // Prevent duplicate connections
    if (this.sockets.get(channel)?.readyState === WebSocket.OPEN) {
      return;
    }

    const url = this.buildUrl(channel);
    const socket = new WebSocket(url);

    socket.onopen = () => {
      // Reset backoff
      this.backoffMap.set(channel, 1000);
      // Start heartbeat
      this.startHeartbeat(channel);
      // initial hello
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "info",
          message: "WebSocket connected",
          labels: { channel },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      try {
        socket.send(JSON.stringify({ type: "client", event: "hello", data: { ts: Date.now() } }));
      } catch {
        // ignore
      }
    };

    socket.onmessage = (evt) => {
      this.handleMessage(channel, evt.data);
    };

    socket.onerror = () => {
      // errors will be followed by onclose in most browsers
    };

    socket.onclose = () => {
      this.clearHeartbeat(channel);
      this.scheduleReconnect(channel);
    };

    // Save socket
    this.sockets.set(channel, socket);
  }

  disconnect(channel: string) {
    const sock = this.sockets.get(channel);
    if (sock) {
      try {
        sock.close();
      } catch {}
      this.sockets.delete(channel);
    }
    const t = this.reconnectTimers.get(channel);
    if (t) {
      clearTimeout(t);
      this.reconnectTimers.delete(channel);
    }
    this.clearHeartbeat(channel);
  }

  isConnected(channel: string) {
    return this.sockets.get(channel)?.readyState === WebSocket.OPEN;
  }

  private startHeartbeat(channel: string) {
    this.clearHeartbeat(channel);
    const sock = this.sockets.get(channel);
    if (!sock) return;
    const timer = setInterval(() => {
      if (sock.readyState === WebSocket.OPEN) {
        try {
          sock.send(JSON.stringify({ type: "ping", data: Date.now() }));
        } catch {}
      }
    }, this.heartbeatMs);
    this.heartbeatTimers.set(channel, timer);
  }

  private clearHeartbeat(channel: string) {
    const hb = this.heartbeatTimers.get(channel);
    if (hb) {
      clearInterval(hb);
      this.heartbeatTimers.delete(channel);
    }
  }

  private scheduleReconnect(channel: string) {
    // Backoff handling
    const current = this.backoffMap.get(channel) ?? 1000; // start at 1s
    const next = Math.min(current * 2, this.maxBackoffMs);
    this.backoffMap.set(channel, next);

    const timer = setTimeout(() => {
      this.connect(channel);
    }, current);

    // store timer so we can clear if needed
    this.reconnectTimers.set(channel, timer);
  }

  // Handle message and dispatch to store
  private handleMessage(_channel: string, data: any) {
    if (!this.dispatch) {
      // Not initialized yet; ignore messages
      return;
    }
    try {
      const msg: WSMessage = typeof data === "string" ? JSON.parse(data) : data;

      // Ignore events originated by this client/user to avoid duplicates
      const actorId = (msg.meta && (msg.meta.actor_id ?? msg.meta.user_id)) as number | undefined;
      if (typeof actorId === "number" && typeof this.currentUserId === "number" && actorId === this.currentUserId) {
        return;
      }

      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "info",
          message: "WebSocket message received",
          labels: { channel: _channel },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});

      if (msg.type === "task") {
        if (msg.event === "created") {
          console.log("created", msg.data);
          this.dispatch(addTask(msg.data));
        } else if (msg.event === "updated") {
          console.log("updated", msg.data);
          this.dispatch(updateTask(msg.data));
        } else if (msg.event === "deleted") {
          console.log("deleted", msg.data);
          const id = typeof msg.data === "number" ? msg.data : msg.data?.id;
          if (typeof id === "number") this.dispatch(deleteTask(id));
        }
      } else if (msg.type === "comment") {
        console.log("comment", msg.data);
        if (msg.event === "created") {
          console.log("comment created", msg.data);
          const c = msg.data;
          const taskId = c.task_id ?? c.taskId ?? c.task?.id;
          if (typeof taskId === "number") {
            console.log("comment added", taskId);
            this.dispatch(
              addCommentAction({ taskId, comment: c })
            );
          }
        }
      }
    } catch (e) {
      void fetch("/internal/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: "error",
          message: "WebSocket message parse error",
          labels: { channel: _channel },
          meta: { ts: Date.now() },
        }),
      }).catch(() => {});
      // Ignore malformed messages
      console.warn("WS message parse error", e);
    }
  }
}

const wsService = new WebSocketService();
export default wsService;
