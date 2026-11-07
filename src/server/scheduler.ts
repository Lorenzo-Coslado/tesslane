import type { Ticket, PlanOutput } from '../shared/contracts.ts';
export function validatePlan(plan: PlanOutput) {
  const keys = new Set(plan.tickets.map((t) => t.key));
  if (keys.size !== plan.tickets.length)
    throw new Error('The plan contains duplicate ticket keys.');
  const visited = new Set<string>();
  const visiting = new Set<string>();
  function visit(key: string) {
    if (visiting.has(key)) throw new Error('The plan contains a dependency cycle.');
    if (visited.has(key)) return;
    visiting.add(key);
    for (const dep of plan.tickets.find((t) => t.key === key)!.dependencies) {
      if (!keys.has(dep)) throw new Error('Unknown ticket dependency: ' + dep);
      visit(dep);
    }
    visiting.delete(key);
    visited.add(key);
  }
  keys.forEach(visit);
  if (!plan.questions.length && !plan.tickets.length)
    throw new Error('A resolved plan must contain at least one delivery ticket.');
}
function overlaps(a: string, b: string) {
  const normalize = (p: string) => p.replaceAll('\\', '/').replace(/\/+$/, '');
  a = normalize(a);
  b = normalize(b);
  return a === '*' || b === '*' || a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
}
export function runnable(tickets: Ticket[], active: Ticket[], limit: number): Ticket[] {
  const selected: Ticket[] = [];
  for (const t of tickets) {
    if (selected.length + active.length >= limit) break;
    if (
      !['ready', 'ready_for_integration'].includes(t.state) ||
      !t.dependencies.every((d) => tickets.find((x) => x.id === d)?.state === 'integrated')
    )
      continue;
    const peers = [...active, ...selected];
    // Missing ownership is conservative: never assume disjoint edits.
    if (
      peers.some(
        (p) =>
          !p.areas.length ||
          !t.areas.length ||
          p.areas.some((a) => t.areas.some((b) => overlaps(a, b))),
      )
    )
      continue;
    selected.push(t);
  }
  return selected;
}

export class Limiter {
  private used = 0;
  private queue: {
    start: () => void;
    reject: (error: Error) => void;
    signal: AbortSignal;
    abort: () => void;
  }[] = [];
  acquire(limit: number, signal: AbortSignal): Promise<() => void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(new Error('Interrupted while waiting for an agent slot.'));
      const entry = { signal, reject, start: () => {}, abort: () => {} };
      entry.start = () => {
        signal.removeEventListener('abort', entry.abort);
        this.used++;
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          this.used--;
          this.queue.shift()?.start();
        });
      };
      entry.abort = () => {
        this.queue = this.queue.filter((x) => x !== entry);
        reject(new Error('Interrupted while waiting for an agent slot.'));
      };
      if (this.used < limit) entry.start();
      else {
        this.queue.push(entry);
        signal.addEventListener('abort', entry.abort, { once: true });
      }
    });
  }
}
