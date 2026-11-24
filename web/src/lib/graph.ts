import type { StylesheetJson } from 'cytoscape'
import type { GraphEdge, GraphNode, NodeKind } from './types'
import { VERDICT_COLOR } from './verdict'

export const NODE_COLOR: Record<NodeKind, string> = {
  domain: '#94a3b8',
  ip: '#60a5fa',
  asn: '#818cf8',
  favicon: '#f472b6',
  phone: '#fb923c',
  telegram: '#29a9eb',
  nameserver: '#a3e635',
  registrar: '#c8a96a',
  dom: '#e879f9',
}

export const NODE_KINDS: NodeKind[] = ['domain', 'ip', 'asn', 'favicon', 'phone', 'telegram', 'nameserver', 'registrar', 'dom']

export function nodeColor(n: GraphNode): string {
  if (n.kind === 'domain') return n.verdict ? VERDICT_COLOR[n.verdict] : NODE_COLOR.domain
  return NODE_COLOR[n.kind]
}

export function toElements(nodes: GraphNode[], edges: GraphEdge[], focus?: string) {
  const ids = new Set(nodes.map((n) => n.id))
  return [
    ...nodes.map((n) => ({
      data: {
        id: n.id,
        label: n.label,
        kind: n.kind,
        color: nodeColor(n),
        size: n.kind === 'domain' ? 30 : 22,
        focus: n.id === focus || n.label === focus ? 1 : 0,
      },
    })),
    ...edges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e, i) => ({ data: { id: `e${i}-${e.source}-${e.target}`, source: e.source, target: e.target, kind: e.kind } })),
  ]
}

export function graphStyle(fontSize = 9): StylesheetJson {
  return [
    {
      selector: 'node',
      style: {
        'background-color': 'data(color)',
        width: 'data(size)',
        height: 'data(size)',
        label: 'data(label)',
        color: '#cfd8e6',
        'font-size': fontSize,
        'font-family': 'Inter, system-ui, sans-serif',
        'text-valign': 'bottom',
        'text-margin-y': 5,
        'text-outline-color': '#0b1220',
        'text-outline-width': 2,
        'border-width': 2,
        'border-color': '#0b1220',
      },
    },
    { selector: 'node[kind != "domain"]', style: { shape: 'round-diamond' } },
    { selector: 'node[kind = "telegram"], node[kind = "phone"]', style: { shape: 'round-triangle' } },
    {
      selector: 'node[focus = 1]',
      style: { 'border-color': '#ffffff', 'border-width': 3, width: 40, height: 40, 'font-weight': 'bold', color: '#ffffff' },
    },
    {
      selector: 'edge',
      style: {
        width: 1.4,
        'line-color': '#33456b',
        'curve-style': 'bezier',
        opacity: 0.9,
      },
    },
    { selector: 'node:selected', style: { 'border-color': '#2dd4bf', 'border-width': 4 } },
    { selector: '.faded', style: { opacity: 0.12 } },
    { selector: 'edge.hl', style: { 'line-color': '#2dd4bf', width: 2.2 } },
  ]
}
