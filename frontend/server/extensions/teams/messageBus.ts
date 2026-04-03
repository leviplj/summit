export interface TeamMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
}

interface Mailbox {
  messages: TeamMessage[];
  waiters: Array<{
    resolve: (msg: TeamMessage) => void;
    from?: string;
  }>;
}

export class MessageBus {
  private mailboxes = new Map<string, Mailbox>();
  private waitingFor = new Map<string, string | undefined>(); // who is blocked waiting, and for whom

  private getMailbox(id: string): Mailbox {
    let mb = this.mailboxes.get(id);
    if (!mb) {
      mb = { messages: [], waiters: [] };
      this.mailboxes.set(id, mb);
    }
    return mb;
  }

  send(from: string, to: string, content: string): TeamMessage {
    const msg: TeamMessage = {
      id: crypto.randomUUID(),
      from,
      to,
      content,
      timestamp: Date.now(),
    };

    const mb = this.getMailbox(to);

    // Check if any waiter matches
    const waiterIdx = mb.waiters.findIndex((w) => !w.from || w.from === from);
    if (waiterIdx >= 0) {
      const waiter = mb.waiters.splice(waiterIdx, 1)[0]!;
      this.waitingFor.delete(to);
      waiter.resolve(msg);
    } else {
      mb.messages.push(msg);
    }

    return msg;
  }

  broadcast(from: string, content: string, allIds: string[]): TeamMessage[] {
    return allIds
      .filter((id) => id !== from)
      .map((id) => this.send(from, id, content));
  }

  async receive(recipientId: string, from?: string, timeoutMs: number = 30_000): Promise<TeamMessage> {
    // Cycle detection
    if (this.wouldCreateCycle(recipientId, from)) {
      throw new Error(`Cycle detected: ${recipientId} waiting for ${from ?? "any"} would create a deadlock`);
    }

    const mb = this.getMailbox(recipientId);

    // Check existing messages
    const idx = mb.messages.findIndex((m) => !from || m.from === from);
    if (idx >= 0) {
      return mb.messages.splice(idx, 1)[0]!;
    }

    // Block until message arrives
    this.waitingFor.set(recipientId, from);

    return new Promise<TeamMessage>((resolve, reject) => {
      const waiter = { resolve, from };
      mb.waiters.push(waiter);

      const timer = setTimeout(() => {
        const waiterIdx = mb.waiters.indexOf(waiter);
        if (waiterIdx >= 0) mb.waiters.splice(waiterIdx, 1);
        this.waitingFor.delete(recipientId);
        reject(new Error(`Timeout waiting for message${from ? ` from ${from}` : ""}`));
      }, timeoutMs);

      const origResolve = waiter.resolve;
      waiter.resolve = (msg: TeamMessage) => {
        clearTimeout(timer);
        this.waitingFor.delete(recipientId);
        origResolve(msg);
      };
    });
  }

  /**
   * Check if recipientId waiting for `from` would create a cycle.
   * A cycle exists if: recipient waits for X, X waits for Y, ..., Y waits for recipient.
   */
  private wouldCreateCycle(recipientId: string, from?: string): boolean {
    if (!from) return false;

    let current: string | undefined = from;
    const visited = new Set<string>();

    while (current) {
      if (current === recipientId) return true;
      if (visited.has(current)) return false;
      visited.add(current);
      current = this.waitingFor.get(current);
    }

    return false;
  }

  dispose(): void {
    this.mailboxes.clear();
    this.waitingFor.clear();
  }
}
