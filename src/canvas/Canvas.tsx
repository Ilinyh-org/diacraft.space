import { Stage, Layer, Rect, Line, Arrow } from 'react-konva';
import { useState, useEffect, useRef, useCallback } from 'react';
import Konva from 'konva';
import { Block } from './Blocks/Block';
import type { BlockType, Side } from './Blocks/Block';
import { useGestureDraw } from './Gestures/useGestureDraw';
import type { Point } from './Gestures/useGestureDraw';
import { gestureToBlock } from '../recognition/gestureToBlock';
import {
  gestureToArrow,
  looksLikeStraightLine,
} from '../recognition/gestureToArrow';

import { useArrows } from './Arrows/useArrows';
import { initialWaypoints } from './Arrows/arrowGeometry';
import { refreshWaypointsAfterBlockMove } from './Arrows/arrowConstraints';

import { ArrowShape } from './Arrows/ArrowShape';
import { SelectedArrowOverlay } from './Arrows/SelectedArrowOverlay';

import { exportPng, exportJpeg, exportSvg } from '../export/exportImage';
import {
  downloadDiagramJson,
  parseDiagram,
} from '../export/diagramJson';


import { useHistory } from '../state/useHistory';
import { loadState, saveState } from '../state/persistence';
import {
  loadThemeName,
  saveThemeName,
  getTheme,
  type ThemeName,
} from '../theme';
import {
  BLOCK_WIDTH,
  BLOCK_HEIGHT,
  GRID_EXTENT,
  PALETTE,
  LABEL_BY_TYPE,
} from './constants';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { BlockData, ArrowData, DiagramState } from './types';
import { getAnchor, pickClosestSide } from './utils/blocks';
import { getContentBBox } from './utils/export';
import { Grid } from './Grid';
import { Palette } from './ui/Palette';
import { ExportPanel } from './ui/ExportPanel';
import { BlockEditInput } from './ui/BlockEditInput';
import { useKeyboard } from './hooks/useKeyboard';

type Mode = 'select' | 'draw';
type ExportMode = null | 'transparent' | 'white';

