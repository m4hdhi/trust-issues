import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Dial } from './Dial'
import { BrandMark, brandName } from '../BrandMark'
import { Marker } from '../motion'
import { T, Tx, useLang } from '../../lib/lang'
import { S, type StringKey } from '../../lib/i18n'
import { ageDays, caseNumber, dateTime, defang, hostOf, ms, reportsCount } from '../../lib/format'
import { EASE_OUT, T_STAMP } from '../../lib/motion'
import type { Bilingual, ScanResult } from '../../lib/types'
import { VERDICT_COLOR, VERDICT_LABEL } from '../../lib/verdict'

const ASKS: Record<string, Bilingual> = {
  card: { en: 'card number', ar: 'رقم البطاقة' },
  cvv: { en: 'CVV', ar: 'رمز CVV' },
  expiry: { en: 'expiry date', ar: 'تاريخ الانتهاء' },
  otp: { en: 'OTP code', ar: 'رمز التحقق' },
  emirates_id: { en: 'Emirates ID', ar: 'الهوية الإماراتية' },
  password: { en: 'password', ar: 'كلمة المرور' },
  phone: { en: 'phone number', ar: 'رقم الهاتف' },
  iban: { en: 'IBAN', ar: 'رقم الحساب' },
}

const EXFIL_NAME: Record<string, Bilingual> = {
  telegram_bot: S.ex_telegram_bot,
  webhook: S.ex_webhook,
  whatsapp: S.ex_whatsapp,
  email: S.ex_email,
  crypto_wallet: S.ex_crypto_wallet,
  phone: S.ex_phone,
  form_post: S.ex_form_post,
}

function Stamp({ result, animated }: { result: ScanResult; animated: boolean }) {
  const { mode } = useLang()
  const color = VERDICT_COLOR[result.verdict]
  const label = S[VERDICT_LABEL[result.verdict]]
  return (
    <motion.div
      initial={animated ? { scale: 1.8, opacity: 0, rotate: -14 } : false}
      animate={{ scale: 1, opacity: 1, rotate: -5 }}
      transition={animated ? { ...T_STAMP, delay: 1.0 } : { duration: 0 }}
      className="inline-flex origin-center flex-col items-center rounded-md border-2 px-4 py-1 outline-2 outline-offset-2"
      style={{ borderColor: color, color, outlineColor: `${color}66`, outlineStyle: 'solid' }}
    >
      {mode !== 'ar' && <span className="display text-2xl uppercase tracking-[0.14em]">{label.en}</span>}
      {mode !== 'en' && (
        <span lang="ar" className={`display ${mode === 'ar' ? 'text-2xl' : 'text-lg'}`}>
          {label.ar}
        </span>
      )}
    </motion.div>
  )
}

interface Fact {
  key: string
  label: StringKey
  value: ReactNode
}

function useFacts(result: ScanResult): Fact[] {
  const risky = result.verdict === 'scam' || result.verdict === 'suspicious'
  const tone = result.verdict === 'safe' ? 'safe' : result.verdict === 'scam' ? 'scam' : 'warn'
  const facts: Fact[] = []
  const name = brandName(result.brand)
  if (result.brand && name) {
    facts.push({
      key: 'brand',
      label: risky ? 'fact_impersonates' : 'fact_official',
      value: (
        <span className="inline-flex items-center gap-2">
          <BrandMark brand={result.brand} className="size-6" />
          <Marker tone={tone}>
            <T text={name} />
          </Marker>
        </span>
      ),
    })
  }
  const age = result.domain_intel.age_days
  if (age != null && (risky || age > 365)) {
    facts.push({
      key: 'age',
      label: 'fact_registered',
      value: (
        <Marker tone={age < 90 ? 'scam' : tone} delay={120}>
          <T text={ageDays(age)} />
        </Marker>
      ),
    })
  }
  const lead = result.exfil.find((e) => e.kind !== 'form_post') ?? result.exfil[0]
  if (lead) {
    facts.push({
      key: 'exfil',
      label: 'fact_sendsTo',
      value: (
        <Marker tone="scam" delay={240}>
          <T text={EXFIL_NAME[lead.kind] ?? { en: lead.kind, ar: lead.kind }} />
        </Marker>
      ),
    })
  }
  const asks = (result.page?.asks_for ?? []).filter((a) => ASKS[a])
  if (risky && asks.length) {
    facts.push({
      key: 'asks',
      label: 'fact_asks',
      value: (
        <Marker tone="scam" delay={360}>
          <T text={{ en: asks.map((a) => ASKS[a].en).join(', '), ar: asks.map((a) => ASKS[a].ar).join('، ') }} />
        </Marker>
      ),
    })
  }
  if (result.cloaking.detected) {
    facts.push({ key: 'cloak', label: 'fact_cloaked', value: <span className="evidence text-scam">3/3</span> })
  }
  if (result.community.reports > 0) {
    facts.push({
      key: 'reports',
      label: 'fact_reported',
      value: (
        <Marker tone={tone} delay={480}>
          <T text={reportsCount(result.community.reports)} />
        </Marker>
      ),
    })
  }
  return facts
}

