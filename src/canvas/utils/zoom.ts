/**
 * Stage zoom limits (issue #82). The default view is scale 1; the canvas can
 * only be zoomed out from it, never enlarged past the default.
 */
export const MIN_STAGE_SCALE = 0.25;
export const MAX_STAGE_SCALE = 1;

/**
 * Issue #82 (round 2): how much the raw two-finger pinch ratio is amplified
 * before it is applied to the stage scale. 1 means no amplification; larger
 * values make the zoom react more sensitively to small finger movements.
 */
export const PINCH_SENSITIVITY = 1.8;

/** Clamps a proposed stage scale into the allowed [min, max] window. */
export function clampStageScale(scale: number): number {
  if (!Number.isFinite(scale)) return MAX_STAGE_SCALE;
  return Math.min(MAX_STAGE_SCALE, Math.max(MIN_STAGE_SCALE, scale));
}
