import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface PromptVisualizerProps {
  markdown: string;
  onClose: () => void;
}

interface TreeNode {
  name: string;
  children?: TreeNode[];
  value?: number;
}

const PromptVisualizer: React.FC<PromptVisualizerProps> = ({ markdown, onClose }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // 1. Parse Markdown to Tree Structure
  const parseMarkdownToTree = (md: string): TreeNode => {
    const lines = md.split('\n');
    const root: TreeNode = { name: "System Prompt", children: [] };
    const stack: { node: TreeNode; level: number }[] = [{ node: root, level: 0 }];

    lines.forEach(line => {
      const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const text = headerMatch[2].trim();
        
        const newNode: TreeNode = { name: text, children: [] };

        // Find parent
        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }
        
        if (stack.length > 0) {
          const parent = stack[stack.length - 1].node;
          if (!parent.children) parent.children = [];
          parent.children.push(newNode);
        }
        
        stack.push({ node: newNode, level });
      } else {
          // Optional: Add list items as leaf nodes if you want detailed view
          // Keeping it high-level for now
      }
    });

    // Clean up empty children arrays
    const cleanTree = (node: TreeNode) => {
        if (node.children && node.children.length === 0) {
            delete node.children;
            node.value = 1;
        } else if (node.children) {
            node.children.forEach(cleanTree);
        }
    };
    cleanTree(root);
    return root;
  };

  useEffect(() => {
    if (!markdown || !svgRef.current || !containerRef.current) return;

    const data = parseMarkdownToTree(markdown);
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
        .attr("viewBox", [-width / 2, -height / 2, width, height])
        .style("font", "12px sans-serif")
        .style("user-select", "none");

    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom);

    // Tree Layout
    const root = d3.hierarchy(data);
    
    // Dynamic tree size based on node count
    const nodeCount = root.descendants().length;
    const radius = Math.max(width, height) / 2 + (nodeCount * 5); 

    const tree = d3.tree<TreeNode>()
        .size([2 * Math.PI, radius * 0.8])
        .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);

    tree(root);

    // Links
    g.append("g")
      .attr("fill", "none")
      .attr("stroke", "#555")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", 1.5)
      .selectAll("path")
      .data(root.links())
      .join("path")
      .attr("d", d3.linkRadial<any, any>()
          .angle(d => d.x)
          .radius(d => d.y));

    // Nodes
    const node = g.append("g")
      .selectAll("g")
      .data(root.descendants())
      .join("g")
      .attr("transform", d => `
        rotate(${d.x * 180 / Math.PI - 90})
        translate(${d.y},0)
      `);

    node.append("circle")
      .attr("fill", d => d.children ? "#3b82f6" : "#999")
      .attr("r", 4);

    node.append("text")
      .attr("dy", "0.31em")
      .attr("x", d => d.x < Math.PI === !d.children ? 6 : -6)
      .attr("text-anchor", d => d.x < Math.PI === !d.children ? "start" : "end")
      .attr("transform", d => d.x >= Math.PI ? "rotate(180)" : null)
      .text(d => d.data.name.length > 25 ? d.data.name.substring(0, 25) + '...' : d.data.name)
      .clone(true).lower()
      .attr("stroke", "black")
      .attr("stroke-width", 3);
      
    node.selectAll("text")
       .attr("fill", "white");

    // Center the view initially
    svg.call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(0.8));

  }, [markdown]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-5xl h-[80vh] bg-[#1C1C1E] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#2C2C2E]">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center text-blue-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-white">Структура Промпта</h3>
                    <p className="text-xs text-gray-400">Визуализация логических блоков</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        {/* Graph Area */}
        <div ref={containerRef} className="flex-1 w-full relative bg-[#121212] overflow-hidden cursor-move active:cursor-grabbing">
            <svg ref={svgRef} className="w-full h-full"></svg>
            <div className="absolute bottom-4 left-4 bg-[#2C2C2E] px-3 py-1 rounded-full text-xs text-gray-400 border border-white/5 pointer-events-none">
                Zoom: {Math.round(zoomLevel * 100)}%
            </div>
        </div>
      </div>
    </div>
  );
};

export default PromptVisualizer;
