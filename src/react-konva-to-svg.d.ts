declare module 'react-konva-to-svg' {
  import type Konva from 'konva';
  export function exportStageSVG(
    stage: Konva.Stage,
    toImage?: boolean
  ): Promise<string>;
}
