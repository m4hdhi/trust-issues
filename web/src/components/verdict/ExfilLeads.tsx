import { motion } from 'motion/react'
import { ArrowDown, AtSign, Bitcoin, FileInput, Phone, Send, Webhook, type LucideIcon } from 'lucide-react'
import { Section } from './Section'
import { T } from '../../lib/lang'
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

const KIND: Record<ExfilKind, { icon: LucideIcon; key: StringKey }> = {
  telegram_bot: { icon: Send, key: 'ex_telegram_bot' },
  webhook: { icon: Webhook, key: 'ex_webhook' },
  form_post: { icon: FileInput, key: 'ex_form_post' },
  whatsapp: { icon: Phone, key: 'ex_whatsapp' },
  phone: { icon: Phone, key: 'ex_phone' },
  email: { icon: AtSign, key: 'ex_email' },
  crypto_wallet: { icon: Bitcoin, key: 'ex_crypto_wallet' },
}

export function ExfilLeads({ leads, asksFor }: { leads: ExfilLead[]; asksFor: string[] }) {
  return (
    <Section icon={Send} title="exfilTitle" sub="exfilSub" tone="danger">
      {asksFor.length > 0 && (
        <>
          <ul className="flex flex-wrap gap-2">
            {asksFor.map((f) => (
              <li key={f} className="rounded-full border border-ink-500 bg-ink-800 px-3 py-1.5 text-[13px] font-medium text-paper">
                {FIELD[f] ? <T text={FIELD[f]} /> : f}
              </li>
            ))}
          </ul>
          <div className="flex justify-center py-2 text-scam" aria-hidden="true">
            <motion.span
              animate={{ y: [0, 5, 0] }}
              transition={{ duration: 1.4, repeat: 3, ease: 'easeInOut' }}
            >
              <ArrowDown className="size-5" />
            </motion.span>
          </div>
        </>
      )}
      <ul className="space-y-2.5">
        {leads.map((lead, i) => {
          const meta = KIND[lead.kind] ?? KIND.form_post
          const Icon = meta.icon
          return (
            <li key={`${lead.kind}-${i}`} className="flex items-start gap-3 rounded-2xl border border-scam/40 bg-ink-900/80 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-scam/15 text-scam">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-paper">
                  <T k={meta.key} />
                </p>
                <p className="mt-1 break-all font-mono text-[13px] text-scam" dir="ltr">
                  {lead.value}
                </p>
                {lead.context && (
                  <p className="mt-1 break-words font-mono text-xs text-mist-400" dir="ltr">
                    {lead.context}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
