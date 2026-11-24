import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape, { type Core } from 'cytoscape'
import { Maximize2, PanelRightOpen, Search, X } from 'lucide-react'
import { PageHeader, Panel } from './ui'
import { ScanDrawer } from './ScanDrawer'
import { GraphLegend } from '../components/verdict/CampaignGraph'
import { VerdictChip } from '../components/VerdictChip'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { T, useLang } from '../lib/lang'
import { consoleApi } from '../lib/api'
import { graphStyle, NODE_KINDS, nodeColor, toElements } from '../lib/graph'
import { sitesCount } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import type { GraphNode, NodeKind } from '../lib/types'

export function Network() {
  const { t } = useLang()
  const { data, loading, error, reload } = useAsync(() => consoleApi.graph(), [])
  const box = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [campaign, setCampaign] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [scan, setScan] = useState<{ id: string; title: string } | null>(null)

  const byId = useMemo(() => new Map((data?.nodes ?? []).map((n) => [n.id, n])), [data])

  useEffect(() => {
    if (!data || !box.current || !data.nodes.length) return
    const big = data.nodes.length > 160
    const cy = cytoscape({
      container: box.current,
      elements: toElements(data.nodes, data.edges),
      style: graphStyle(big ? 8 : 10, big ? 7 : 0),
      layout: {
        name: 'cose',
        animate: false,
        padding: 30,
        nodeRepulsion: () => (big ? 6000 : 12000),
        idealEdgeLength: () => (big ? 50 : 80),
        numIter: big ? 600 : 1200,
      },
      minZoom: 0.15,
      maxZoom: 3,
      boxSelectionEnabled: false,
    })
    cy.on('tap', 'node', (e) => setSelected(e.target.id()))
    cy.on('tap', (e) => {
      if (e.target === cy) setSelected(null)
    })
    cyRef.current = cy
    const onResize = () => cy.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      cy.destroy()
      cyRef.current = null
    }
  }, [data])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !data) return
    cy.elements().removeClass('faded hl')
    if (selected) {
      const node = cy.getElementById(selected)
      const hood = node.closedNeighborhood()
      cy.elements().not(hood).addClass('faded')
      hood.edges().addClass('hl')
      cy.nodes().unselect()
      node.select()
      cy.animate({ center: { eles: node }, duration: 300 })
      return
    }
    if (campaign) {
      const c = data.campaigns.find((x) => x.id === campaign)
      const labels = new Set(c?.domains ?? [])
      const seeds = cy.nodes().filter((n) => labels.has(n.data('label')))
      const comp = seeds.length ? seeds.union(seeds.neighborhood()) : cy.collection()
      cy.elements().not(comp).addClass('faded')
      if (comp.length) cy.animate({ fit: { eles: comp, padding: 50 }, duration: 400 })
      return
    }
    cy.animate({ fit: { eles: cy.elements(), padding: 30 }, duration: 300 })
  }, [selected, campaign, data])

  const find = () => {
    const q = query.trim().toLowerCase()
    if (!q || !data) return
    const hit = data.nodes.find((n) => n.label.toLowerCase().includes(q))
    if (hit) setSelected(hit.id)
  }

  const node: GraphNode | undefined = selected ? byId.get(selected) : undefined
  const neighbors = useMemo(() => {
    if (!selected || !data) return [] as [NodeKind, GraphNode[]][]
    const ids = new Set<string>()
    for (const e of data.edges) {
      if (e.source === selected) ids.add(e.target)
      if (e.target === selected) ids.add(e.source)
    }
    const groups = new Map<NodeKind, GraphNode[]>()
    for (const id of ids) {
      const n = byId.get(id)
      if (!n) continue
      groups.set(n.kind, [...(groups.get(n.kind) ?? []), n])
    }
    return [...groups.entries()]
  }, [selected, data, byId])

  const kinds = useMemo(() => NODE_KINDS.filter((k) => data?.nodes.some((n) => n.kind === k)), [data])

  return (
    <div>
      <PageHeader title="nav_network" sub="networkSub" />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : !data?.nodes.length ? (
        <EmptyState message="graphEmpty" />
      ) : (
        <div className="grid gap-4 lg:h-[calc(100dvh-170px)] lg:min-h-[560px] lg:grid-cols-[280px_1fr]">
          <Panel className="flex min-h-0 flex-col p-3">
            <p className="px-2 pt-1 pb-2 text-sm font-bold text-paper">
              <T k="campaigns" />
              <span className="num ms-2 text-xs font-medium text-mist-500">{data.campaigns.length}</span>
            </p>
            <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible">
              {campaign && (
                <button
                  type="button"
                  onClick={() => setCampaign(null)}
                  className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-ink-500 px-2.5 py-1.5 text-xs font-semibold text-mist-200 hover:border-brand"
                >
                  <Maximize2 className="size-3.5" aria-hidden="true" />
                  <T k="showAll" />
                </button>
              )}
              {data.campaigns.map((c) => {
                const active = c.id === campaign
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelected(null)
                      setCampaign(active ? null : c.id)
                    }}
                    className={`w-64 shrink-0 rounded-xl border p-3 text-start transition-colors lg:w-auto ${
                      active ? 'border-brand bg-brand/10' : 'border-ink-700 bg-ink-900 hover:border-ink-500'
                    }`}
                  >
                    <p className="text-sm font-bold text-paper">
                      <T text={sitesCount(c.size)} />
                    </p>
                    {c.brands.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1">
                        {c.brands.slice(0, 3).map((b) => (
                          <span key={b} className="rounded-md bg-ink-700 px-1.5 py-0.5 text-[11px] text-mist-200">
                            {b}
                          </span>
                        ))}
                      </p>
                    )}
                    <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-mist-500" dir="ltr">
                      {c.domains.slice(0, 3).map((d) => (
                        <li key={d} className="truncate">
                          {d}
                        </li>
                      ))}
                      {c.domains.length > 3 && <li>+{c.domains.length - 3}</li>}
                    </ul>
                  </button>
                )
              })}
            </div>
          </Panel>

          <Panel className="relative h-[70dvh] min-h-[460px] overflow-hidden bg-ink-950 lg:h-auto">
            <div className="absolute inset-0">
              <div ref={box} className="h-full w-full" />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                find()
              }}
              className="absolute start-3 top-3 flex w-[min(320px,calc(100%-24px))] items-center gap-2 rounded-xl border border-ink-600 bg-ink-850/95 px-3 backdrop-blur"
            >
              <Search className="size-4 shrink-0 text-mist-500" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchNodes')}
                aria-label={t('searchNodes')}
                className="h-10 w-full bg-transparent text-sm text-paper placeholder:text-mist-500 focus:outline-none"
                dir="auto"
              />
            </form>
            <div className="absolute start-3 bottom-3 max-w-[calc(100%-24px)] rounded-xl border border-ink-700 bg-ink-900/90 px-3 py-2 backdrop-blur">
              <GraphLegend kinds={kinds} />
            </div>
            {node && (
              <div className="absolute end-3 top-16 w-[min(300px,calc(100%-24px))] rounded-2xl border border-ink-600 bg-ink-850/95 p-4 shadow-2xl backdrop-blur sm:top-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: nodeColor(node) }}>
                      <T k={`nk_${node.kind}`} />
                    </p>
                    <p className="mt-1 break-all font-mono text-sm font-semibold text-paper" dir="ltr">
                      {node.label}
                    </p>
                  </div>
                  <button type="button" onClick={() => setSelected(null)} aria-label={t('close')} className="-m-1 grid size-7 shrink-0 place-items-center rounded-full text-mist-400 hover:bg-ink-700">
                    <X className="size-4" />
                  </button>
                </div>
                {node.verdict && (
                  <div className="mt-2">
                    <VerdictChip verdict={node.verdict} />
                  </div>
                )}
                {node.scan_id && (
                  <button
                    type="button"
                    onClick={() => node.scan_id && setScan({ id: node.scan_id, title: node.label })}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-ink-500 px-2.5 py-1.5 text-xs font-semibold text-paper hover:border-brand"
                  >
                    <PanelRightOpen className="size-3.5" aria-hidden="true" />
                    <T k="openScan" />
                  </button>
                )}
                {neighbors.length > 0 && (
                  <div className="mt-4 border-t border-ink-700 pt-3">
                    <p className="mb-2 text-xs font-semibold text-mist-400">
                      <T k="connections" />
                    </p>
                    <div className="scrollbar-thin max-h-56 space-y-2.5 overflow-y-auto">
                      {neighbors.map(([kind, list]) => (
                        <div key={kind}>
                          <p className="text-[11px] text-mist-500">
                            <T k={`nk_${kind}`} /> <span className="num">({list.length})</span>
                          </p>
                          <ul className="mt-1 space-y-0.5">
                            {list.map((n) => (
                              <li key={n.id}>
                                <button
                                  type="button"
                                  onClick={() => setSelected(n.id)}
                                  className="flex w-full items-center gap-2 truncate rounded-md px-1.5 py-0.5 text-start font-mono text-xs text-mist-200 hover:bg-ink-700"
                                  dir="ltr"
                                >
                                  <span className="size-2 shrink-0 rounded-full" style={{ background: nodeColor(n) }} />
                                  <span className="truncate">{n.label}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Panel>
        </div>
      )}
      <ScanDrawer scanId={scan?.id ?? null} title={scan?.title} onClose={() => setScan(null)} />
    </div>
  )
}
