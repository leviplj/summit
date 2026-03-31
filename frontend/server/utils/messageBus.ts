import type { TeamMessage } from "~~/shared/types";

interface Waiter {
  resolve: (msg: TeamMessage) => void;
  from?: string;
}

export class MessageBus {
  private mailboxes = new Map<string, TeamMessage[]>();
  private waiters = new Map<string, Waiter>();
  private waitsFor = new Map<string, Set<string>>();
  private disposed = false;

  /**
   * Check if adding a wait edge (waiter → target) would create a cycle.
   * Returns the cycle path as an array of IDs, or null if no cycle.
   */
  wouldCreateCycle(waiter: string, target: string): string[] | null {
    const visited = new Set<string>();
    const path = [waiter, target];

    const walk = (node: string): boolean => {
      if (node === waiter) return true;
      if (visited.has(node)) return false;
      visited.add(node);
      for (const next of this.waitsFor.get(node) ?? []) {
        path.push(next);
        if (walk(next)) return true;
        path.pop();
      }
      return false;
    };

    return walk(target) ? path : null;
  }

  /**
   * Deliver a message. If the recipient is waiting (and matches filter),
   * resolve immediately. Otherwise queue.
   */
  deliver(msg: TeamMessage): void {
    if (this.disposed) return;

    const waiter = this.waiters.get(msg.to);
    if (waiter && (!waiter.from || waiter.from === msg.from)) {
      this.waiters.delete(msg.to);
      // Remove wait edge
      const deps = this.waitsFor.get(msg.to);
      if (deps) {
        if (waiter.from) deps.delete(waiter.from);
        else deps.clear();
        if (deps.size === 0) this.waitsFor.delete(msg.to);
      }
      waiter.resolve(msg);
      return;
    }

    // Queue the message
    const box = this.mailboxes.get(msg.to) ?? [];
    box.push(msg);
    this.mailboxes.set(msg.to, box);
  }

  /**
   * Receive a message for a teammate. Returns immediately if a matching
   * message is queued. Otherwise blocks until one arrives.
   * Throws if blocking would create a circular dependency.
   */
  async receive(teammateId: string, from?: string): Promise<TeamMessage> {
    if (this.disposed) {
      throw new Error("Message bus has been disposed");
    }

    // Check queue for matching message
    const box = this.mailboxes.get(teammateId) ?? [];
    if (from) {
      const idx = box.findIndex((m) => m.from === from);
      if (idx !== -1) {
        const [msg] = box.splice(idx, 1);
        if (box.length === 0) this.mailboxes.delete(teammateId);
        return msg;
      }
    } else if (box.length > 0) {
      const msg = box.shift()!;
      if (box.length === 0) this.mailboxes.delete(teammateId);
      return msg;
    }

    // Need to block — check for cycles first
    if (from) {
      const cycle = this.wouldCreateCycle(teammateId, from);
      if (cycle) {
        throw new Error(
          `Circular dependency detected: ${cycle.join(" → ")}. ` +
          `Send your results to ${from} first, then wait.`,
        );
      }
      // Register wait edge
      const deps = this.waitsFor.get(teammateId) ?? new Set();
      deps.add(from);
      this.waitsFor.set(teammateId, deps);
    }

    // Block until a message arrives
    return new Promise<TeamMessage>((resolve, reject) => {
      if (this.disposed) {
        reject(new Error("Message bus has been disposed"));
        return;
      }
      this.waiters.set(teammateId, { resolve, from });
    });
  }

  /**
   * Broadcast a message to all registered mailboxes except the sender.
   */
  broadcast(from: string, content: string, allTeammateIds: string[]): void {
    for (const id of allTeammateIds) {
      if (id === from) continue;
      const msg: TeamMessage = {
        id: crypto.randomUUID(),
        from,
        to: id,
        content,
        timestamp: Date.now(),
      };
      this.deliver(msg);
    }
  }

  /**
   * Reject all pending waiters (used when a teammate is cancelled).
   */
  rejectWaitersFor(teammateId: string): void {
    // Reject anyone waiting for messages from this teammate
    for (const [waiterId, waiter] of this.waiters) {
      if (waiter.from === teammateId) {
        this.waiters.delete(waiterId);
        const deps = this.waitsFor.get(waiterId);
        if (deps) {
          deps.delete(teammateId);
          if (deps.size === 0) this.waitsFor.delete(waiterId);
        }
        waiter.resolve({
          id: crypto.randomUUID(),
          from: teammateId,
          to: waiterId,
          content: `Teammate "${teammateId}" was cancelled.`,
          timestamp: Date.now(),
        });
      }
    }
    // Also reject if this teammate itself is waiting
    const ownWaiter = this.waiters.get(teammateId);
    if (ownWaiter) {
      this.waiters.delete(teammateId);
      this.waitsFor.delete(teammateId);
    }
  }

  /**
   * Dispose the message bus, rejecting all pending waiters.
   */
  dispose(): void {
    this.disposed = true;
    for (const [id] of this.waiters) {
      this.rejectWaitersFor(id);
    }
    this.waiters.clear();
    this.mailboxes.clear();
    this.waitsFor.clear();
  }

  /**
   * Reset the bus so it can be reused after dispose (e.g. team dismissed then recreated).
   */
  reset(): void {
    this.disposed = false;
    this.waiters.clear();
    this.mailboxes.clear();
    this.waitsFor.clear();
  }
}
