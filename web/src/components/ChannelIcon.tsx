import { Mail, MessageSquareText, MoreHorizontal } from 'lucide-react'
import { siFacebook, siInstagram, siSnapchat, siTelegram, siTiktok, siWhatsapp, siX, type SimpleIcon } from 'simple-icons'
import type { Channel } from '../lib/types'

const BRAND: Partial<Record<Channel, SimpleIcon>> = {
  whatsapp: siWhatsapp,
  instagram: siInstagram,
  telegram: siTelegram,
  facebook: siFacebook,
  tiktok: siTiktok,
  snapchat: siSnapchat,
  x: siX,
}

export const CHANNELS: Channel[] = ['whatsapp', 'sms', 'instagram', 'telegram', 'email', 'facebook', 'tiktok', 'snapchat', 'x', 'other']

export function isChannel(v: string): v is Channel {
  return (CHANNELS as string[]).includes(v)
}

export function channelColor(channel: Channel): string {
  const icon = BRAND[channel]
  if (!icon || icon.hex === '000000') return '#15143c'
  return `#${icon.hex}`
}

export function ChannelIcon({ channel, className = 'size-5', mono = false }: { channel: Channel; className?: string; mono?: boolean }) {
  const icon = BRAND[channel]
  if (icon) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill={mono ? 'currentColor' : channelColor(channel)} role="img" aria-label={icon.title}>
        <path d={icon.path} />
      </svg>
    )
  }
  if (channel === 'sms') return <MessageSquareText className={className} aria-hidden="true" />
  if (channel === 'email') return <Mail className={className} aria-hidden="true" />
  return <MoreHorizontal className={className} aria-hidden="true" />
}
