import { useEffect, useRef } from 'react'
import cytoscape from 'cytoscape'
import { T, Tx } from '../../lib/lang'
import { graphStyle, NODE_COLOR, toElements } from '../../lib/graph'
import type { Campaign, NodeKind } from '../../lib/types'

export function GraphLegend({ kinds }: { kinds: NodeKind[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-paper-2">
      {kinds.map((k) => (
        <li key={k} className="inline-flex items-center gap-2">
          <span
            className={`size-2 ${k === 'domain' ? 'rounded-full' : 'rotate-45 rounded-[1px]'}`}
            style={{ background: k === 'domain' ? '#e5534b' : NODE_COLOR[k] }}
          />
          <T k={`nk_${k}`} />
        </li>
      ))}
    </ul>
  )
}

export function CampaignGraph({ campaign, focus }: { campaign: Campaign; focus: string }) {
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!box.current) return
    const cy = cytoscape({
      container: box.current,
      elements: toElements(campaign.nodes, campaign.edges, `d:${focus}`),
      style: graphStyle(8),
      layout: { name: 'cose', animate: false, padding: 24, nodeRepulsion: () => 9000, idealEdgeLength: () => 60 },
      userZoomingEnabled: false,
      userPanningEnabled: false,
      boxSelectionEnabled: false,
      autoungrabify: true,
    })
    cy.nodes().filter((n) => n.data('label') === focus).data('focus', 1)
    const onResize = () => cy.resize() && cy.fit(undefined, 24)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      cy.destroy()
    }
  }, [campaign, focus])

  const kinds = [...new Set(campaign.nodes.map((n) => n.kind))]

  return (
    <div>
      <Tx k="campaignSub" className="mb-4 text-base text-paper-2" split="stack" />
      <div className="overflow-hidden rounded-lg bg-ink-950">
        <div ref={box} className="pointer-events-none h-[320px] w-full sm:h-[400px]" aria-hidden="true" />
      </div>
      <div className="mt-4">
        <GraphLegend kinds={kinds} />
      </div>
    </div>
  )
}
