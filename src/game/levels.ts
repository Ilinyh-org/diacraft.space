import type { Level } from './types';

export const LEVELS: Level[] = [
  {
    id: 'linear-1',
    title: 'First steps',
    concept: 'linear',
    description:
      'Teach the robot to walk. Build a program of Move commands to reach the flag.',
    width: 5,
    height: 1,
    walls: [],
    start: { x: 0, y: 0, dir: 1 },
    goal: { x: 3, y: 0 },
    allowed: ['move'],
  },
  {
    id: 'linear-2',
    title: 'The corner',
    concept: 'linear',
    description:
      'A straight line is not enough. Turn the robot with Turn Left / Turn Right.',
    width: 3,
    height: 3,
    walls: [
      [0, 1],
      [0, 2],
      [1, 1],
    ],
    start: { x: 0, y: 0, dir: 1 },
    goal: { x: 2, y: 2 },
    allowed: ['move', 'turnLeft', 'turnRight'],
  },
  {
    id: 'conditions-1',
    title: 'Brick ahead',
    concept: 'conditions',
    description:
      'Use "If wall ahead" to react to the world instead of memorising it.',
    width: 3,
    height: 2,
    walls: [[2, 0]],
    start: { x: 0, y: 0, dir: 1 },
    goal: { x: 2, y: 1 },
    allowed: ['move', 'turnLeft', 'turnRight', 'ifWall'],
  },
  {
    id: 'loops-1',
    title: 'Long corridor',
    concept: 'loops',
    description:
      'Seven moves in a row? Use Repeat to run commands many times.',
    width: 8,
    height: 1,
    walls: [],
    start: { x: 0, y: 0, dir: 1 },
    goal: { x: 7, y: 0 },
    allowed: ['move', 'repeat'],
  },
  {
    id: 'combined-1',
    title: 'Serpentine',
    concept: 'combined',
    description:
      'Combine loops and conditions to snake through the corridor.',
    width: 3,
    height: 5,
    walls: [
      [1, 1],
      [2, 1],
      [0, 3],
      [1, 3],
    ],
    start: { x: 0, y: 0, dir: 1 },
    goal: { x: 2, y: 4 },
    allowed: ['move', 'turnLeft', 'turnRight', 'repeat', 'ifWall'],
  },
];
