import type { StylesheetJson } from 'cytoscape'
import type { GraphEdge, GraphNode, NodeKind } from './types'
import { VERDICT_COLOR } from './verdict'

export const NODE_COLOR: Record<NodeKind, string> = {
  domain: '#7775a0',
  ip: '#2f6fc9',
  asn: '#6a4fd1',
  favicon: '#c2417a',
  phone: '#c26a00',
  telegram: '#1c93d6',
  nameserver: '#0c9c6c',
  registrar: '#b68a35',
  dom: '#a23fc4',
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
        size: n.kind === 'domain' ? 30 : 18,
        focus: n.id === focus || n.label === focus ? 1 : 0,
      },
    })),
    ...edges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e, i) => ({ data: { id: `e${i}-${e.source}-${e.target}`, source: e.source, target: e.target, kind: e.kind } })),
  ]
}

export function graphStyle(fontSize = 9, minZoomedFont = 0): StylesheetJson {
  return [
    {
      selector: 'node',
      style: {
        'background-color': 'data(color)',
        width: 'data(size)',
        height: 'data(size)',
        label: 'data(label)',
        color: '#15143c',
        'font-size': fontSize,
        'font-weight': 600,
        'font-family': 'Bricolage Grotesque, system-ui, sans-serif',
        'text-valign': 'bottom',
        'text-margin-y': 6,
        'text-wrap': 'ellipsis',
        'text-max-width': '120px',
        'text-background-color': '#ffffff',
        'text-background-opacity': 0.92,
        'text-background-padding': '3px',
        'text-background-shape': 'roundrectangle',
        'border-width': 3,
        'border-color': '#ffffff',
        'underlay-color': 'data(color)',
        'underlay-opacity': 0.18,
        'underlay-padding': 5,
        'underlay-shape': 'ellipse',
        'min-zoomed-font-size': minZoomedFont,
      },
    },
    { selector: 'node[kind != "domain"]', style: { shape: 'round-rectangle', 'underlay-opacity': 0 } },
    { selector: 'node[kind = "telegram"], node[kind = "phone"]', style: { shape: 'round-triangle' } },
    {
      selector: 'node[focus = 1]',
      style: { 'border-color': '#15143c', 'border-width': 3, width: 40, height: 40, 'font-weight': 'bold' },
    },
    {
      selector: 'edge',
      style: {
        width: 1.5,
        'line-color': '#c3bdf2',
        'curve-style': 'bezier',
        opacity: 0.95,
      },
    },
    { selector: 'node:selected', style: { 'border-color': '#5a48f2', 'border-width': 4 } },
    { selector: '.faded', style: { opacity: 0.14 } },
    { selector: 'edge.hl', style: { 'line-color': '#5a48f2', width: 2.4 } },
  ]
}
