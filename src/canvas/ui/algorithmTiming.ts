/**
 * Maps a slider position (1-10) to the real speed scale (#109):
 * position 3 == legacy speed 1, position 5 == the former real speed,
 * position 10 == legacy speed 8; positions 1-2 are slower than legacy 1.
 */
const legacySpeed = (speed: number): number =>
  speed <= 2 ? speed / 4 : speed - 2;

/** Per-step diagram animation delay in ms; shared with the built-in game (#40). */
export const stepDelayMs = (speed: number): number =>
  Math.max(60, Math.round(600 / legacySpeed(speed)));
