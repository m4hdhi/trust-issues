import { useEffect, useRef } from 'react'
import cytoscape from 'cytoscape'
import { Waypoints } from 'lucide-react'
import { Section } from './Section'
import { T, Tx } from '../../lib/lang'
import { graphStyle, NODE_COLOR, toElements } from '../../lib/graph'
import { networkOf } from '../../lib/format'
import type { Campaign } from '../../lib/types'

export function GraphLegend({ kinds }: { kinds: string[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-mist-400">
      {kinds.map((k) => (
        <li key={k} className="inline-flex items-center gap-1.5">
          <span
            className={`size-2.5 ${k === 'domain' ? 'rounded-full' : 'rotate-45 rounded-[2px]'}`}
            style={{ background: k === 'domain' ? '#ef4444' : NODE_COLOR[k as keyof typeof NODE_COLOR] }}
          />
          <T k={`nk_${k}` as `nk_${keyof typeof NODE_COLOR}`} />
        </li>
      ))}
    </ul>
  )
}

export function CampaignGraph({ campaign, focus }: { campaign: Campaign; focus: string }) {
  const box = useRef<HTMLDivElement>(null)
  const sites = campaign.nodes.filter((n) => n.kind === 'domain').length || campaign.size

  useEffect(() => {
    if (!box.current) return
    const cy = cytoscape({
      container: box.current,
      elements: toElements(campaign.nodes, campaign.edges, `d:${focus}`),
      style: graphStyle(8),
      layout: { name: 'cose', animate: false, padding: 18, nodeRepulsion: () => 9000, idealEdgeLength: () => 60 },
      userZoomingEnabled: false,
      userPanningEnabled: false,
      boxSelectionEnabled: false,
      autoungrabify: true,
    })
    cy.nodes().filter((n) => n.data('label') === focus).data('focus', 1)
    const onResize = () => cy.resize() && cy.fit(undefined, 18)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      cy.destroy()
    }
  }, [campaign, focus])

  const kinds = [...new Set(campaign.nodes.map((n) => n.kind))]

  return (
    <Section icon={Waypoints} titleText={networkOf(sites)}>
      <Tx k="campaignSub" className="-mt-2 mb-3 text-sm text-mist-400" split="stack" />
      <div className="relative overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <div ref={box} className="pointer-events-none h-[280px] w-full sm:h-[320px]" aria-hidden="true" />
      </div>
      <div className="mt-3">
        <GraphLegend kinds={kinds} />
      </div>
    </Section>
  )
}
