import React from 'react';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle, Layout } from 'react-resizable-panels';
import { LayoutNode } from '../../utils/types';

export interface PanelSizes {
  size0: number;
  size1: number;
}

interface LayoutRendererProps {
  node: LayoutNode;
  renderViewport: (index: number, nodeId: string) => React.ReactNode;
  panelSizesMap?: Map<string, PanelSizes>;
  onSavePanelSizes?: (nodeId: string, sizes: PanelSizes) => void;
}

/**
 * Counts the number of leaf viewports in a subtree along a specific split direction.
 * If a child is an orthogonal split or a single viewport, it counts as 1 column/row.
 */
const countLeavesInDirection = (node: LayoutNode, direction: 'horizontal' | 'vertical'): number => {
  if (node.type === 'viewport') return 1;
  if (node.direction === direction) {
    return (
      countLeavesInDirection(node.children[0], direction) +
      countLeavesInDirection(node.children[1], direction)
    );
  }
  return 1;
};

export const LayoutRenderer: React.FC<LayoutRendererProps> = ({
  node,
  renderViewport,
  panelSizesMap,
  onSavePanelSizes,
}) => {
  if (node.type === 'viewport') {
    return (
      <div className="w-full h-full relative overflow-hidden bg-black">
        {renderViewport(node.viewportIndex, node.id)}
      </div>
    );
  }

  const isHorizontal = node.direction === 'horizontal';

  // Calculate proportional default sizes or load saved custom split sizes
  const count0 = countLeavesInDirection(node.children[0], node.direction);
  const count1 = countLeavesInDirection(node.children[1], node.direction);
  const totalCount = count0 + count1;

  const defaultSize0 = Number(((count0 / totalCount) * 100).toFixed(3));
  const defaultSize1 = Number(((count1 / totalCount) * 100).toFixed(3));

  const savedSizes = panelSizesMap?.get(node.id);
  const size0 = savedSizes && typeof savedSizes.size0 === 'number' ? savedSizes.size0 : defaultSize0;
  const size1 = savedSizes && typeof savedSizes.size1 === 'number' ? savedSizes.size1 : defaultSize1;

  const child0Id = `${node.id}_child_0`;
  const child1Id = `${node.id}_child_1`;

  return (
    <PanelGroup
      orientation={isHorizontal ? 'horizontal' : 'vertical'}
      className="w-full h-full relative"
      defaultLayout={{
        [child0Id]: size0,
        [child1Id]: size1,
      }}
      onLayoutChanged={(layout: Layout) => {
        if (layout) {
          const s0 = layout[child0Id];
          const s1 = layout[child1Id];
          if (typeof s0 === 'number' && typeof s1 === 'number') {
            onSavePanelSizes?.(node.id, { size0: s0, size1: s1 });
          }
        }
        if (typeof window !== 'undefined') {
          import('cornerstone-core').then((cs) => {
            const cornerstone = cs.default || cs;
            document.querySelectorAll('.cornerstone-canvas').forEach((canvas) => {
              const parent = canvas.parentElement;
              if (parent) {
                try {
                  cornerstone.resize(parent);
                } catch (e) {}
              }
            });
          });
        }
      }}
    >
      <Panel
        defaultSize={size0}
        minSize={10}
        id={child0Id}
        className="w-full h-full relative overflow-hidden"
      >
        <LayoutRenderer
          node={node.children[0]}
          renderViewport={renderViewport}
          panelSizesMap={panelSizesMap}
          onSavePanelSizes={onSavePanelSizes}
        />
      </Panel>

      <PanelResizeHandle
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        className={`relative flex items-center justify-center bg-neutral-800 hover:bg-[#3584F5] transition-colors z-40 select-none ${
          isHorizontal
            ? 'w-1 cursor-col-resize before:absolute before:inset-y-0 before:-inset-x-2 before:z-40'
            : 'h-1 cursor-row-resize before:absolute before:inset-x-0 before:-inset-y-2 before:z-40'
        }`}
      >
        <div
          className={`rounded-full bg-neutral-500/70 pointer-events-none ${
            isHorizontal ? 'w-0.5 h-6' : 'h-0.5 w-6'
          }`}
        />
      </PanelResizeHandle>

      <Panel
        defaultSize={size1}
        minSize={10}
        id={child1Id}
        className="w-full h-full relative overflow-hidden"
      >
        <LayoutRenderer
          node={node.children[1]}
          renderViewport={renderViewport}
          panelSizesMap={panelSizesMap}
          onSavePanelSizes={onSavePanelSizes}
        />
      </Panel>
    </PanelGroup>
  );
};
