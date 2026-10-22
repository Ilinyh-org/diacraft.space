/**
 * Stage zoom limits (issue #82). The default view is scale 1; the canvas can
 * only be zoomed out from it, never enlarged past the default.
 */
export const MIN_STAGE_SCALE = 0.25;
export const MAX_STAGE_SCALE = 1;

/** Clamps a proposed stage scale into the allowed [min, max] window. */
export function clampStageScale(scale: number): number {
  if (!Number.isFinite(scale)) return MAX_STAGE_SCALE;
  return Math.min(MAX_STAGE_SCALE, Math.max(MIN_STAGE_SCALE, scale));
}
