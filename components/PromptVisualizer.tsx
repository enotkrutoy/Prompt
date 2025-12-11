import React, { useEffect, useRef, useState, useMemo } from 'react';
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
  const [viewMode, setViewMode] = useState<'graph' | 'code'>('graph');
  const [copyFeedback, setCopyFeedback] = useState(false);

  // 1. Parse Markdown to Tree Structure (Memoized)
  const treeData = useMemo(() => {
    const lines = mdToLines(markdown);
    // Root node
    const root: TreeNode = { name: "System Prompt", children: [] };
    const stack: { node: TreeNode; level: number }[] = [{ node: root, level: 0 }];

    lines.forEach(line => {
      // Matches headings like #, ##, ###
      const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const text = headerMatch[2].trim();
        
        const newNode: TreeNode = { name: text, children: [] };

        // Find correct parent level
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
         // Optional: Add non-header text as leaf nodes if needed? 
         // For now, keeping structure clean based on headers for System Prompts.
      }
    });

    // Clean up empty children arrays to make D3 treat them as leaves
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
  }, [markdown]);

  function mdToLines(md: string) {
      return md.split('\n');
  }

  // 2. D3 Rendering Logic
  useEffect(() => {
    if (viewMode !== 'graph' || !treeData || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
        .attr("viewBox", [-width / 2, -height / 2, width, height])
        .style("font-family", "'Inter', sans-serif")
        .style("user-select", "none");

    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom);

    // Tree Layout
    const hierarchy = d3.hierarchy(treeData);
    
    // Dynamic sizing
    const nodeCount = hierarchy.descendants().length;
    const radius = Math.max(width, height) / 2 + (nodeCount * 5); 

    const treeLayout = d3.tree<TreeNode>()
        .size([2 * Math.PI, radius * 0.85])
        .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);

    const root = treeLayout(hierarchy) as d3.HierarchyPointNode<TreeNode>;

    // Links
    g.append("g")
      .attr("fill", "none")
      .attr("stroke", "#555")
      .attr("stroke-opacity", 0.3)
      .attr("stroke-width", 1.5)
      .selectAll("path")
      .data(root.links())
      .join("path")
      .attr("d", d3.linkRadial<d3.HierarchyPointNode<TreeNode>, d3.HierarchyPointNode<TreeNode>>()
          .angle(d => d.x)
          .radius(d => d.y));

    // Nodes Group
    const node = g.append("g")
      .selectAll("g")
      .data(root.descendants())
      .join("g")
      .attr("transform", d => `
        rotate(${d.x * 180 / Math.PI - 90})
        translate(${d.y},0)
      `)
      .attr("cursor", "pointer")
      // --- IMPROVED CLICK TO CENTER LOGIC ---
      .on("click", (event, d) => {
        event.stopPropagation();
        
        // 1. Calculate Cartesian coordinates of the node
        // d.x is angle (radians), d.y is radius
        const a = d.x - Math.PI / 2;
        const r = d.y;
        const x = r * Math.cos(a);
        const y = r * Math.sin(a);

        // 2. Determine Scale
        // Deeper nodes need more zoom
        const targetZoom = Math.max(1.2, Math.min(3.5, d.depth * 0.8 + 1));

        // 3. Create Transform
        // We want to translate such that point (x,y) moves to center (0,0) AFTER scaling.
        // Formula: translate(-x*k, -y*k) scale(k)
        const t = d3.zoomIdentity
            .translate(-x * targetZoom, -y * targetZoom)
            .scale(targetZoom);

        svg.transition()
           .duration(800)
           .ease(d3.easeCubicOut)
           .call(zoom.transform, t);
      });

    // Node Circles
    node.append("circle")
      .attr("fill", d => d.children ? "#3b82f6" : "#1C1C1E") // Parent: Blue, Leaf: Dark
      .attr("r", d => d.children ? 6 : 4)
      .attr("stroke", d => d.children ? "#60a5fa" : "#555") // Stroke color
      .attr("stroke-width", d => d.children ? 0 : 2) // Leaf has thicker stroke
      .style("filter", "drop-shadow(0px 0px 4px rgba(0,0,0,0.8))") // Shadow
      .on("mouseover", function(event, d) { 
          d3.select(this)
            .transition().duration(200)
            .attr("r", d.children ? 9 : 7)
            .attr("fill", "#60a5fa")
            .attr("stroke", "#fff");
      })
      .on("mouseout", function(event, d) { 
          d3.select(this)
            .transition().duration(200)
            .attr("r", d.children ? 6 : 4)
            .attr("fill", d.children ? "#3b82f6" : "#1C1C1E")
            .attr("stroke", d.children ? "#60a5fa" : "#555");
      });

    // Node Labels
    node.append("text")
      .attr("dy", "0.31em")
      .attr("x", d => d.x < Math.PI === !d.children ? 12 : -12)
      .attr("text-anchor", d => d.x < Math.PI === !d.children ? "start" : "end")
      .attr("transform", d => d.x >= Math.PI ? "rotate(180)" : null)
      .text(d => {
          const label = d.data.name;
          return label.length > 35 ? label.substring(0, 32) + '...' : label;
      })
      .clone(true).lower()
      .attr("stroke", "#000") // Text outline for readability
      .attr("stroke-width", 3)
      .attr("stroke-opacity", 0.8);

    node.selectAll("text")
       .attr("fill", d => d.children ? "#fff" : "#d1d5db")
       .style("font-size", d => d.depth === 0 ? "14px" : "11px")
       .style("font-weight", d => d.depth === 0 ? "700" : "500")
       .style("pointer-events", "none"); // Let clicks pass to the group/circle

    // Initial positioning: Center and zoom out slightly
    svg.call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(0.9));

  }, [treeData, viewMode]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(JSON.stringify(treeData, null, 2));
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-6xl h-[85vh] bg-[#1C1C1E] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#252527]">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-blue-400 border border-white/5">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Структура Промпта</h3>
                    <p className="text-xs text-gray-400 font-medium">
                        {viewMode === 'graph' ? 'Интерактивная карта связей' : 'JSON представление'}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                {/* View Toggle */}
                <div className="flex bg-[#121212] rounded-lg p-1 border border-white/10">
                    <button 
                        onClick={() => setViewMode('graph')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${viewMode === 'graph' ? 'bg-[#3A3A3C] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Graph
                    </button>
                    <button 
                        onClick={() => setViewMode('code')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${viewMode === 'code' ? 'bg-[#3A3A3C] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        JSON
                    </button>
                </div>

                <div className="h-6 w-px bg-white/10 mx-1"></div>

                <button 
                    onClick={onClose} 
                    className="p-2 bg-white/5 hover:bg-red-500/20 hover:text-red-400 rounded-full transition-all text-gray-400"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>

        {/* Content Area */}
        <div ref={containerRef} className="flex-1 w-full relative bg-[#121212] overflow-hidden">
            
            {/* Graph View */}
            <svg 
                ref={svgRef} 
                className={`w-full h-full cursor-grab active:cursor-grabbing ${viewMode === 'graph' ? 'block' : 'hidden'}`}
            ></svg>
            
            {viewMode === 'graph' && (
                <div className="absolute bottom-6 left-6 bg-[#2C2C2E]/80 px-4 py-2 rounded-full text-xs font-medium text-gray-300 border border-white/10 pointer-events-none shadow-xl backdrop-blur-md flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    Zoom: {Math.round(zoomLevel * 100)}%
                </div>
            )}

            {/* Code View */}
            {viewMode === 'code' && (
                <div className="w-full h-full overflow-hidden flex flex-col relative bg-[#0d0d0d]">
                    <div className="absolute top-4 right-4 z-10">
                        <button 
                            onClick={handleCopyCode}
                            className={`
                                flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all backdrop-blur-sm border
                                ${copyFeedback 
                                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-300 hover:text-white'
                                }
                            `}
                        >
                            {copyFeedback ? (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                                    </svg>
                                    Copy JSON
                                </>
                            )}
                        </button>
                    </div>
                    <div className="overflow-auto p-6 w-full h-full scrollbar-thin scrollbar-thumb-gray-800">
                        <pre className="font-mono text-xs md:text-sm text-gray-300 leading-relaxed">
                            {/* Simple Colorization Logic */}
                            {JSON.stringify(treeData, null, 2).split('\n').map((line, i) => {
                                // Rudimentary syntax highlighting
                                const color = line.includes('"name":') ? 'text-blue-400' 
                                            : line.includes('[') || line.includes(']') ? 'text-yellow-500'
                                            : line.includes('{') || line.includes('}') ? 'text-yellow-500'
                                            : 'text-gray-300';
                                return (
                                    <div key={i} className={`${color} hover:bg-white/5 px-2 rounded`}>{line}</div>
                                )
                            })}
                        </pre>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default PromptVisualizer;