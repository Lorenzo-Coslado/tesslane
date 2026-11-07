export class InputQueue<T> implements AsyncIterable<T> {
  private values: T[] = [];
  private waiting: ((result: IteratorResult<T>) => void) | undefined;
  private ended = false;
  push(value: T) {
    if (this.ended) throw new Error('The native session is closed.');
    if (this.waiting) {
      const next = this.waiting;
      this.waiting = undefined;
      next({ value, done: false });
    } else this.values.push(value);
  }
  close() {
    this.ended = true;
    this.values = [];
    this.waiting?.({ done: true, value: undefined });
    this.waiting = undefined;
  }
  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        const value = this.values.shift();
        if (value !== undefined) return Promise.resolve({ value, done: false });
        if (this.ended) return Promise.resolve({ done: true, value: undefined });
        return new Promise((resolve) => {
          this.waiting = resolve;
        });
      },
      return: async () => {
        this.close();
        return { done: true, value: undefined };
      },
    };
  }
}
