import { Mail, MessageSquareText, MoreHorizontal } from 'lucide-react'
import type { Channel } from '../lib/types'

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export const CHANNEL_COLOR: Record<Channel, string> = {
  whatsapp: '#25D366',
  sms: '#60A5FA',
  instagram: '#E1306C',
  telegram: '#29A9EB',
  email: '#A78BFA',
  facebook: '#1877F2',
  tiktok: '#EE1D52',
  other: '#94A3B8',
}

export const CHANNELS: Channel[] = ['whatsapp', 'sms', 'instagram', 'telegram', 'email', 'facebook', 'tiktok', 'other']

export function isChannel(v: string): v is Channel {
  return (CHANNELS as string[]).includes(v)
}

export function ChannelIcon({ channel, className = 'size-5' }: { channel: Channel; className?: string }) {
  switch (channel) {
    case 'whatsapp':
      return (
        <svg {...base} className={className}>
          <path d="M3.5 20.5l1.3-4.3A8.5 8.5 0 1 1 8 19.4Z" />
          <path d="M9 8.8c0 3.3 2.9 6.2 6.2 6.2l1.3-1.6-2-1-1 .9a4.4 4.4 0 0 1-2.8-2.8l.9-1-1-2Z" strokeWidth={1.5} />
        </svg>
      )
    case 'instagram':
      return (
        <svg {...base} className={className}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.3" cy="6.7" r=".6" fill="currentColor" />
        </svg>
      )
    case 'telegram':
      return (
        <svg {...base} className={className}>
          <path d="M21 4 3 11l6 2.2M21 4l-3 16-9-6.8M21 4 9 13.2v5.3l3-3.2" />
        </svg>
      )
    case 'facebook':
      return (
        <svg {...base} className={className}>
          <path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V10H6.5v3.5H9V21h3.5v-7.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15Z" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg {...base} className={className}>
          <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" />
          <path d="M14 3c.4 2.8 2.3 4.6 5 4.8" />
        </svg>
      )
    case 'sms':
      return <MessageSquareText className={className} aria-hidden="true" />
    case 'email':
      return <Mail className={className} aria-hidden="true" />
    default:
      return <MoreHorizontal className={className} aria-hidden="true" />
  }
}
