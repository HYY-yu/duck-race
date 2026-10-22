import type { Duck } from './simulation.ts';

export type Pass = { id: number; passed: number; position: number; time: number };

/** Spectator annotations observe the race; they never feed forces back into it. */
export class RaceInsights {
  private previous = new Map<number, number>();
  private lastPass = new Map<string, number>();
  passCount = 0;

  reset(): void {
    this.previous.clear();
    this.lastPass.clear();
    this.passCount = 0;
  }

  update(standings: Duck[], time: number): Pass[] {
    const passes: Pass[] = [];
    if (this.previous.size && time > 4) {
      for (let ahead = 0; ahead < standings.length; ahead++) {
        const duck = standings[ahead];
        if (duck.finish !== null) continue;
        for (let behind = ahead + 1; behind < standings.length; behind++) {
          const other = standings[behind];
          const previousA = this.previous.get(duck.id), previousB = this.previous.get(other.id);
          if (previousA === undefined || previousB === undefined || previousA < previousB) continue;
          const key = `${Math.min(duck.id, other.id)}:${Math.max(duck.id, other.id)}`;
          // Rank flutter at a close crossing must not become a stream of repeated announcements.
          if (time - (this.lastPass.get(key) ?? -Infinity) < 2) continue;
          this.lastPass.set(key, time);
          this.passCount++;
          passes.push({ id: duck.id, passed: other.id, position: ahead + 1, time });
        }
      }
    }
    this.previous = new Map(standings.map((duck, index) => [duck.id, index]));
    return passes;
  }
}
