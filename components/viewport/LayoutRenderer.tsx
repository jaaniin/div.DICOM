import React from 'react';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { LayoutNode } from '../../utils/types';

interface LayoutRendererProps {
  node: LayoutNode;
  renderViewport: (index: number, nodeId: string) => React.ReactNode;
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

export const LayoutRenderer: React.FC<LayoutRendererProps> = ({ node, renderViewport }) => {
  if (node.type === 'viewport') {
    return (
      <div className="w-full h-full relative overflow-hidden bg-black">
        {renderViewport(node.viewportIndex, node.id)}
      </div>
    );
  }

  const isHorizontal = node.direction === 'horizontal';

  // Calculate proportional default sizes (e.g. 1/3 and 2/3 for 1x3 columns so all 3 viewports have equal 33.33% widths)
  const count0 = countLeavesInDirection(node.children[0], node.direction);
  const count1 = countLeavesInDirection(node.children[1], node.direction);
  const totalCount = count0 + count1;

  const size0 = Number(((count0 / totalCount) * 100).toFixed(3));
  const size1 = Number(((count1 / totalCount) * 100).toFixed(3));

  return (
    <PanelGroup
      orientation={isHorizontal ? 'horizontal' : 'vertical'}
      className="w-full h-full relative"
      onLayoutChanged={() => {
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
        id={`${node.id}_child_0`}
        className="w-full h-full relative overflow-hidden"
      >
        <LayoutRenderer node={node.children[0]} renderViewport={renderViewport} />
      </Panel>

      <PanelResizeHandle
        className={`relative flex items-center justify-center bg-neutral-800 hover:bg-[#3584F5] transition-colors z-30 ${
          isHorizontal
            ? 'w-1.5 cursor-col-resize hover:w-2 -mx-[1px]'
            : 'h-1.5 cursor-row-resize hover:h-2 -my-[1px]'
        }`}
      >
        <div
          className={`rounded-full bg-neutral-500 ${
            isHorizontal ? 'w-0.5 h-6' : 'h-0.5 w-6'
          }`}
        />
      </PanelResizeHandle>

      <Panel
        defaultSize={size1}
        minSize={10}
        id={`${node.id}_child_1`}
        className="w-full h-full relative overflow-hidden"
      >
        <LayoutRenderer node={node.children[1]} renderViewport={renderViewport} />
      </Panel>
    </PanelGroup>
  );
};
