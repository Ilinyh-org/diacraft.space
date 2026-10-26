import { Stage, Layer, Rect, Line, Arrow } from 'react-konva';
import { AlignmentGuideLine } from './AlignmentGuideLine';
import { useState, useEffect, useRef, useCallback } from 'react';
import Konva from 'konva';
import { Block } from './Blocks/Block';
import type { BlockType, Side } from './Blocks/Block';
import {
  ConnectionArea,
  CONNECTION_AREA_HIT_RADIUS,
} from './Blocks/ConnectionArea';
import { useGestureDraw } from './Gestures/useGestureDraw';
import type { Point } from './Gestures/useGestureDraw';
import { gestureToBlock } from '../recognition/gestureToBlock';
import {
  gestureToArrow,
  looksLikeStraightLine,
} from '../recognition/gestureToArrow';

import { useArrows } from './Arrows/useArrows';
import { initialWaypoints } from './Arrows/arrowGeometry';
import { translateWaypointsAfterBlockMove } from './Arrows/arrowConstraints';

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
} from './constants';

const BLOCK_LABEL_BY_TYPE: Record<string, TranslationKey> = {
  start: 'block.start',
  action: 'block.action',
  condition: 'block.condition',
  io: 'block.io',
  forloop: 'block.forloop',
  function: 'block.function',
  link: 'block.link',
  text: 'block.text',
};
import type { KonvaEventObject } from 'konva/lib/Node';
import type { BlockData, ArrowData, DiagramState } from './types';
import { findDropTarget, getAnchor, pickClosestSide } from './utils/blocks';
import {
  findAlignmentGuide,
  snapToAlignmentGuide,
  type AlignmentGuide,
} from './utils/alignment';
import { getContentBBox } from './utils/export';
import { Grid } from './Grid';
import { Palette } from './ui/Palette';
import {
  MainMenu,
  INITIAL_MENU_VISIBILITY,
  type MenuId,
  type MenuVisibility,
} from './ui/MainMenu';
import { loadLanguage, saveLanguage, t, type LanguageCode, type TranslationKey } from './ui/i18n';
import { ExportPanel } from './ui/ExportPanel';
import { FeedbackPanel } from './ui/FeedbackPanel';
import { BlockEditInput } from './ui/BlockEditInput';
import {
  AlgorithmPanel,
  stepDelayMs,
  MIN_SPEED,
  MAX_SPEED,
} from './ui/AlgorithmPanel';
import { planAnimation } from './animation/planAnimation';
import { GamePanel } from '../game/GamePanel';
import type { AnimStep } from './animation/planAnimation';
import { useKeyboard } from './hooks/useKeyboard';
import {
  clampStageScale,
  PINCH_SENSITIVITY,
} from './utils/zoom';
import {
  copySelection,
  pasteClipboard,
  keyboardPasteTarget,
  type Clipboard,
} from './utils/clipboard';
import { ContextMenu } from './ui/ContextMenu';
import type { ContextMenuItem } from './ui/ContextMenu';
import {
  toggleBlockSelection,
  toggleArrowSelection,
  computeMultiDragPositions,
  type PositionMap,
} from './utils/selection';

type Mode = 'select' | 'draw';

const CONNECTION_SIDES: Side[] = ['top', 'right', 'bottom', 'left'];
/** Distance from the dragged handle within which a connection area shows. */
const CONNECTION_AREA_NEAR_RADIUS = 60;
type ExportMode = null | 'transparent' | 'white';

