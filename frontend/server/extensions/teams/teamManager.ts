import type { ExtensionAPI } from "summit-types";
import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { MessageBus } from "./messageBus";
import { createTeammateTools } from "./tools";

export interface TeammateInfo {
  id: string;
  role: string;
  status: "working" | "done" | "error" | "cancelled";
  prompt: string;
  model?: string;
}

export class TeamManager {
  private teammates = new Map<string, TeammateInfo>();
  private promises: Promise<void>[] = [];
  private release: (() => void) | null = null;
  readonly messageBus = new MessageBus();

  constructor(
    private api: ExtensionAPI,
    private sessionId: string,
  ) {}

  async spawnTeammate(role: string, prompt: string, model?: string): Promise<string> {
    let id = role.toLowerCase().replace(/\s+/g, "-");
    if (this.teammates.has(id)) {
      let counter = 2;
      while (this.teammates.has(`${id}-${counter}`)) counter++;
      id = `${id}-${counter}`;
    }
    const info: TeammateInfo = { id, role, status: "working", prompt, model };
    this.teammates.set(id, info);

    // Hold stream on first spawn
    if (!this.release) {
      this.release = this.api.events.holdStream(this.sessionId);
    }

    // Emit team_created with full roster (only on first spawn)
    // Subsequent spawns just emit teammate_status which the UI uses to add tabs
    if (this.teammates.size === 1) {
      this.api.events.emit(this.sessionId, {
        type: "team_created",
        teammates: [{ id, role }],
      });
    }

    this.api.events.emit(this.sessionId, {
      type: "conversation_status",
      conversationId: id,
      conversationRole: role,
      status: "working",
    });

    const tools = createTeammateTools(this, id);
    const mcpServers = {
      [`summit-team-${id}`]: createSdkMcpServer({
        name: `summit-team-${id}`,
        tools,
      }),
    };

    const promise = this.api.queries
      .run(this.sessionId, prompt, { conversationId: id, source: "team-orchestrator", mcpServers, model })
      .then(() => {
        info.status = "done";
        this.api.events.emit(this.sessionId, {
          type: "conversation_done",
          conversationId: id,
          conversationRole: role,
        });
        this.api.events.emit(this.sessionId, {
          type: "conversation_status",
          conversationId: id,
          conversationRole: role,
          status: "done",
        });
      })
      .catch((err) => {
        info.status = "error";
        this.api.events.emit(this.sessionId, {
          type: "conversation_status",
          conversationId: id,
          conversationRole: role,
          status: "error",
          error: err?.message ?? String(err),
        });
      })
      .finally(() => {
        this.checkAllDone();
      });

    this.promises.push(promise);
    return id;
  }

  broadcast(from: string, content: string): void {
    const allIds = Array.from(this.teammates.keys());
    const messages = this.messageBus.broadcast(from, content, allIds);
    for (const msg of messages) {
      this.api.events.emit(this.sessionId, {
        type: "conversation_message",
        from: msg.from,
        to: msg.to,
        content: msg.content,
      });
    }
  }

  sendMessage(from: string, to: string, content: string): void {
    const msg = this.messageBus.send(from, to, content);
    this.api.events.emit(this.sessionId, {
      type: "conversation_message",
      from: msg.from,
      to: msg.to,
      content: msg.content,
    });
  }

  async receiveMessage(recipientId: string, from?: string, timeoutMs?: number) {
    return this.messageBus.receive(recipientId, from, timeoutMs);
  }

  getTeammates(): TeammateInfo[] {
    return Array.from(this.teammates.values());
  }

  private checkAllDone(): void {
    const allDone = Array.from(this.teammates.values()).every(
      (t) => t.status === "done" || t.status === "error" || t.status === "cancelled"
    );
    if (allDone && this.release) {
      this.release();
      this.release = null;
      this.messageBus.dispose();
    }
  }

  async waitForAll(): Promise<void> {
    await Promise.allSettled(this.promises);
  }
}
