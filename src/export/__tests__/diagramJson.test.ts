import { describe, expect, it } from 'vitest';
import {
  exportDiagram,
  parseDiagram,
  serializeDiagram,
} from '../diagramJson';
import type { ArrowData, BlockData, DiagramState } from '../../canvas/types';

const block = (overrides: Partial<BlockData> = {}): BlockData => ({
  id: 'b1',
  x: 10,
  y: 20,
  width: 120,
  height: 60,
  label: 'Start',
  type: 'action',
  ...overrides,
});

const arrow = (overrides: Partial<ArrowData> = {}): ArrowData => ({
  id: 'a1',
  fromBlockId: 'b1',
  fromSide: 'bottom',
  toBlockId: 'b2',
  toSide: 'top',
  waypoints: [],
  ...overrides,
});

describe('diagram JSON export', () => {
  it('exports an empty diagram', () => {
    const state: DiagramState = { blocks: [], arrows: [] };
    const parsed = JSON.parse(exportDiagram(state));
    expect(parsed).toEqual({
      format: 'diacraft-diagram',
      version: 1,
      blocks: [],
      arrows: [],
    });
  });

  it('exports blocks and arrows', () => {
    const state: DiagramState = {
      blocks: [block(), block({ id: 'b2', label: 'End', x: 200 })],
      arrows: [arrow()],
    };
    const file = serializeDiagram(state);
    expect(file.blocks).toHaveLength(2);
    expect(file.arrows).toHaveLength(1);
    expect(file.arrows[0].waypoints).toEqual([]);
  });

  it('drops arrows referencing missing blocks', () => {
    const state: DiagramState = {
      blocks: [block(), block({ id: 'b2' })],
      arrows: [arrow(), arrow({ id: 'a2', toBlockId: 'ghost' })],
    };
    const file = serializeDiagram(state);
    expect(file.arrows.map((a) => a.id)).toEqual(['a1']);
  });

  it('round-trips a full diagram', () => {
    const state: DiagramState = {
      blocks: [
        block(),
        block({ id: 'b2', label: 'End', x: 300, y: 150 }),
        block({ id: 'b3', label: 'Decide', x: 150, type: 'condition' }),
      ],
      arrows: [
        arrow({ waypoints: [{ x: 70, y: 120 }] }),
        arrow({ id: 'a2', fromBlockId: 'b3', toBlockId: 'b2' }),
      ],
    };
    const restored = parseDiagram(exportDiagram(state));
    expect(restored).toEqual(state);
  });
});

describe('diagram JSON import', () => {
  it('parses a valid diagram file', () => {
    const json = JSON.stringify({
      format: 'diacraft-diagram',
      version: 1,
      blocks: [block(), block({ id: 'b2' })],
      arrows: [arrow()],
    });
    const state = parseDiagram(json);
    expect(state.blocks).toHaveLength(2);
    expect(state.arrows).toHaveLength(1);
  });

  it('fills missing waypoints with an empty array', () => {
    const json = JSON.stringify({
      format: 'diacraft-diagram',
      version: 1,
      blocks: [block(), block({ id: 'b2' })],
      arrows: [{ ...arrow(), waypoints: undefined }],
    });
    const state = parseDiagram(json);
    expect(state.arrows[0].waypoints).toEqual([]);
  });

  it('drops arrows with dangling block references', () => {
    const json = JSON.stringify({
      format: 'diacraft-diagram',
      version: 1,
      blocks: [block(), block({ id: 'b2' })],
      arrows: [arrow(), arrow({ id: 'a2', toBlockId: 'missing' })],
    });
    const state = parseDiagram(json);
    expect(state.arrows.map((a) => a.id)).toEqual(['a1']);
  });

  it('skips malformed blocks and arrows', () => {
    const json = JSON.stringify({
      format: 'diacraft-diagram',
      version: 1,
      blocks: [block(), block({ id: 'b2' }), { id: 'bad' }, 'nope'],
      arrows: [arrow(), { id: 42 }, null],
    });
    const state = parseDiagram(json);
    expect(state.blocks.map((b) => b.id)).toEqual(['b1', 'b2']);
    expect(state.arrows.map((a) => a.id)).toEqual(['a1']);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseDiagram('{not json')).toThrow('Invalid JSON file');
  });

  it('throws on non-diagram JSON', () => {
    expect(() => parseDiagram('{"hello":"world"}')).toThrow(
      'Not a diacraft diagram file'
    );
    expect(() => parseDiagram('[1,2,3]')).toThrow('Not a diagram file');
  });

  it('throws when blocks or arrows are missing', () => {
    expect(() =>
      parseDiagram('{"format":"diacraft-diagram","version":1}')
    ).toThrow('missing blocks or arrows');
  });
});
