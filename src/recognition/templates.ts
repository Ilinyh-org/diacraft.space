import type { Template } from './pRecognizer';

const p = (x: number, y: number) => ({ x, y });

function rect(w: number, h: number) {
  return [p(0, 0), p(w, 0), p(w, h), p(0, h), p(0, 0)];
}

function diamond(w: number, h: number) {
  return [p(w / 2, 0), p(w, h / 2), p(w / 2, h), p(0, h / 2), p(w / 2, 0)];
}

function parallelogram(w: number, h: number, lean: number) {
  // lean > 0 → top shifted right, bottom shifted left
  return [
    p(lean, 0),
    p(w + lean, 0),
    p(w, h),
    p(0, h),
    p(lean, 0),
  ];
}

function hexagon(w: number, h: number) {
  return [
    p(w * 0.25, 0),
    p(w * 0.75, 0),
    p(w, h / 2),
    p(w * 0.75, h),
    p(w * 0.25, h),
    p(0, h / 2),
    p(w * 0.25, 0),
  ];
}

function ellipse(cx: number, cy: number, rx: number, ry: number, steps = 24) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    pts.push(p(cx + rx * Math.cos(t), cy + ry * Math.sin(t)));
  }
  return pts;
}

export const templates: Template[] = [
  // === Action: rectangle at multiple aspect ratios ===
  { name: 'action', strokes: [rect(100, 60)] },   // 5:3
  { name: 'action', strokes: [rect(100, 30)] },   // 10:3
  { name: 'action', strokes: [rect(60, 60)] },    // 1:1
  { name: 'action', strokes: [rect(30, 100)] },   // 3:10
  { name: 'action', strokes: [rect(60, 100)] },   // 3:5
  { name: 'action', strokes: [rect(100, 60).slice().reverse()] },
  { name: 'action', strokes: [rect(60, 100).slice().reverse()] },

  // === Condition: diamond at multiple aspect ratios ===
  { name: 'condition', strokes: [diamond(100, 100)] }, // square diamond
  { name: 'condition', strokes: [diamond(120, 60)] },  // wide
  { name: 'condition', strokes: [diamond(60, 120)] },  // tall
  { name: 'condition', strokes: [diamond(100, 100).slice().reverse()] },
  { name: 'condition', strokes: [diamond(120, 60).slice().reverse()] },
  { name: 'condition', strokes: [diamond(60, 120).slice().reverse()] },

  // === I/O: parallelogram, both lean directions, several aspects ===
  { name: 'io', strokes: [parallelogram(100, 60, 20)] },
  { name: 'io', strokes: [parallelogram(100, 60, 40)] },
  { name: 'io', strokes: [parallelogram(120, 50, 30)] },
  { name: 'io', strokes: [parallelogram(60, 100, 20)] },
  { name: 'io', strokes: [parallelogram(60, 100, 30)] },
  { name: 'io', strokes: [parallelogram(100, 60, -20)] },
  { name: 'io', strokes: [parallelogram(100, 60, -40)] },
  { name: 'io', strokes: [parallelogram(120, 50, -30)] },
  { name: 'io', strokes: [parallelogram(60, 100, -20)] },
  { name: 'io', strokes: [parallelogram(60, 100, -30)] },
  { name: 'io', strokes: [parallelogram(100, 60, 20).slice().reverse()] },
  { name: 'io', strokes: [parallelogram(100, 60, 40).slice().reverse()] },
  { name: 'io', strokes: [parallelogram(60, 100, 20).slice().reverse()] },
  { name: 'io', strokes: [parallelogram(100, 60, -20).slice().reverse()] },
  { name: 'io', strokes: [parallelogram(100, 60, -40).slice().reverse()] },

  // === For-loop: hexagon at multiple aspects ===
  { name: 'forloop', strokes: [hexagon(100, 60)] },
  { name: 'forloop', strokes: [hexagon(100, 100)] },
  { name: 'forloop', strokes: [hexagon(60, 100)] },
  { name: 'forloop', strokes: [hexagon(120, 60)] },
  { name: 'forloop', strokes: [hexagon(100, 60).slice().reverse()] },
  { name: 'forloop', strokes: [hexagon(100, 100).slice().reverse()] },

  // === Ellipse: circle + wide + tall, both directions ===
  { name: 'ellipse', strokes: [ellipse(50, 50, 50, 50)] }, // circle
  { name: 'ellipse', strokes: [ellipse(60, 30, 60, 30)] }, // wide oval
  { name: 'ellipse', strokes: [ellipse(30, 60, 30, 60)] }, // tall oval
  { name: 'ellipse', strokes: [ellipse(50, 50, 50, 50).slice().reverse()] },
  { name: 'ellipse', strokes: [ellipse(60, 30, 60, 30).slice().reverse()] },
  { name: 'ellipse', strokes: [ellipse(30, 60, 30, 60).slice().reverse()] },
];