export function Canvas() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const [themeName, setThemeName] = useState<ThemeName>(() => loadThemeName());
  const theme = getTheme(themeName);

  const [language, setLanguage] = useState<LanguageCode>(() => loadLanguage());

  useEffect(() => {
    saveLanguage(language);
  }, [language]);

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

  const [menus, setMenus] = useState<MenuVisibility>(INITIAL_MENU_VISIBILITY);
  const toggleMenu = useCallback((id: MenuId) => {
    setMenus((m) => ({ ...m, [id]: !m[id] }));
  }, []);
  const [fadingOut, setFadingOut] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedArrowId, setSelectedArrowId] = useState<string | null>(null);
  const [selectedArrowIds, setSelectedArrowIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [mode, setMode] = useState<Mode>('select');
  const [exportMode, setExportMode] = useState<ExportMode>(null);
  const [animRunning, setAnimRunning] = useState(false);
  const [animSpeed, setAnimSpeed] = useState(5);
  const [gameRunSignal, setGameRunSignal] = useState(0);
  const [gameBlockSignal, setGameBlockSignal] = useState<{
    seq: number;
    blockId: string;
  } | null>(null);
  const gameBlockSeq = useRef(0);
  const [activeBlockIds, setActiveBlockIds] = useState<Set<string>>(new Set());
  const [activeArrowIds, setActiveArrowIds] = useState<Set<string>>(new Set());
  const animTimerRef = useRef<number | null>(null);
  // Issue #142 (fix): the diagram animation pauses at the input block on a
  // password-door level and resumes once the password is submitted.
  const animPausedRef = useRef(false);
  const animResumeRef = useRef<(() => void) | null>(null);

  const setAnimationPaused = useCallback((paused: boolean) => {
    animPausedRef.current = paused;
    if (!paused) {
      const cont = animResumeRef.current;
      if (cont) {
        animResumeRef.current = null;
        animTimerRef.current = window.setTimeout(cont, 50);
      }
    }
  }, []);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  // Issue #82: zoomed-out view. Default view is scale 1; zoom-out only.
  const [stageScale, setStageScale] = useState(1);
  const pinchDistRef = useRef<number | null>(null);
  const pinchingRef = useRef(false);
  // Issue #82 (round 2): stays true from the moment a second finger lands
  // until every finger lifts, so the remaining single finger cannot pan.
  const suppressPanRef = useRef(false);
  const [preview, setPreview] = useState<{
    fromBlockId: string;
    fromSide: Side;
    x: number;
    y: number;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    blockId: string | null;
  } | null>(null);
  const clipboardRef = useRef<Clipboard>({ blocks: [], arrows: [] });
  // Issue #104: last known mouse position (client coords) for Ctrl+V paste.
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);
  const [hasClipboard, setHasClipboard] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const dragTypeRef = useRef<BlockType | null>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
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

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    setSelectedIds([]);
    // Issue #126: clicking empty canvas space must also drop the arrow
    // selection, otherwise Delete would still remove the selected arrow.
    setSelectedArrowId(null);
    setSelectedArrowIds([]);
  }, []);

  const selectBlock = useCallback(
    (id: string, multi: boolean) => {
      // Issue #133: a ctrl-click keeps any selected arrows so blocks and
      // arrows can be selected together; a plain click resets everything.
      if (!multi) {
        setSelectedArrowId(null);
        setSelectedArrowIds([]);
      }
      const next = toggleBlockSelection(selectedIds, selectedId, id, multi);
      setSelectedIds(next.selectedIds);
      setSelectedId(next.selectedId);
    },
    [selectedIds, selectedId]
  );

  const selectArrow = useCallback(
    (id: string, multi: boolean) => {
      if (!multi) {
        setSelectedId(null);
        setSelectedIds([]);
        setSelectedArrowIds([]);
        setSelectedArrowId(id);
        return;
      }
      const next = toggleArrowSelection(
        selectedArrowIds,
        selectedArrowId,
        id,
        true
      );
      setSelectedArrowIds(next.selectedIds);
      setSelectedArrowId(next.selectedId);
    },
    [selectedArrowIds, selectedArrowId]
  );

  /** Currently copied/cuttable selection ids (primary + ctrl-selected). */
  const currentSelectionIds = useCallback(() => {
    const ids = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
    return ids.filter((id) => blocksRef.current.some((b) => b.id === id));
  }, [selectedIds, selectedId]);

  const handleCopy = useCallback(() => {
    const ids = currentSelectionIds();
    if (ids.length === 0 && selectedArrowIds.length === 0) return;
    clipboardRef.current = copySelection(
      blocksRef.current,
      arrowsRef.current,
      ids,
      selectedArrowIds
    );
    if (clipboardRef.current.blocks.length > 0) setHasClipboard(true);
  }, [currentSelectionIds, selectedArrowIds]);

  const handleCut = useCallback(() => {
    const ids = currentSelectionIds();
    if (ids.length === 0 && selectedArrowIds.length === 0) return;
    clipboardRef.current = copySelection(
      blocksRef.current,
      arrowsRef.current,
      ids,
      selectedArrowIds
    );
    if (clipboardRef.current.blocks.length > 0) setHasClipboard(true);
    const removed = new Set(ids);
    const removedArrows = new Set(selectedArrowIds);
    commit((s) => ({
      blocks: s.blocks.filter((b) => !removed.has(b.id)),
      arrows: s.arrows.filter(
        (a) =>
          !removedArrows.has(a.id) &&
          !removed.has(a.fromBlockId) &&
          !removed.has(a.toBlockId)
      ),
    }));
    clearSelection();
  }, [currentSelectionIds, selectedArrowIds, commit, clearSelection]);

  const handlePaste = useCallback(
    (cursor?: { x: number; y: number }) => {
      if (clipboardRef.current.blocks.length === 0) return;
      let center: { x: number; y: number } | undefined;
      if (cursor && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const scale = stageRef.current?.scaleX() ?? 1;
        center = {
          x: (cursor.x - rect.left - (stageRef.current?.x() ?? 0)) / scale,
          y: (cursor.y - rect.top - (stageRef.current?.y() ?? 0)) / scale,
        };
      }
      const pasted = pasteClipboard(clipboardRef.current, center);
      commit((s) => ({
        ...s,
        blocks: [...s.blocks, ...pasted.blocks],
        arrows: [...s.arrows, ...pasted.arrows],
      }));
      setSelectedIds(pasted.blocks.map((b) => b.id));
      setSelectedId(pasted.blocks[pasted.blocks.length - 1]?.id ?? null);
      setSelectedArrowIds(pasted.arrows.map((a) => a.id));
      setSelectedArrowId(
        pasted.arrows.length > 0
          ? pasted.arrows[pasted.arrows.length - 1].id
          : null
      );
    },
    [commit]
  );

  const handleStageContextMenu = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      if (e.target !== e.target.getStage()) return;
      e.evt.preventDefault();
      setContextMenu({
        x: e.evt.clientX,
        y: e.evt.clientY,
        blockId: null,
      });
    },
    []
  );

  const handleBlockContextMenu = useCallback(
    (blockId: string, clientX: number, clientY: number) => {
      // Right-click must not change the selection (issue #42); it only opens
      // the context menu. Cut/Copy operate on the current selection.
      setContextMenu({ x: clientX, y: clientY, blockId });
    },
    []
  );

  const contextMenuItems: ContextMenuItem[] = contextMenu?.blockId
    ? [
        { label: t(language, 'context.cut'), onSelect: handleCut },
        { label: t(language, 'context.copy'), onSelect: handleCopy },
        {
          label: t(language, 'context.rename'),
          onSelect: () => {
            if (contextMenu?.blockId) handleStartEdit(contextMenu.blockId);
          },
        },
        {
          label: t(language, 'context.delete'),
          onSelect: () => {
            if (contextMenu?.blockId) requestDelete(contextMenu.blockId);
          },
        },
      ]
    : [
        {
          label: t(language, 'context.copy'),
          disabled: selectedIds.length === 0,
          onSelect: handleCopy,
        },
        {
          label: t(language, 'context.paste'),
          disabled: !hasClipboard,
          onSelect: () =>
            handlePaste(
              contextMenu ? { x: contextMenu.x, y: contextMenu.y } : undefined
            ),
        },
      ];

  const handleGestureComplete = useCallback(
    (strokes: Point[][]) => {
      const stage = stageRef.current;
      const stageX = stage?.x() ?? 0;
      const stageY = stage?.y() ?? 0;
      const scale = stage?.scaleX() ?? 1;
      const canvasStrokes = strokes.map((stroke) =>
        stroke.map((p) => ({
          x: (p.x - stageX) / scale,
          y: (p.y - stageY) / scale,
        }))
      );

      const currentBlocks = blocksRef.current;
      const boxedBlocks = currentBlocks.map((b) => ({
        id: b.id,
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
      }));

      const isLine =
        canvasStrokes.length === 1 && looksLikeStraightLine(canvasStrokes[0]);

      if (isLine) {
        const arrowResult = gestureToArrow(canvasStrokes[0], boxedBlocks);
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

      const result = gestureToBlock(canvasStrokes);
      if (!result) return;

      const newBlock: BlockData = {
        id: crypto.randomUUID(),
        x: result.x,
        y: result.y,
        width: result.width,
        height: result.height,
        label: t(language, BLOCK_LABEL_BY_TYPE[result.type]),
        type: result.type,
        initialRotation: result.rotation,
      };
      commit((s) => ({ ...s, blocks: [...s.blocks, newBlock] }));
    },
    [commit, language]
  );

  /** Issue #82: wheel zoom, anchored at the pointer position. */
  const handleStageWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const oldScale = stage.scaleX();
      const newScale = clampStageScale(
        oldScale * (e.evt.deltaY > 0 ? 0.9 : 1.1)
      );
      if (newScale === oldScale) return;
      const world = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };
      setStageScale(newScale);
      setStagePos({
        x: pointer.x - world.x * newScale,
        y: pointer.y - world.y * newScale,
      });
    },
    []
  );

  /** Issue #82: when a second finger lands, zoom takes over from panning. */
  const handleStagePinchStart = useCallback(
    (e: KonvaEventObject<TouchEvent>) => {
      const evt = e.evt;
      const stage = stageRef.current;
      if (!stage || evt.touches.length < 2) return;
      evt.preventDefault();
      suppressPanRef.current = true;
      pinchDistRef.current = null;
      pinchingRef.current = true;
      if (stage.isDragging()) stage.stopDrag();
    },
    []
  );

  /** Issue #82: pinch-to-zoom on touch screens, anchored at the pinch center. */
  const handleStageTouchMove = useCallback(
    (e: KonvaEventObject<TouchEvent>) => {
      const evt = e.evt;
      const stage = stageRef.current;
      if (!stage) return;
      // While a two-finger gesture is active, a remaining single finger must
      // not pan the view until every finger has lifted.
      if (evt.touches.length === 1 && suppressPanRef.current) {
        evt.preventDefault();
        if (stage.isDragging()) stage.stopDrag();
        return;
      }
      if (evt.touches.length !== 2) {
        pinchDistRef.current = null;
        pinchingRef.current = false;
        return;
      }
      evt.preventDefault();
      const t1 = evt.touches[0];
      const t2 = evt.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const lastDist = pinchDistRef.current;
      pinchDistRef.current = dist;
      pinchingRef.current = true;
      // Two fingers mean zoom, not canvas panning.
      if (stage.isDragging()) stage.stopDrag();
      if (!lastDist || dist === lastDist) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const oldScale = stage.scaleX();
      // Issue #82 (round 2): amplify the raw pinch ratio so the zoom reacts
      // more sensitively to small two-finger movements.
      const raw = dist / lastDist;
      const boosted = 1 + (raw - 1) * PINCH_SENSITIVITY;
      if (boosted <= 0) return;
      const newScale = clampStageScale(oldScale * boosted);
      if (newScale === oldScale) return;
      const centerX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const centerY = (t1.clientY + t2.clientY) / 2 - rect.top;
      const world = {
        x: (centerX - stage.x()) / oldScale,
        y: (centerY - stage.y()) / oldScale,
      };
      setStageScale(newScale);
      setStagePos({
        x: centerX - world.x * newScale,
        y: centerY - world.y * newScale,
      });
    },
    []
  );

  const handleStageTouchEnd = useCallback(
    (e: KonvaEventObject<TouchEvent>) => {
      // Only release the pan suppression once every finger has lifted.
      if (e.evt.touches.length === 0) {
        pinchDistRef.current = null;
        pinchingRef.current = false;
        suppressPanRef.current = false;
      }
    },
    []
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

  const stopAnimation = useCallback(() => {
    if (animTimerRef.current !== null) {
      window.clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
    animPausedRef.current = false;
    animResumeRef.current = null;
    setAnimRunning(false);
    setActiveBlockIds(new Set());
    setActiveArrowIds(new Set());
  }, []);

  useEffect(() => {
    return () => {
      if (animTimerRef.current !== null) {
        window.clearTimeout(animTimerRef.current);
      }
    };
  }, []);

  const runAnimation = useCallback(() => {
    if (animTimerRef.current !== null) {
      window.clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
    const steps: AnimStep[] = planAnimation(
      blocksRef.current,
      arrowsRef.current
    );
    if (steps.length === 0) return;

    setAnimRunning(true);
    setSelectedId(null);
    setSelectedIds([]);
    setSelectedArrowId(null);
    setActiveBlockIds(new Set());
    setActiveArrowIds(new Set());

    const stepDelay = stepDelayMs(animSpeed);
    const runStep = (index: number, blocksOn: Set<string>, arrowsOn: Set<string>) => {
      // Issue #142 (fix): while paused at the input block, park the next
      // step and wait until the game reports the password was submitted.
      if (index < steps.length && animPausedRef.current) {
        animResumeRef.current = () => runStep(index, blocksOn, arrowsOn);
        return;
      }
      if (index >= steps.length) {
        animTimerRef.current = window.setTimeout(() => {
          animTimerRef.current = null;
          setAnimRunning(false);
          setActiveBlockIds(new Set());
          setActiveArrowIds(new Set());
        }, stepDelay);
        return;
      }
      const step = steps[index];
      if (step.kind === 'block') {
        blocksOn = new Set(blocksOn);
        blocksOn.add(step.id);
        setActiveBlockIds(blocksOn);
        gameBlockSeq.current += 1;
        setGameBlockSignal({ seq: gameBlockSeq.current, blockId: step.id });
      } else {
        arrowsOn = new Set(arrowsOn);
        arrowsOn.add(step.id);
        setActiveArrowIds(arrowsOn);
      }
      animTimerRef.current = window.setTimeout(
        () => runStep(index + 1, blocksOn, arrowsOn),
        stepDelay
      );
    };
    animTimerRef.current = window.setTimeout(
      () => runStep(0, new Set(), new Set()),
      stepDelay
    );
  }, [animSpeed]);

  const requestDelete = useCallback((id: string) => {
    setFadingOut((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setSelectedId(null);
    setSelectedIds((prev) => prev.filter((b) => b !== id));
  }, []);

  const requestDeleteArrow = useCallback(
    (arrowId: string) => {
      commit((s) => ({
        ...s,
        arrows: s.arrows.filter((a) => a.id !== arrowId),
      }));
      setSelectedArrowId(null);
      setSelectedArrowIds((prev) => prev.filter((a) => a !== arrowId));
    },
    [commit]
  );

  /** Issue #133: delete the whole mixed block+arrow selection at once. */
  const handleDeleteSelection = useCallback(() => {
    const ids = currentSelectionIds();
    if (selectedArrowIds.length > 0) {
      const removed = new Set(selectedArrowIds);
      commit((s) => ({
        ...s,
        arrows: s.arrows.filter((a) => !removed.has(a.id)),
      }));
      setSelectedArrowId(null);
      setSelectedArrowIds([]);
    }
    if (ids.length > 0) {
      setFadingOut((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          next.add(id);
        }
        return next;
      });
      setSelectedId(null);
      setSelectedIds((prev) => prev.filter((b) => !ids.includes(b)));
    }
  }, [selectedArrowIds, currentSelectionIds, commit]);

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
    selectedArrowIds,
    onCommitEdit: handleCommitEdit,
    onCancelEdit: () => setEditingId(null),
    onUndo: undo,
    onRedo: redo,
    onDeleteBlock: requestDelete,
    onDeleteArrow: requestDeleteArrow,
    onDeleteSelection: handleDeleteSelection,
    onCopy: handleCopy,
    onCut: handleCut,
    onPaste: () => {
      // Issue #104: paste at the exact mouse cursor when it is over the
      // canvas; otherwise paste at the center of the visible view.
      const rect = containerRef.current?.getBoundingClientRect() ?? null;
      const target = keyboardPasteTarget(lastMouseRef.current, rect);
      handlePaste(target ?? undefined);
    },
  });

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('pointermove', onPointerMove);
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, []);

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
      const stage = stageRef.current;
      const stageX = stage?.x() ?? 0;
      const stageY = stage?.y() ?? 0;
      const scale = stage?.scaleX() ?? 1;
      const x = (e.clientX - rect.left - stageX) / scale;
      const y = (e.clientY - rect.top - stageY) / scale;

      const item = PALETTE.find((p) => p.type === type);
      if (!item) return;

      const newBlock: BlockData = {
        id: crypto.randomUUID(),
        x: x - BLOCK_WIDTH / 2,
        y: y - BLOCK_HEIGHT / 2,
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        // Issue #77: the default label must follow the selected language.
        label: t(language, BLOCK_LABEL_BY_TYPE[item.type]),
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
  }, [commit, language]);

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
  // Issue #116: active alignment guide while dragging a block.
  const [alignmentGuide, setAlignmentGuide] = useState<AlignmentGuide | null>(
    null
  );

  const handleBlockDragStart = useCallback(
    (id: string) => {
      blockDragBeforeRef.current = state;
      // Issue #138: capture every selected block's position (plus the dragged
      // one) so the whole selection can follow the dragged block.
      const ids = new Set(
        selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : []
      );
      ids.add(id);
      const map: PositionMap = {};
      for (const b of state.blocks) {
        if (ids.has(b.id)) map[b.id] = { x: b.x, y: b.y };
      }
      multiDragStartRef.current = map;
    },
    [state, selectedIds, selectedId]
  );

  const multiDragStartRef = useRef<PositionMap>({});

  // Issue #138: move a whole set of blocks and refresh arrows attached to any
  // of them (waypoints of arrows between two moved blocks translate intact).
  const moveBlocksAndRefreshArrows = (
    s: DiagramState,
    positions: PositionMap
  ): DiagramState => {
    const ids = new Set(Object.keys(positions));
    const blocks = s.blocks.map((b) =>
      ids.has(b.id) ? { ...b, ...positions[b.id] } : b
    );
    const arrows = s.arrows.map((ar) => {
      if (!ids.has(ar.fromBlockId) && !ids.has(ar.toBlockId)) return ar;
      const prevFrom = s.blocks.find((b) => b.id === ar.fromBlockId);
      const prevTo = s.blocks.find((b) => b.id === ar.toBlockId);
      const nextFrom = blocks.find((b) => b.id === ar.fromBlockId);
      const nextTo = blocks.find((b) => b.id === ar.toBlockId);
      if (!prevFrom || !prevTo || !nextFrom || !nextTo) return ar;
      // Issue #102: bends are static after creation — translate, never
      // re-route, so the waypoint count (== bend count) never changes.
      const wps = translateWaypointsAfterBlockMove(
        prevFrom,
        prevTo,
        nextFrom,
        nextTo,
        ar
      );
      return { ...ar, waypoints: wps };
    });
    return { ...s, blocks, arrows };
  };

  const handleBlockDragMove = useCallback(
    (id: string, x: number, y: number) => {
      const start = multiDragStartRef.current[id];
      if (start) {
        // Issue #138: drag the whole selection with the dragged block.
        const positions = computeMultiDragPositions(
          multiDragStartRef.current,
          id,
          x,
          y
        );
        commitLive((s) => moveBlocksAndRefreshArrows(s, positions));
      } else {
        commitLive((s) =>
          moveBlocksAndRefreshArrows(s, { [id]: { x, y } })
        );
      }
      // Issue #116: show an alignment guide while centers match.
      setAlignmentGuide(
        findAlignmentGuide(blocksRef.current, id, x, y)
      );
    },
    [commitLive]
  );

  const handleBlockDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      // Issue #116: dropping while a guide is visible snaps the block.
      let finalX = x;
      let finalY = y;
      if (alignmentGuide) {
        const dragged = blocksRef.current.find((b) => b.id === id);
        if (dragged) {
          const snapped = snapToAlignmentGuide(
            dragged,
            x,
            y,
            alignmentGuide
          );
          finalX = snapped.x;
          finalY = snapped.y;
        }
      }
      setAlignmentGuide(null);
      const start = multiDragStartRef.current[id];
      if (start) {
        // Issue #138: finish the whole-selection drag at the drop point
        // (including the alignment-guide snap delta, applied to everything).
        const snappedDrag = computeMultiDragPositions(
          multiDragStartRef.current,
          id,
          finalX,
          finalY
        );
        // Snap delta relative to the un-snapped drop point applies to all.
        const dx = snappedDrag[id].x - (start.x + (finalX - start.x));
        const dy = snappedDrag[id].y - (start.y + (finalY - start.y));
        const positions: PositionMap = {};
        for (const [bid, p] of Object.entries(
          computeMultiDragPositions(
            multiDragStartRef.current,
            id,
            x,
            y
          )
        )) {
          positions[bid] = { x: p.x + dx, y: p.y + dy };
        }
        commitLive((s) => moveBlocksAndRefreshArrows(s, positions));
      } else {
        // Ensure final position matches the drop point.
        commitLive((s) =>
          moveBlocksAndRefreshArrows(s, { [id]: { x: finalX, y: finalY } })
        );
      }
      // One history entry for the whole drag.
      const before = blockDragBeforeRef.current;
      if (before) commitCheckpoint(before);
      blockDragBeforeRef.current = null;
    },
    [commitLive, commitCheckpoint, alignmentGuide]
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
    // Right-click must not change the selection (issue #42).
    if (
      "button" in e.evt &&
      (e.evt as MouseEvent).button === 2
    )
      return;
    if (e.target === e.target.getStage()) {
      clearSelection();
    }
  };

  const handleStageTouchStart = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    handleStagePinchStart(e as KonvaEventObject<TouchEvent>);
    if (!isDrawMode) handleStageClick(e);
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

    const target = findDropTarget(
      blocks,
      blockId,
      x,
      y,
      CONNECTION_AREA_HIT_RADIUS
    );

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
  setSelectedIds([]);
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
        // Issue #82: without this the browser's native pinch-zoom captures
        // two-finger gestures before Konva's touch handlers can zoom the stage.
        touchAction: 'none',
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
        scaleX={stageScale}
        scaleY={stageScale}
        draggable={!isDrawMode && !editingId && !isExporting}
        dragDistance={4}
        onDragEnd={(e) => {
          if (e.target === stageRef.current && !pinchingRef.current) {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onMouseDown={isDrawMode ? undefined : handleStageClick}
        onTouchStart={isDrawMode ? handleStagePinchStart : handleStageTouchStart}
        onTouchMove={handleStageTouchMove}
        onTouchEnd={handleStageTouchEnd}
        onWheel={handleStageWheel}
        onContextMenu={isDrawMode ? undefined : handleStageContextMenu}
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
              isSelected={
                selectedArrowId === arrow.id ||
                selectedArrowIds.includes(arrow.id)
              }
              isHighlighted={animRunning && activeArrowIds.has(arrow.id)}
              listening={!isExporting}
              onClick={(multi) => selectArrow(arrow.id, multi)}
            />
          ))}

          {selectedArrowId &&
            selectedArrowIds.length <= 1 &&
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
              highlighted={animRunning && activeBlockIds.has(block.id)}
              theme={theme}
              selected={
                (selectedIds.includes(block.id) || selectedId === block.id) &&
                !isDrawMode &&
                !isExporting &&
                editingId !== block.id
              }
              onSelect={(multi) => selectBlock(block.id, multi)}
              onDelete={() => requestDelete(block.id)}
              onEdit={() => handleStartEdit(block.id)}
              onResize={(w, h) => handleBlockResize(block.id, w, h)}
              onDragStart={() => handleBlockDragStart(block.id)}
              onDragMove={(x, y) => handleBlockDragMove(block.id, x, y)}
              onDragEnd={(x, y) => handleBlockDragEnd(block.id, x, y)}
              onHandleDragStart={(side, x, y) =>
                handleHandleDragStart(block.id, side, x, y)
              }
              onHandleDragMove={handleHandleDragMove}
              onHandleDragEnd={(x, y) => handleHandleDragEnd(block.id, x, y)}
              onContextMenu={(cx, cy) => handleBlockContextMenu(block.id, cx, cy)}
              onRemoved={() => handleBlockRemoved(block.id)}
            />
          ))}

          {/* Connection areas render in front of the blocks so the animated
              dashed circles stay visible over block edges. */}
          {preview &&
            !isExporting &&
            blocks
              .filter((b) => b.id !== preview.fromBlockId)
              .flatMap((block) =>
                CONNECTION_SIDES.map((side) => {
                  const anchor = getAnchor(block, side);
                  const near =
                    Math.hypot(
                      preview.x - anchor.x,
                      preview.y - anchor.y
                    ) <= CONNECTION_AREA_NEAR_RADIUS;
                  return (
                    <ConnectionArea
                      key={`${block.id}:${side}`}
                      x={anchor.x}
                      y={anchor.y}
                      theme={theme}
                      visible={near}
                    />
                  );
                }),
              )}

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

          {isDrawMode && trail.length > 1 && (
            <Line
              points={trail.flatMap((p) => [
                (p.x - stagePos.x) / stageScale,
                (p.y - stagePos.y) / stageScale,
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

          {/* Issue #116 rework: guide line drawn in front of the blocks,
              with animated dashes. */}
          {alignmentGuide && !isExporting && (
            <AlignmentGuideLine guide={alignmentGuide} />
          )}
        </Layer>
      </Stage>

      {editingBlock && (
        <BlockEditInput
          theme={theme}
          block={editingBlock}
          stageX={stagePos.x}
          stageY={stagePos.y}
          stageScale={stageScale}
          value={editValue}
          inputRef={editInputRef}
          onChange={setEditValue}
          onCommit={handleCommitEdit}
        />
      )}

      <MainMenu
        theme={theme}
        visibility={menus}
        onToggle={toggleMenu}
        language={language}
        onLanguageChange={setLanguage}
        themeName={themeName}
        onToggleTheme={() =>
          setThemeName(themeName === 'dark' ? 'light' : 'dark')
        }
      />

      {menus.palette && (
        <Palette
        theme={theme}
        language={language}
        isDrawMode={isDrawMode}
        canUndo={canUndo}
        canRedo={canRedo}
        onToggleMode={() => setMode(isDrawMode ? 'select' : 'draw')}
        onUndo={undo}
        onRedo={redo}
        onPalettePointerDown={handlePalettePointerDown}
        onClear={() => {
          if (window.confirm(t(language, 'palette.confirmClear'))) {
            stopAnimation();
            commit(() => ({ blocks: [], arrows: [] }));
            setSelectedId(null);
            setSelectedIds([]);
            setSelectedArrowId(null);
            setEditingId(null);
          }
        }}
        />
      )}

      {menus.export && (
        <ExportPanel
        theme={theme}
        language={language}
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
              setSelectedIds([]);
              setSelectedArrowId(null);
              setEditingId(null);
            } catch (err) {
              window.alert(
                t(language, 'export.importFailed', {
                  message:
                    err instanceof Error
                      ? err.message
                      : t(language, 'export.unknownError'),
                }),
              );
            }
          };
          reader.readAsText(file);
        }}
        />
      )}

      {menus.algorithm && (
        <AlgorithmPanel
          theme={theme}
          language={language}
          running={animRunning}
          speed={animSpeed}
          onRun={() => {
            runAnimation();
            setGameRunSignal((s) => s + 1);
          }}
          onStop={stopAnimation}
          onSpeedChange={(s) =>
            setAnimSpeed(
              Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(s)))
            )
          }
        />
      )}

      {menus.game && (
        <GamePanel
          theme={theme}
          language={language}
          blocks={blocks}
          arrows={arrows}
          runSignal={gameRunSignal}
          blockSignal={gameBlockSignal}
              speed={animSpeed}
          onRunDiagram={runAnimation}
          onAwaitInput={setAnimationPaused}
        />
      )}

      {menus.feedback && <FeedbackPanel theme={theme} language={language} />}

      {contextMenu && !isExporting && (
        <ContextMenu
          theme={theme}
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

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
