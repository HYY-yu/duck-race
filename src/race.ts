import { createDucks, step, type Duck, type Event } from './simulation.ts';

export type RacePhase = 'ready' | 'countdown' | 'running' | 'paused' | 'done';
export type RaceSignal = {
  type: 'countdown' | 'start' | 'pause' | 'resume' | 'reset' | 'complete' | 'timeout';
};

export const FIXED_STEP = 1 / 120;
export const COUNTDOWN_DURATION = 3;
export const RACE_TIMEOUT = 180;
const MAX_FRAME_DELTA = 0.1;
const EPSILON = 1e-9;

function normalizeSeed(seed: number): number {
  return Number.isFinite(seed) ? (Math.trunc(seed) >>> 0) || 1 : 1;
}

/** Owns race time; render frames never become variable simulation steps. */
export class RaceController {
  phase: RacePhase = 'ready';
  time = 0;
  countdown = COUNTDOWN_DURATION;
  ducks: Duck[];
  seed: number;
  timedOut = false;
  private resumePhase: 'countdown' | 'running' = 'running';
  private accumulator = 0;
  private ticks = 0;

  constructor(seed = 42) {
    this.seed = normalizeSeed(seed);
    this.ducks = createDucks(this.seed);
  }

  start(seed: number): RaceSignal[] {
    if (this.phase !== 'ready') return [];
    this.resetValues(seed);
    this.phase = 'countdown';
    return [{ type: 'countdown' }];
  }

  togglePause(): RaceSignal[] {
    if (this.timedOut) return [];
    if (this.phase === 'countdown' || this.phase === 'running') {
      this.resumePhase = this.phase;
      this.phase = 'paused';
      return [{ type: 'pause' }];
    }
    if (this.phase === 'paused') {
      this.phase = this.resumePhase;
      return [{ type: 'resume' }];
    }
    return [];
  }

  reset(seed = this.seed): RaceSignal[] {
    this.resetValues(seed);
    this.phase = 'ready';
    return [{ type: 'reset' }];
  }

  advance(delta: number): { events: Event[]; signals: RaceSignal[] } {
    const events: Event[] = [];
    const signals: RaceSignal[] = [];
    if (!Number.isFinite(delta) || delta <= 0) return { events, signals };
    // A background tab must not silently fast-forward minutes of a race.
    let remaining = Math.min(delta, MAX_FRAME_DELTA);

    if (this.phase === 'countdown') {
      const countdownBefore = this.countdown;
      this.countdown = Math.max(0, this.countdown - remaining);
      if (this.countdown > EPSILON) return { events, signals };
      this.countdown = 0;
      remaining = Math.max(0, remaining - countdownBefore);
      this.phase = 'running';
      signals.push({ type: 'start' });
    }

    if (this.phase !== 'running') return { events, signals };
    this.accumulator += remaining;
    while (this.accumulator + EPSILON >= FIXED_STEP) {
      this.accumulator = Math.max(0, this.accumulator - FIXED_STEP);
      this.ticks += 1;
      this.time = this.ticks * FIXED_STEP;
      events.push(...step(this.ducks, this.time, FIXED_STEP));
      if (this.ducks.every(duck => duck.finish !== null)) {
        this.phase = 'done';
        this.accumulator = 0;
        signals.push({ type: 'complete' });
        break;
      }
      if (this.time >= RACE_TIMEOUT) {
        this.phase = 'paused';
        this.timedOut = true;
        this.accumulator = 0;
        signals.push({ type: 'timeout' });
        break;
      }
    }
    return { events, signals };
  }

  private resetValues(seed: number): void {
    this.seed = normalizeSeed(seed);
    this.ducks = createDucks(this.seed);
    this.time = 0;
    this.countdown = COUNTDOWN_DURATION;
    this.accumulator = 0;
    this.ticks = 0;
    this.timedOut = false;
    this.resumePhase = 'running';
  }
}
