import { useCallback } from 'react';
import type { DiagramState } from '../types';
import { applyBendDrag } from './arrowConstraints';

type CommitFn = (updater: (prev: DiagramState) => DiagramState) => void;

export function useArrows(commit: CommitFn) {
  const handleAddWaypoint = useCallback(
    (arrowId: string, x: number, y: number) => {
      commit((s) => ({
        ...s,
        arrows: s.arrows.map((a) =>
          a.id === arrowId
            ? {
                ...a,
                waypoints: [...a.waypoints, { x, y }],
                waypointsCustomized: true,
              }
            : a
        ),
      }));
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
