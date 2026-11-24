import { motion } from 'motion/react'
import { siTelegram, siWhatsapp } from 'simple-icons'
import { AtSign, Bitcoin, FileInput, Phone, Webhook, type LucideIcon } from 'lucide-react'
import { T } from '../../lib/lang'
import { EASE_OUT } from '../../lib/motion'
import type { Bilingual, ExfilKind, ExfilLead } from '../../lib/types'
import type { StringKey } from '../../lib/i18n'

const FIELD: Record<string, Bilingual> = {
  card: { en: 'Card number', ar: 'رقم البطاقة' },
  cvv: { en: 'CVV', ar: 'رمز CVV' },
  expiry: { en: 'Expiry date', ar: 'تاريخ الانتهاء' },
  otp: { en: 'OTP code', ar: 'رمز التحقق' },
  emirates_id: { en: 'Emirates ID', ar: 'الهوية الإماراتية' },
  password: { en: 'Password', ar: 'كلمة المرور' },
  phone: { en: 'Phone number', ar: 'رقم الهاتف' },
  iban: { en: 'IBAN', ar: 'رقم الحساب IBAN' },
}

const KIND: Record<ExfilKind, { key: StringKey; icon?: LucideIcon; brand?: { path: string; hex: string } }> = {
  telegram_bot: { key: 'ex_telegram_bot', brand: siTelegram },
  whatsapp: { key: 'ex_whatsapp', brand: siWhatsapp },
  webhook: { key: 'ex_webhook', icon: Webhook },
  form_post: { key: 'ex_form_post', icon: FileInput },
  phone: { key: 'ex_phone', icon: Phone },
  email: { key: 'ex_email', icon: AtSign },
  crypto_wallet: { key: 'ex_crypto_wallet', icon: Bitcoin },
}

export function ExfilLeads({ leads, asksFor }: { leads: ExfilLead[]; asksFor: string[] }) {
  return (
    <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.4fr)] sm:items-center">
      {asksFor.length > 0 && (
        <div>
          <p className="text-sm text-paper-3">
            <T k="youType" />
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {asksFor.map((f, i) => (
              <motion.li
                key={f}
                className="rounded-md bg-ink-800 px-3 py-1 text-base text-paper"
                initial={{ opacity: 0, y: 6 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.25, delay: i * 0.06, ease: EASE_OUT }}
              >
                {FIELD[f] ? <T text={FIELD[f]} /> : f}
              </motion.li>
            ))}
          </ul>
        </div>
      )}
      {asksFor.length > 0 && (
        <div className="relative hidden h-px w-16 overflow-hidden bg-line sm:block" aria-hidden="true">
          <motion.span
            className="absolute inset-y-0 left-0 w-1/2 bg-scam"
            initial={{ x: '-100%' }}
            whileInView={{ x: '200%' }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, repeat: 2, ease: EASE_OUT }}
          />
        </div>
      )}
      <div className={asksFor.length ? '' : 'sm:col-span-3'}>
        <p className="text-sm text-paper-3">
          <T k="itGoesTo" />
        </p>
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {leads.map((lead, i) => {
            const meta = KIND[lead.kind] ?? KIND.form_post
            const Icon = meta.icon
            return (
              <li key={`${lead.kind}-${i}`} className="flex items-start gap-4 py-4">
                {meta.brand ? (
                  <svg viewBox="0 0 24 24" className="mt-1 size-6 shrink-0" fill={`#${meta.brand.hex}`} aria-hidden="true">
                    <path d={meta.brand.path} />
                  </svg>
                ) : Icon ? (
                  <Icon className="mt-1 size-6 shrink-0 text-scam" aria-hidden="true" />
                ) : null}
                <div className="min-w-0">
                  <p className="text-base font-medium text-paper">
                    <T k={meta.key} />
                  </p>
                  <p className="evidence mt-1 break-all text-sm text-scam">{lead.value}</p>
                  {lead.context && <p className="evidence mt-1 break-words text-xs text-paper-3">{lead.context}</p>}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