export function VerdictHero({ result, animated }: { result: ScanResult; animated: boolean }) {
  const reduce = useReducedMotion()
  const play = animated && !reduce
  const color = VERDICT_COLOR[result.verdict]
  const risky = result.verdict === 'scam' || result.verdict === 'suspicious'
  const finalHost = result.final_url ? hostOf(result.final_url) : result.domain
  const total = result.timings_ms?.total
  const sha = typeof result.evidence?.screenshot_sha256 === 'string' ? result.evidence.screenshot_sha256 : null
  const facts = useFacts(result)

  return (
    <section>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line pb-4 text-xs text-paper-3">
        <span className="text-paper-2">
          <T k="caseFile" />
        </span>
        <span className="evidence text-paper">{caseNumber(result.id)}</span>
        <span className="evidence num">{dateTime(result.created_at)}</span>
        <span>
          <T k={result.mode === 'fast' ? 'fastScan' : 'deepScan'} />
        </span>
        {total != null && <span className="evidence num">{ms(total)}</span>}
        {sha && <span className="evidence hidden sm:inline">sha256 {sha.slice(0, 12)}…</span>}
      </div>

      <div className="grid-12 gap-y-12 pt-12 lg:pt-16">
        <div className="col-span-4 sm:col-span-8 lg:col-span-4">
          <Dial score={result.score} color={color} animated={play} />
        </div>
        <div className="col-span-4 sm:col-span-8 lg:col-span-8 lg:ps-8">
          <Stamp result={result} animated={play} />
          <motion.div
            initial={play ? { opacity: 0, y: 12 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: play ? 0.2 : 0, ease: EASE_OUT }}
          >
            <Tx
              text={result.headline}
              as="h1"
              className="display mt-8 text-3xl text-paper sm:text-4xl xl:text-5xl"
              arClassName="text-xl text-paper-2 sm:text-2xl"
              split="stack"
            />
            {result.summary && <Tx text={result.summary} className="mt-6 max-w-[62ch] text-lg text-paper-2" split="stack" />}
            <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-paper-3">
              <span className="evidence rounded-md border px-2 py-1 text-base" style={{ borderColor: `${color}55`, color: risky ? color : undefined }}>
                {risky ? defang(finalHost) : finalHost}
              </span>
            </p>
          </motion.div>
          {facts.length > 0 && (
            <dl className="mt-8 grid border-t border-line sm:grid-cols-2">
              {facts.map((f, i) => (
                <motion.div
                  key={f.key}
                  className={`flex flex-col gap-1 border-b border-line py-4 ${i % 2 === 1 ? 'sm:border-s sm:ps-6' : 'sm:pe-6'}`}
                  initial={play ? { opacity: 0, y: 8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: play ? 0.45 + i * 0.07 : 0, ease: EASE_OUT }}
                >
                  <dt className="text-sm text-paper-3">
                    <T k={f.label} />
                  </dt>
                  <dd className="text-lg text-paper">{f.value}</dd>
                </motion.div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </section>
  )
}
