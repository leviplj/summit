import { describe, test, expect } from "bun:test";
import { MessageBus } from "../messageBus";

describe("MessageBus", () => {
  function makeMsg(from: string, to: string, content = "test") {
    return { id: crypto.randomUUID(), from, to, content, timestamp: Date.now() };
  }

  // 9.1 — send/receive, blocking, FIFO ordering, filtered receive
  describe("send and receive", () => {
    test("receive returns queued message immediately (FIFO)", async () => {
      const bus = new MessageBus();
      bus.deliver(makeMsg("a", "b", "first"));
      bus.deliver(makeMsg("a", "b", "second"));

      const msg1 = await bus.receive("b");
      expect(msg1.content).toBe("first");
      const msg2 = await bus.receive("b");
      expect(msg2.content).toBe("second");
    });

    test("receive blocks until message arrives", async () => {
      const bus = new MessageBus();
      let received = false;

      const promise = bus.receive("b").then((msg) => {
        received = true;
        return msg;
      });

      // Should not have resolved yet
      await new Promise((r) => setTimeout(r, 50));
      expect(received).toBe(false);

      // Deliver message — should unblock
      bus.deliver(makeMsg("a", "b", "hello"));
      const msg = await promise;
      expect(msg.content).toBe("hello");
      expect(received).toBe(true);
    });

    test("filtered receive only returns messages from specified sender", async () => {
      const bus = new MessageBus();
      bus.deliver(makeMsg("x", "b", "from-x"));
      bus.deliver(makeMsg("a", "b", "from-a"));

      const msg = await bus.receive("b", "a");
      expect(msg.content).toBe("from-a");

      // "from-x" should still be in queue
      const msg2 = await bus.receive("b");
      expect(msg2.content).toBe("from-x");
    });

    test("filtered receive blocks if no matching message", async () => {
      const bus = new MessageBus();
      bus.deliver(makeMsg("x", "b", "from-x"));

      let received = false;
      const promise = bus.receive("b", "a").then((msg) => {
        received = true;
        return msg;
      });

      await new Promise((r) => setTimeout(r, 50));
      expect(received).toBe(false);

      bus.deliver(makeMsg("a", "b", "from-a"));
      const msg = await promise;
      expect(msg.content).toBe("from-a");
    });
  });

  // 9.2 — cycle detection
  describe("cycle detection", () => {
    test("detects simple A↔B cycle", () => {
      const bus = new MessageBus();
      // Simulate A waiting for B
      const depsA = new Set(["b"]);
      (bus as any).waitsFor.set("a", depsA);

      const cycle = bus.wouldCreateCycle("b", "a");
      expect(cycle).not.toBeNull();
      expect(cycle).toEqual(["b", "a", "b"]);
    });

    test("detects transitive A→B→C→A cycle", () => {
      const bus = new MessageBus();
      (bus as any).waitsFor.set("a", new Set(["b"]));
      (bus as any).waitsFor.set("b", new Set(["c"]));

      const cycle = bus.wouldCreateCycle("c", "a");
      expect(cycle).not.toBeNull();
      expect(cycle!.at(0)).toBe("c");
      expect(cycle!.at(-1)).toBe("c");
    });

    test("allows non-circular dependencies", () => {
      const bus = new MessageBus();
      (bus as any).waitsFor.set("a", new Set(["b"]));

      // C waiting for B — no cycle
      const cycle = bus.wouldCreateCycle("c", "b");
      expect(cycle).toBeNull();
    });

    test("receive throws on circular dependency", async () => {
      const bus = new MessageBus();

      // A is waiting for B
      const aPromise = bus.receive("a", "b");

      // B tries to wait for A — should throw
      try {
        await bus.receive("b", "a");
        expect(true).toBe(false); // should not reach
      } catch (err: any) {
        expect(err.message).toContain("Circular dependency");
      }

      // Clean up: deliver to A so it resolves
      bus.deliver(makeMsg("b", "a", "cleanup"));
      await aPromise;
    });
  });

  // Broadcast
  describe("broadcast", () => {
    test("sends to all except sender", async () => {
      const bus = new MessageBus();
      bus.broadcast("a", "hello everyone", ["a", "b", "c"]);

      const msgB = await bus.receive("b");
      expect(msgB.content).toBe("hello everyone");
      expect(msgB.from).toBe("a");

      const msgC = await bus.receive("c");
      expect(msgC.content).toBe("hello everyone");

      // A should have no messages
      const box = (bus as any).mailboxes.get("a");
      expect(box === undefined || box.length === 0).toBe(true);
    });
  });

  // Dispose
  describe("dispose", () => {
    test("clears all state", () => {
      const bus = new MessageBus();
      bus.deliver(makeMsg("a", "b"));
      bus.dispose();

      expect((bus as any).mailboxes.size).toBe(0);
      expect((bus as any).waiters.size).toBe(0);
      expect((bus as any).waitsFor.size).toBe(0);
    });
  });
});
