import { useCallback } from 'react';
import type { DiagramState } from '../types';
import { getAnchor } from '../utils/blocks';
import { applyBendDrag } from './arrowConstraints';
import { insertWaypointPair } from './arrowGeometry';

type CommitFn = (updater: (prev: DiagramState) => DiagramState) => void;

function findBlocks(s: DiagramState, arrowId: string) {
  const arrow = s.arrows.find((a) => a.id === arrowId);
  if (!arrow) return null;
  const from = s.blocks.find((b) => b.id === arrow.fromBlockId);
  const to = s.blocks.find((b) => b.id === arrow.toBlockId);
  if (!from || !to) return null;
  return { arrow, from, to };
}

export function useArrows(commit: CommitFn) {
  const handleAddWaypoint = useCallback(
    (arrowId: string, x: number, y: number) => {
      commit((s) => {
        const found = findBlocks(s, arrowId);
        if (!found) return s;
        const { arrow, from, to } = found;
        // Issue #102: a new bend is a PAIR of points with a distance
        // between them, so points == bends stays true.
        const waypoints = insertWaypointPair(
          getAnchor(from, arrow.fromSide),
          arrow.fromSide,
          getAnchor(to, arrow.toSide),
          arrow.toSide,
          arrow.waypoints,
          x,
          y
        );
        return {
          ...s,
          arrows: s.arrows.map((a) =>
            a.id === arrowId ? { ...a, waypoints, waypointsCustomized: true } : a
          ),
        };
      });
    },
    [commit]
  );

  const handleBendDragEnd = useCallback(
    (arrowId: string, idx: number, x: number, y: number) => {
      commit((s) => {
        const arrow = s.arrows.find((a) => a.id === arrowId);
        if (!arrow) return s;
        const from = s.blocks.find((b) => b.id === arrow.fromBlockId);
        const to = s.blocks.find((b) => b.id === arrow.toBlockId);
        if (!from || !to) return s;
        // (block lookup kept local; clamping lives in applyBendDrag)

        const original = arrow.waypoints[idx];
        if (!original) return s;
        const dx = x - original.x;
        const dy = y - original.y;

        const newWaypoints = applyBendDrag(from, to, arrow, idx, dx, dy);
        if (!newWaypoints) return s;

        return {
          ...s,
          arrows: s.arrows.map((a) =>
            a.id === arrowId ? { ...a, waypoints: newWaypoints, waypointsCustomized: true } : a
          ),
        };
      });
    },
    [commit]
  );

  const handleBendDelete = useCallback(
    (arrowId: string, idx: number) => {
      commit((s) => ({
        ...s,
        arrows: s.arrows.map((a) =>
          a.id === arrowId
            ? {
                ...a,
                waypoints: a.waypoints.filter((_, i) => i !== idx),
                waypointsCustomized: true,
              }
            : a
        ),
      }));
    },
    [commit]
  );

  return { handleAddWaypoint, handleBendDragEnd, handleBendDelete };
}
