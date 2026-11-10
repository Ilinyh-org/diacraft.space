
export const GUIDE_DASH_PATTERN = [6, 4];

export function guideLinePoints(guide: AlignmentGuide): number[] {
  return guide.axis === 'vertical'
    ? [
        guide.position,
        Math.min(guide.from, guide.to),
        guide.position,
        Math.max(guide.from, guide.to),
      ]
    : [
        Math.min(guide.from, guide.to),
        guide.position,
        Math.max(guide.from, guide.to),
        guide.position,
      ];
}
