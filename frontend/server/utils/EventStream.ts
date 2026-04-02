interface Subscriber<T> {
  resolve: ((value: IteratorResult<T>) => void) | null;
  queue: T[];
  done: boolean;
}

export class EventStream<T> {
  private buffer: T[] = [];
  private subscribers = new Set<Subscriber<T>>();
  private ended = false;

  push(event: T): void {
    if (this.ended) return;
    this.buffer.push(event);
    for (const sub of this.subscribers) {
      if (sub.resolve) {
        const resolve = sub.resolve;
        sub.resolve = null;
        resolve({ value: event, done: false });
      } else {
        sub.queue.push(event);
      }
    }
  }

  end(): void {
    if (this.ended) return;
    this.ended = true;
    for (const sub of this.subscribers) {
      if (sub.resolve) {
        const resolve = sub.resolve;
        sub.resolve = null;
        resolve({ value: undefined as any, done: true });
      }
      sub.done = true;
    }
  }

  get isDone(): boolean {
    return this.ended;
  }

  get events(): readonly T[] {
    return this.buffer;
  }

  subscribe(afterId: number = 0): AsyncIterable<T> {
    const sub: Subscriber<T> = {
      resolve: null,
      queue: [],
      done: false,
    };

    // Replay buffered events from afterId
    for (let i = afterId; i < this.buffer.length; i++) {
      sub.queue.push(this.buffer[i]!);
    }

    if (this.ended) {
      sub.done = true;
    } else {
      this.subscribers.add(sub);
    }

    const subscribers = this.subscribers;

    return {
      [Symbol.asyncIterator]() {
        return {
          next(): Promise<IteratorResult<T>> {
            // Drain queued events first
            if (sub.queue.length > 0) {
              return Promise.resolve({ value: sub.queue.shift()!, done: false });
            }
            // Stream ended and queue empty
            if (sub.done) {
              subscribers.delete(sub);
              return Promise.resolve({ value: undefined as any, done: true });
            }
            // Wait for next event
            return new Promise((resolve) => {
              sub.resolve = resolve;
            });
          },
          return(): Promise<IteratorResult<T>> {
            subscribers.delete(sub);
            sub.done = true;
            sub.resolve = null;
            sub.queue.length = 0;
            return Promise.resolve({ value: undefined as any, done: true });
          },
        };
      },
    };
  }
}