export function Canvas() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const [themeName, setThemeName] = useState<ThemeName>(() => loadThemeName());
  const theme = getTheme(themeName);

  useEffect(() => {
    saveThemeName(themeName);
  }, [themeName]);

  const [initialState] = useState<DiagramState>(() => {
    const loaded = loadState<DiagramState>({ blocks: [], arrows: [] });
    const migratedArrows = loaded.arrows.map((a) => {
      if (Array.isArray(a.waypoints)) return a;
      const from = loaded.blocks.find((b) => b.id === a.fromBlockId);
      const to = loaded.blocks.find((b) => b.id === a.toBlockId);
      if (!from || !to) return { ...a, waypoints: [] };
      return {
        ...a,
        waypoints: initialWaypoints(from, to, a.fromSide, a.toSide),
      };
    });
    return { ...loaded, arrows: migratedArrows };
  });
  const { state, commit, commitLive, commitCheckpoint, undo, redo, canUndo, canRedo } =
    useHistory<DiagramState>(initialState);
  const { blocks, arrows } = state;

  const [fadingOut, setFadingOut] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedArrowId, setSelectedArrowId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [mode, setMode] = useState<Mode>('select');
  const [exportMode, setExportMode] = useState<ExportMode>(null);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [preview, setPreview] = useState<{
    fromBlockId: string;
    fromSide: Side;
    x: number;
    y: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const dragTypeRef = useRef<BlockType | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const blocksRef = useRef(blocks);
  const arrowsRef = useRef(arrows);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [draggingType, setDraggingType] = useState<BlockType | null>(null);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  useEffect(() => {
    arrowsRef.current = arrows;
  }, [arrows]);

  const handleGestureComplete = useCallback(
    (points: Point[]) => {
      const stageX = stageRef.current?.x() ?? 0;
      const stageY = stageRef.current?.y() ?? 0;
      const canvasPoints = points.map((p) => ({
        x: p.x - stageX,
        y: p.y - stageY,
      }));

      const currentBlocks = blocksRef.current;
      const boxedBlocks = currentBlocks.map((b) => ({
        id: b.id,
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
      }));

      const isLine = looksLikeStraightLine(canvasPoints);

      if (isLine) {
        const arrowResult = gestureToArrow(canvasPoints, boxedBlocks);
        if (arrowResult) {
          const fromBlock = currentBlocks.find(
            (b) => b.id === arrowResult.fromBlockId
          );
          const toBlock = currentBlocks.find(
            (b) => b.id === arrowResult.toBlockId
          );
          if (!fromBlock || !toBlock) return;
          const newArrow: ArrowData = {
            id: crypto.randomUUID(),
            fromBlockId: arrowResult.fromBlockId,
            fromSide: arrowResult.fromSide,
            toBlockId: arrowResult.toBlockId,
            toSide: arrowResult.toSide,
            waypoints: initialWaypoints(
              fromBlock,
              toBlock,
              arrowResult.fromSide,
              arrowResult.toSide
            ),
          };
          commit((s) => ({ ...s, arrows: [...s.arrows, newArrow] }));
        }
        return;
      }

      const result = gestureToBlock([canvasPoints]);
      if (!result) return;

      const newBlock: BlockData = {
        id: crypto.randomUUID(),
        x: result.x,
        y: result.y,
        width: result.width,
        height: result.height,
        label: LABEL_BY_TYPE[result.type],
        type: result.type,
        initialRotation: result.rotation,
      };
      commit((s) => ({ ...s, blocks: [...s.blocks, newBlock] }));
    },
    [commit]
  );

  const trail = useGestureDraw(
    containerRef,
    mode === 'draw',
    handleGestureComplete
  );

  useEffect(() => {
    const update = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const requestDelete = useCallback((id: string) => {
    setFadingOut((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setSelectedId(null);
  }, []);

  const requestDeleteArrow = useCallback(
    (arrowId: string) => {
      commit((s) => ({
        ...s,
        arrows: s.arrows.filter((a) => a.id !== arrowId),
      }));
      setSelectedArrowId(null);
    },
    [commit]
  );

  const handleBlockRemoved = useCallback(
    (id: string) => {
      commit((s) => ({
        blocks: s.blocks.filter((b) => b.id !== id),
        arrows: s.arrows.filter(
          (a) => a.fromBlockId !== id && a.toBlockId !== id
        ),
      }));
      setFadingOut((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [commit]
  );

  const handleStartEdit = useCallback(
    (id: string) => {
      const block = blocks.find((b) => b.id === id);
      if (!block) return;
      setEditingId(id);
      setEditValue(block.label);
    },
    [blocks]
  );

  const handleCommitEdit = useCallback(() => {
    if (!editingId) return;
    const id = editingId;
    const value = editValue.trim();
    setEditingId(null);
    if (!value) return;
    const block = blocks.find((b) => b.id === id);
    if (!block || block.label === value) return;
    commit((s) => ({
      ...s,
      blocks: s.blocks.map((b) => (b.id === id ? { ...b, label: value } : b)),
    }));
  }, [editingId, editValue, blocks, commit]);

  useKeyboard({
    editingId,
    selectedId,
    selectedArrowId,
    onCommitEdit: handleCommitEdit,
    onCancelEdit: () => setEditingId(null),
    onUndo: undo,
    onRedo: redo,
    onDeleteBlock: requestDelete,
    onDeleteArrow: requestDeleteArrow,
  });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragTypeRef.current) return;
      setGhost({ x: e.clientX, y: e.clientY });
    };

    const onUp = (e: PointerEvent) => {
      const type = dragTypeRef.current;
      dragTypeRef.current = null;
      setDraggingType(null);
      setGhost(null);
      if (!type || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const stageX = stageRef.current?.x() ?? 0;
      const stageY = stageRef.current?.y() ?? 0;
      const x = e.clientX - rect.left - stageX;
      const y = e.clientY - rect.top - stageY;

      const item = PALETTE.find((p) => p.type === type);
      if (!item) return;

      const newBlock: BlockData = {
        id: crypto.randomUUID(),
        x: x - BLOCK_WIDTH / 2,
        y: y - BLOCK_HEIGHT / 2,
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        label: item.label,
        type: item.type,
      };
      commit((s) => ({ ...s, blocks: [...s.blocks, newBlock] }));
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [commit]);

  const handlePalettePointerDown = (
    e: React.PointerEvent,
    type: BlockType
  ) => {
    e.preventDefault();
    dragTypeRef.current = type;
    setDraggingType(type);
    setGhost({ x: e.clientX, y: e.clientY });
  };

  const blockDragBeforeRef = useRef<DiagramState | null>(null);

  const handleBlockDragStart = useCallback(() => {
    blockDragBeforeRef.current = state;
  }, [state]);

  const moveBlockAndRefreshArrows = (
    s: DiagramState,
    id: string,
    x: number,
    y: number
  ): DiagramState => {
    const blocks = s.blocks.map((b) => (b.id === id ? { ...b, x, y } : b));
    const arrows = s.arrows.map((ar) => {
      if (ar.fromBlockId !== id && ar.toBlockId !== id) return ar;
      const from = blocks.find((b) => b.id === ar.fromBlockId);
      const to = blocks.find((b) => b.id === ar.toBlockId);
      if (!from || !to) return ar;
      const wps = refreshWaypointsAfterBlockMove(from, to, ar);
      return wps ? { ...ar, waypoints: wps } : ar;
    });
    return { ...s, blocks, arrows };
  };

  const handleBlockDragMove = useCallback(
    (id: string, x: number, y: number) => {
      commitLive((s) => moveBlockAndRefreshArrows(s, id, x, y));
    },
    [commitLive]
  );

  const handleBlockDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      // Ensure final position matches the drop point.
      commitLive((s) => moveBlockAndRefreshArrows(s, id, x, y));
      // One history entry for the whole drag.
      const before = blockDragBeforeRef.current;
      if (before) commitCheckpoint(before);
      blockDragBeforeRef.current = null;
    },
    [commitLive, commitCheckpoint]
  );

  const handleBlockResize = useCallback(
    (id: string, w: number, h: number) => {
      commit((s) => ({
        ...s,
        blocks: s.blocks.map((b) =>
          b.id === id ? { ...b, width: w, height: h } : b
        ),
      }));
    },
    [commit]
  );

  const handleStageClick = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
      setSelectedArrowId(null);
    }
  };

  const handleHandleDragStart = (
    blockId: string,
    side: Side,
    x: number,
    y: number
  ) => {
    setPreview({ fromBlockId: blockId, fromSide: side, x, y });
  };

  const handleHandleDragMove = (x: number, y: number) => {
    setPreview((prev) => (prev ? { ...prev, x, y } : prev));
  };

  const handleHandleDragEnd = (blockId: string, x: number, y: number) => {
    if (!preview) return;
    const side = preview.fromSide;

    const target = blocks.find((b) => {
      if (b.id === blockId) return false;
      return (
        x >= b.x &&
        x <= b.x + b.width &&
        y >= b.y &&
        y <= b.y + b.height
      );
    });

    if (target) {
      const targetSide = pickClosestSide(target, x, y);
      const fromBlock = blocks.find((b) => b.id === blockId);
      if (!fromBlock) {
        setPreview(null);
        return;
      }
      const newArrow: ArrowData = {
        id: crypto.randomUUID(),
        fromBlockId: blockId,
        fromSide: side,
        toBlockId: target.id,
        toSide: targetSide,
        waypoints: initialWaypoints(fromBlock, target, side, targetSide),
      };
      commit((s) => ({ ...s, arrows: [...s.arrows, newArrow] }));
    }
    setPreview(null);
  };

  const { handleAddWaypoint, handleBendDragEnd, handleBendDelete } =
    useArrows(commit);

const runExport = (
  fn: (stage: Konva.Stage) => void | Promise<void>,
  bg: 'transparent' | 'white'
) => {
  setSelectedId(null);
  setSelectedArrowId(null);
  setExportMode(bg);

  setTimeout(async () => {
    const stage = stageRef.current;
    if (!stage) {
      setExportMode(null);
      return;
    }

    const crop = getContentBBox(blocksRef.current, arrowsRef.current);
    if (!crop) {
      await fn(stage);
      setExportMode(null);
      return;
    }

    // Temporarily resize/reposition the Konva stage so the entire
    // content box fits inside the renderable canvas, then restore.
    // This avoids clipping blocks near the viewport edge.
    const prevW = stage.width();
    const prevH = stage.height();
    const prevX = stage.x();
    const prevY = stage.y();

    stage.width(crop.width);
    stage.height(crop.height);
    stage.x(-crop.x);
    stage.y(-crop.y);
    stage.batchDraw();

    try {
      await fn(stage);
    } finally {
      stage.width(prevW);
      stage.height(prevH);
      stage.x(prevX);
      stage.y(prevY);
      stage.batchDraw();
      setExportMode(null);
    }
  }, 150);
};

  const ghostItem = draggingType
    ? PALETTE.find((p) => p.type === draggingType)
    : null;

  const isDrawMode = mode === 'draw';
  const isExporting = exportMode !== null;

  const visibleArrows = arrows.filter(
    (a) => !fadingOut.has(a.fromBlockId) && !fadingOut.has(a.toBlockId)
  );

  const editingBlock = editingId
    ? blocks.find((b) => b.id === editingId)
    : null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        cursor: isDrawMode ? 'crosshair' : 'grab',
        background: theme.canvasBg,
        overflow: 'hidden',
      }}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        x={stagePos.x}
        y={stagePos.y}
        draggable={!isDrawMode && !editingId && !isExporting}
        dragDistance={4}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onMouseDown={isDrawMode ? undefined : handleStageClick}
        onTouchStart={isDrawMode ? undefined : handleStageClick}
      >
        <Layer listening={!isDrawMode && !editingId}>
          {exportMode !== 'transparent' && (
            <Rect
              x={-GRID_EXTENT}
              y={-GRID_EXTENT}
              width={GRID_EXTENT * 2}
              height={GRID_EXTENT * 2}
              fill={exportMode === 'white' ? '#ffffff' : theme.canvasBg}
              listening={false}
            />
          )}

          <Grid visible={!isExporting} color={theme.gridLine} />

          {visibleArrows.map((arrow) => (
            <ArrowShape
              key={arrow.id}
              arrow={arrow}
              blocks={blocks}
              theme={theme}
              isSelected={selectedArrowId === arrow.id}
              listening={!isExporting}
              onClick={() => {
                setSelectedArrowId(arrow.id);
                setSelectedId(null);
              }}
            />
          ))}

          {selectedArrowId &&
            !isExporting &&
            (() => {
              const arrow = arrows.find((a) => a.id === selectedArrowId);
              if (!arrow) return null;
              return (
                <SelectedArrowOverlay
                  arrow={arrow}
                  blocks={blocks}
                  theme={theme}
                  onAddWaypoint={(x, y) => handleAddWaypoint(arrow.id, x, y)}
                  onDeleteArrow={() => requestDeleteArrow(arrow.id)}
                  onBendDragEnd={(idx, x, y) =>
                    handleBendDragEnd(arrow.id, idx, x, y)
                  }
                  onBendDelete={(idx) => handleBendDelete(arrow.id, idx)}
                />
              );
            })()}

          {preview &&
            !isExporting &&
            (() => {
              const from = blocks.find((b) => b.id === preview.fromBlockId);
              if (!from) return null;
              const a = getAnchor(from, preview.fromSide);
              return (
                <Arrow
                  points={[a.x, a.y, preview.x, preview.y]}
                  stroke={theme.selection}
                  fill={theme.selection}
                  strokeWidth={2}
                  pointerLength={10}
                  pointerWidth={10}
                  dash={[6, 4]}
                  listening={false}
                />
              );
            })()}

          {blocks.map((block) => (
            <Block
              key={block.id}
              x={block.x}
              y={block.y}
              width={block.width}
              height={block.height}
              label={block.label}
              type={block.type}
              removing={fadingOut.has(block.id)}
              theme={theme}
              selected={
                selectedId === block.id &&
                !isDrawMode &&
                !isExporting &&
                editingId !== block.id
              }
              onSelect={() => {
                setSelectedId(block.id);
                setSelectedArrowId(null);
              }}
              onDelete={() => requestDelete(block.id)}
              onEdit={() => handleStartEdit(block.id)}
              onResize={(w, h) => handleBlockResize(block.id, w, h)}
              onDragStart={handleBlockDragStart}
              onDragMove={(x, y) => handleBlockDragMove(block.id, x, y)}
              onDragEnd={(x, y) => handleBlockDragEnd(block.id, x, y)}
              onHandleDragStart={(side, x, y) =>
                handleHandleDragStart(block.id, side, x, y)
              }
              onHandleDragMove={handleHandleDragMove}
              onHandleDragEnd={(x, y) => handleHandleDragEnd(block.id, x, y)}
              onRemoved={() => handleBlockRemoved(block.id)}
            />
          ))}

          {isDrawMode && trail.length > 1 && (
            <Line
              points={trail.flatMap((p) => [
                p.x - stagePos.x,
                p.y - stagePos.y,
              ])}
              stroke={theme.selection}
              strokeWidth={2}
              opacity={0.4}
              lineCap="round"
              lineJoin="round"
              tension={0.3}
              listening={false}
            />
          )}
        </Layer>
      </Stage>

      {editingBlock && (
        <BlockEditInput
          theme={theme}
          block={editingBlock}
          stageX={stagePos.x}
          stageY={stagePos.y}
          value={editValue}
          inputRef={editInputRef}
          onChange={setEditValue}
          onCommit={handleCommitEdit}
        />
      )}

      <Palette
        theme={theme}
        themeName={themeName}
        isDrawMode={isDrawMode}
        canUndo={canUndo}
        canRedo={canRedo}
        onToggleTheme={() =>
          setThemeName(themeName === 'dark' ? 'light' : 'dark')
        }
        onToggleMode={() => setMode(isDrawMode ? 'select' : 'draw')}
        onUndo={undo}
        onRedo={redo}
        onPalettePointerDown={handlePalettePointerDown}
      />

      <ExportPanel
        theme={theme}
        onExportPng={() => runExport(exportPng, 'transparent')}
        onExportJpeg={() => runExport(exportJpeg, 'white')}
        onExportSvg={() => runExport(exportSvg, 'transparent')}
        onExportJson={() => downloadDiagramJson(state)}
        onImportJson={(file) => {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const imported = parseDiagram(String(reader.result));
              commit(() => imported);
              setSelectedId(null);
              setSelectedArrowId(null);
              setEditingId(null);
            } catch (err) {
              window.alert(
                `Import failed: ${
                  err instanceof Error ? err.message : 'unknown error'
                }`
              );
            }
          };
          reader.readAsText(file);
        }}
        onClear={() => {
          if (window.confirm('Clear the whole diagram?')) {
            commit(() => ({ blocks: [], arrows: [] }));
            setSelectedId(null);
            setSelectedArrowId(null);
            setEditingId(null);
          }
        }}
      />

      {ghost && ghostItem && (
        <div
          style={{
            position: 'fixed',
            left: ghost.x + 8,
            top: ghost.y + 8,
            padding: '4px 8px',
            background: theme.panelBg,
            border: `1px solid ${theme.buttonBorder}`,
            borderRadius: 4,
            fontSize: 12,
            color: theme.buttonText,
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          {ghostItem.label}
        </div>
      )}
    </div>
  );
}
