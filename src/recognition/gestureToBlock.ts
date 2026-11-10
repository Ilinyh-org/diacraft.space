import { recognize, type Gesture } from './pRecognizer';
import { templates } from './templates';
import { boundingBox, dist, pathLength, type Point } from './normalize';

export type GestureBlockType =
  | 'action'
  | 'condition'
  | 'io'
  | 'forloop'
  | 'function'
  | 'start'
  | 'link';

export type GestureBlock = {
  type: GestureBlockType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  score: number;
};

const MIN_WIDTH = 80;
const MIN_HEIGHT = 48;
const SCORE_THRESHOLD = 0.5;
const CLOSURE_RATIO = 0.25;
const MAX_LENGTH_RATIO = 1.5;

/** Min straightness (endpoint/pathlen) for an inner stroke to count as a line. */
const INNER_LINE_STRAIGHTNESS = 0.8;
/** Inner stroke must span at least this fraction of the shape's smaller side. */
const INNER_LINE_MIN_SPAN = 0.3;

function isClosed(points: Point[]): boolean {
  if (points.length < 4) return false;
  const total = pathLength(points);
  if (total < 1) return false;
  const first = points[0];
  const last = points[points.length - 1];
  const gap = Math.hypot(last.x - first.x, last.y - first.y);
  return gap / total < CLOSURE_RATIO;
}

/** Reject scribbles: path length should be roughly bbox perimeter, not many times it. */
function isReasonableLength(points: Point[], maxRatio: number = MAX_LENGTH_RATIO): boolean {
  const bb = boundingBox(points);
  const perimeter = 2 * (bb.width + bb.height);
  if (perimeter < 1) return false;
  const total = pathLength(points);
  return total / perimeter <= maxRatio;
}

/**
 * Detect a function-call block structurally: a closed shape as the first
 * stroke followed by one or two roughly straight strokes inside it (the
 * vertical bars of the predefined-process symbol).
 */
function isFunctionBlock(gesture: Gesture): boolean {
  if (gesture.length < 2 || gesture.length > 3) return false;
  if (!isClosed(gesture[0])) return false;

  const bb = boundingBox(gesture[0]);
  const minSide = Math.min(bb.width, bb.height);
  if (minSide < 1) return false;

  return gesture.slice(1).every((stroke) => {
    if (stroke.length < 2) return false;
    const total = pathLength(stroke);
    if (total < INNER_LINE_MIN_SPAN * minSide) return false;
    const direct = dist(stroke[0], stroke[stroke.length - 1]);
    if (direct / total < INNER_LINE_STRAIGHTNESS) return false;
    // Both endpoints must lie inside (or near) the closed first stroke.
    const inside = (pt: Point) =>
      pt.x >= bb.minX - minSide * 0.1 &&
      pt.x <= bb.maxX + minSide * 0.1 &&
      pt.y >= bb.minY - minSide * 0.1 &&
      pt.y <= bb.maxY + minSide * 0.1;
    return inside(stroke[0]) && inside(stroke[stroke.length - 1]);
  });
}

export function gestureToBlock(gesture: Gesture): GestureBlock | null {
  if (gesture.length === 0) return null;
  const allPoints = gesture.flat();
  if (allPoints.length < 8) return null;

  if (!isClosed(gesture[0])) return null;
  // Scribble guard; allow extra path length for each additional stroke
  // (e.g. the inner bars of a function-call block).
  const lengthRatio = MAX_LENGTH_RATIO + 0.5 * (gesture.length - 1);
  if (!isReasonableLength(allPoints, lengthRatio)) return null;

  if (isFunctionBlock(gesture)) {
    const bb = boundingBox(allPoints);
    if (bb.width < 1 || bb.height < 1) return null;
    const width = Math.max(bb.width, MIN_WIDTH);
    const height = Math.max(bb.height, MIN_HEIGHT);
    const cx = bb.minX + bb.width / 2;
    const cy = bb.minY + bb.height / 2;
    return {
      type: 'function',
      x: cx - width / 2,
      y: cy - height / 2,
      width,
      height,
      rotation: 0,
      score: 1,
    };
  }

  const candidates = recognize(gesture, templates);
  if (candidates.length === 0) return null;

  const best = candidates[0];
  if (best.score < SCORE_THRESHOLD) return null;

  const bb = boundingBox(allPoints);
  if (bb.width < 1 || bb.height < 1) return null;

  let type: GestureBlockType;
  if (best.name === 'ellipse') {
    const ratio = bb.width / Math.max(bb.height, 1);
    // Tall ellipses don't match any block type.
    if (ratio < 0.75) return null;
    type = ratio <= 1.33 ? 'link' : 'start';
  } else {
    type = best.name as GestureBlockType;
  }

  const width = Math.max(bb.width, MIN_WIDTH);
  const height = Math.max(bb.height, MIN_HEIGHT);
  const cx = bb.minX + bb.width / 2;
  const cy = bb.minY + bb.height / 2;
  const x = cx - width / 2;
  const y = cy - height / 2;

  return {
    type,
    x,
    y,
    width,
    height,
    rotation: 0,
    score: best.score,
  };
}
