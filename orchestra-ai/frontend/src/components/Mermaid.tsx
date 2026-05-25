'use client'

import React, { useEffect, useRef } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: true,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'Inter, system-ui, sans-serif',
  themeVariables: {
    fontSize: '13px',
    primaryColor: '#3b82f6',
    nodeBorder: '#3b82f6',
    mainBkg: '#0b1326',
    textColor: '#ffffff',
    lineColor: '#3b82f6',
    fontFamily: 'Inter, system-ui, sans-serif'
  },
  flowchart: {
    htmlLabels: false,
    useMaxWidth: true,
    padding: 15,
    curve: 'basis'
  }
})


export default function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let isMounted = true;
    if (ref.current) {
      const renderChart = async () => {
        try {
          const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`
          
          // Heuristic cleanup for streaming tokens and common LLM syntax errors
          let sanitizedChart = chart.trim();
          
          // Remove potential markdown code block markers if LLM included them
          sanitizedChart = sanitizedChart.replace(/```mermaid/g, '').replace(/```/g, '');
          
          // Remove common LLM artifacts like "Here is the chart:" or leading/trailing text
          const lines = sanitizedChart.split('\n');
          const startIndex = lines.findIndex(line => /^(graph|pie|sequenceDiagram|gantt|classDiagram|stateDiagram|erDiagram|journey|requirementDiagram|gitGraph|mindmap|timeline)/i.test(line.trim()));
          if (startIndex !== -1) {
            sanitizedChart = lines.slice(startIndex).join('\n');
            // Also find the last 'end' or the last line that looks like mermaid
            const splitLines = sanitizedChart.split('\n');
            let lastFoundIndex = splitLines.length - 1;
            for (let i = splitLines.length - 1; i >= 0; i--) {
              const l = splitLines[i].trim();
              if (l.length > 0 && (l.includes('-->') || l.includes('---') || l === 'end' || l.includes('["') || l.includes('(('))) {
                lastFoundIndex = i;
                break;
              }
            }
            sanitizedChart = splitLines.slice(0, lastFoundIndex + 1).join('\n');
          }

          // Clean up individual lines
          sanitizedChart = sanitizedChart.split('\n').map(line => {
             let clean = line.trim();
             
             // Remove semicolons at the end
             clean = clean.replace(/;+$/, '');

             // Force quote all labels if not already quoted
             clean = clean.replace(/(\w+)(\[|\(|\{)([^"\]\)\}]*)(\]|\)|\})/g, (match, id, open, label, close) => {
                const trimmedLabel = label.trim();
                if (trimmedLabel.startsWith('"') && trimmedLabel.endsWith('"')) return match;
                return `${id}${open}"${trimmedLabel.replace(/"/g, '')}"${close}`;
             });

             // Sanitize IDs (A-Z, 0-9, _, -)
             clean = clean.replace(/^(\s*)([^\s\[\(\{\-\>]+)/g, (match, space, id) => {
                if (!/^[a-zA-Z0-9_-]+$/.test(id) && !/^(graph|subgraph|end|click|style|classDef|class|callback|linkStyle|connect)/.test(id)) {
                   return `${space}${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
                }
                return match;
             });

             // Standardize links (ensure 2 or 3 dashes with arrow)
             clean = clean.replace(/([^\-])\-+([^\-\>])\-+\>([^\-\>])/g, '$1-->$3');
             clean = clean.replace(/([^\-])\-+([^\-\>])\-+([^\-\>])/g, '$1---$3');

             // Force Vertical flows for complex diagrams to avoid horizontal squashing
             if (clean.toLowerCase().startsWith('graph lr') && sanitizedChart.split('\n').length > 6) {
                clean = clean.replace(/graph lr/i, 'graph TD');
             }

             return clean;
          }).filter(l => l.length > 0).join('\n');
          
          // Fix common unclosed blocks
          const openSubgraphs = (sanitizedChart.match(/\bsubgraph\b/g) || []).length;
          const closeEnds = (sanitizedChart.match(/\bend\b/g) || []).length;
          if (openSubgraphs > closeEnds) {
            sanitizedChart += '\n' + 'end\n'.repeat(openSubgraphs - closeEnds);
          }
          
          // Force graph TD if no type is found or if it's missing the graph prefix
          if (!/^(graph|pie|sequenceDiagram|gantt|classDiagram|stateDiagram|erDiagram|journey|requirementDiagram|gitGraph|mindmap|timeline)/i.test(sanitizedChart.trim())) {
             sanitizedChart = `graph TD\n${sanitizedChart}`;
          }

          // Pre-validate the chart
          try {
            const isValid = await mermaid.parse(sanitizedChart, { suppressErrors: true });
            if (isValid) {
              const { svg } = await mermaid.render(id, sanitizedChart);
              // Check if the rendered SVG is actually an error message
              if (svg.includes('Syntax error in text') || svg.includes('class="error"')) {
                throw new Error('Mermaid rendering resulted in syntax error icon');
              }
              if (isMounted && ref.current) {
                ref.current.innerHTML = svg;
              }
            }
          } catch (parseErr) {
            // Attempt a "Super Simple" recovery
            try {
               // Extract all capitalized IDs and labels
               const nodes = Array.from(new Set(sanitizedChart.match(/[a-zA-Z0-9_-]+(\[[^\]]+\])?/gi) || []))
                  .map(n => n.includes('[') ? n : `${n}["${n.replace(/_/g, ' ')}"]`)
                  .slice(0, 15); // Limit to 15 nodes for simplicity
               
               const links = (sanitizedChart.match(/[a-zA-Z0-9_-]+\s*(-{2,3}>|--)\s*[a-zA-Z0-9_-]+/gi) || [])
                  .map(l => l.replace(/-+>/, '-->').replace(/--/, '---'))
                  .slice(0, 20); // Limit to 20 links
               
               if (nodes.length > 1) {
                 const simpleChart = `graph TD\n${nodes.join('\n')}\n${links.join('\n')}`;
                 const { svg } = await mermaid.render(id + '-simple', simpleChart);
                 if (isMounted && ref.current) {
                   ref.current.innerHTML = svg;
                 }
               } else {
                 throw parseErr;
               }
            } catch (recoveryErr) {
               // Final fallback: Hide the block if everything fails
               if (isMounted && ref.current) {
                 ref.current.style.display = 'none';
               }
            }
          }
        } catch (err: any) {
          // If it fails, we show a clean fallback instead of a crash
          if (isMounted && ref.current) {
             ref.current.innerHTML = `<div class="text-[10px] opacity-40 p-2 border border-blue-500/10 rounded bg-blue-500/5">Generating Neural Map...</div>`
          }
        }
      };
      renderChart();
    }
    return () => { isMounted = false };
  }, [chart])

  return <div key={chart} ref={ref} className="mermaid flex justify-center my-8 overflow-x-auto min-h-[50px] w-full [&>svg]:w-full [&>svg]:max-w-4xl [&>svg]:max-h-[1200px] [&>svg]:h-auto" />
}
