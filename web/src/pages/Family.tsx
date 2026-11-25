import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import {
  Baby,
  Briefcase,
  Check,
  Crown,
  HeartHandshake,
  Hourglass,
  Phone,
  Plus,
  QrCode,
  ScanSearch,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Siren,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Modal } from '../components/Modal'
import { VerdictChip } from '../components/VerdictChip'
import { CopyButton } from '../components/CopyButton'
import { BrandMark } from '../components/BrandMark'
import { Counter, Reveal, Stagger, StaggerItem } from '../components/motion'
import { ErrorState, Spinner } from '../components/States'
import { SectionHead, btn } from '../components/ui'
import { T, Tx, useLang } from '../lib/lang'
import { api } from '../lib/api'
import { defang, timeAgo } from '../lib/format'
import { EASE_OUT } from '../lib/motion'
import { isAndroid, isStandalone } from '../lib/push'
import { S, type StringKey } from '../lib/i18n'
import type { Bilingual, DeviceRegistration, FamilyEventItem, FamilyInviteResult, FamilyMember, FamilyRequest, FamilyRole, FamilyState, Helpline } from '../lib/types'
import { Alerts, AndroidSetup, IphoneSetup, TestProtection } from './Protect'
import { AccountLink, SignInLink } from './Account'
import { useDevice } from '../lib/useDevice'

export const ROLE: Record<FamilyRole, { k: StringKey; icon: LucideIcon }> = {
  guardian: { k: 'roleGuardian', icon: Crown },
  elder: { k: 'roleElder', icon: HeartHandshake },
  child: { k: 'roleChild', icon: Baby },
  helper: { k: 'roleHelper', icon: Briefcase },
  adult: { k: 'roleAdult', icon: UserRound },
}

const STRICT_DEFAULT: Record<FamilyRole, boolean> = { guardian: false, elder: true, child: true, helper: true, adult: false }

/** Wraps names and domains so they keep their order inside Arabic sentences. */
export const iso = (v: string) => `\u2068${v}\u2069`

const field = 'h-12 w-full rounded-lg bg-ink-950 px-4 text-base text-paper placeholder:text-paper-3 focus:outline-2 focus:outline-gold'

export function Avatar({ name, role, size = 'size-12' }: { name: string; role: FamilyRole; size?: string }) {
  const Icon = ROLE[role].icon
  const initial = (name.trim()[0] ?? '?').toUpperCase()
  return (
    <span className={`relative grid ${size} shrink-0 place-items-center rounded-full bg-ink-700 text-lg font-medium text-paper`}>
      {initial}
      <span className={`absolute -bottom-1 -end-1 grid size-6 place-items-center rounded-full ${role === 'guardian' ? 'bg-gold text-ink-950' : 'bg-ink-900 text-gold'}`}>
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
    </span>
  )
}

function eventText(e: FamilyEventItem): Bilingual {
  const who = e.member ?? ''
  const d = e.domain ? defang(e.domain) : ''
  const aw = iso(who)
  const ad = iso(d)
  const by = e.detail.by ?? ''
  const ab = iso(by)
  switch (e.kind) {
    case 'created':
      return { en: `${who} started Family Shield`, ar: `أنشأ ${aw} درع العائلة` }
    case 'joined':
      return { en: `${who} joined the family`, ar: `انضم ${aw} إلى العائلة` }
    case 'held':
      return { en: `Held ${d} for ${who}, waiting for approval`, ar: `أُوقف ${ad} عن ${aw} بانتظار الموافقة` }
    case 'blocked':
      return { en: `Blocked a scam site for ${who}: ${d}`, ar: `حُظر موقع احتيالي عن ${aw}: ${ad}` }
    case 'allowed':
      return { en: `${by} allowed ${d} for ${who}`, ar: `سمح ${ab} بـ${ad} لـ${aw}` }
    case 'kept_blocked':
      return { en: `${by} kept ${d} blocked for ${who}`, ar: `أبقى ${ab} ${ad} محظورًا عن ${aw}` }
    case 'sos':
      return { en: `${who} pressed SOS`, ar: `ضغط ${aw} زر الطوارئ` }
    case 'test':
      return { en: `${who} ran the protection test: it was blocked`, ar: `أجرى ${aw} اختبار الحماية: تم الحظر` }
    case 'left':
      return { en: 'A phone left the family', ar: 'غادر هاتف العائلة' }
  }
}

const EVENT_TONE: Record<FamilyEventItem['kind'], string> = {
  created: 'bg-ink-700 text-paper-2',
  joined: 'bg-ink-700 text-paper-2',
  held: 'bg-warn/15 text-warn',
  blocked: 'bg-scam/15 text-scam',
  allowed: 'bg-safe/15 text-safe',
  kept_blocked: 'bg-scam/15 text-scam',
  sos: 'bg-scam text-ink-950',
  test: 'bg-safe/15 text-safe',
  left: 'bg-ink-700 text-paper-3',
}

const EVENT_ICON: Record<FamilyEventItem['kind'], LucideIcon> = {
  created: Crown,
  joined: Users,
  held: Hourglass,
  blocked: ShieldAlert,
  allowed: Check,
  kept_blocked: ShieldAlert,
  sos: Siren,
  test: ShieldCheck,
  left: UserRound,
}

function Timeline({ events }: { events: FamilyEventItem[] }) {
  return (
    <section>
      <Tx k="famTimeline" as="h2" className="display text-xl text-paper" split="stack" />
      {events.length === 0 ? (
        <Tx k="famNoActivity" className="mt-4 text-base text-paper-3" split="stack" />
      ) : (
        <ol className="mt-4">
          {events.slice(0, 12).map((e) => {
            const Icon = EVENT_ICON[e.kind] ?? Check
            return (
              <li key={e.id} className="flex items-start gap-3 border-b border-line py-3">
                <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${EVENT_TONE[e.kind] ?? ''}`}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <Tx text={eventText(e)} className="text-sm text-paper" split="stack" />
                  <p className="mt-1 text-xs text-paper-3">
                    <T text={timeAgo(e.ts)} />
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function Warnings({ state }: { state: FamilyState }) {
  const items = state.warnings ?? []
  if (!items.length) return null
  return (
    <section>
      <Tx k="famWarnings" as="h2" className="display text-xl text-paper" split="stack" />
      <Tx k="famWarningsSub" className="mt-2 text-sm text-paper-3" split="stack" />
      <ul className="mt-4 space-y-3">
        {items.map((w) => (
          <li key={w.domain} className="flex items-start gap-3 rounded-lg bg-ink-850 p-4">
            <BrandMark brand={w.brand} className="size-10" />
            <div className="min-w-0 flex-1">
              <Tx
                text={{
                  en: `Fake ${w.brand.name_en} site found ${timeAgo(w.ts).en}. If you get ${w.lure.en}, it is a scam.`,
                  ar: `رُصد موقع مزيف لـ${w.brand.name_ar} ${timeAgo(w.ts).ar}. إذا وصلتك ${w.lure.ar}، فهي احتيال.`,
                }}
                className="text-sm text-paper"
                split="stack"
              />
              <p className="evidence mt-2 truncate text-xs text-scam">{defang(w.domain)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function RequestCard({ r, busy, onDecide }: { r: FamilyRequest; busy: boolean; onDecide: (d: 'allow' | 'block') => void }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
      className="rounded-xl bg-ink-850 p-5"
    >
      <div className="flex items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-warn/15 text-warn">
          <Hourglass className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <Tx text={{ en: `${r.member} tried to open`, ar: `حاول ${iso(r.member)} فتح` }} className="text-sm text-paper-2" split="stack" />
          <p className="evidence mt-1 break-all text-lg text-paper">{defang(r.host)}</p>
          <Tx text={r.reason} className="mt-2 text-sm text-warn" split="stack" />
          <p className="mt-1 text-xs text-paper-3">
            <T text={timeAgo(r.ts)} />
          </p>
        </div>
      </div>
      {r.check ? (
        <div className={`mt-4 rounded-xl p-4 ${r.check.verdict === 'scam' ? 'bg-scam/10' : r.check.verdict === 'suspicious' ? 'bg-warn/10' : r.check.verdict === 'safe' ? 'bg-safe/10' : 'bg-ink-900'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-paper-2">
              <T k="famOurCheck" />
            </span>
            <VerdictChip verdict={r.check.verdict} score={r.check.score} />
          </div>
          {r.check.headline && <Tx text={r.check.headline} className="mt-2 text-base font-semibold text-paper" />}
          <Tx k={`famAdvice_${r.check.verdict}` as StringKey} className="mt-1 text-sm text-paper-2" />
          <Link to={`/scan/${encodeURIComponent(r.check.scan_id)}`} className="mt-2 inline-flex items-center gap-1 text-sm text-gold hover:underline">
            <T k="trOpen" />
          </Link>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-ink-900 p-4 text-sm text-paper-2">
          <Spinner />
          <T k="famChecking" />
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" disabled={busy} onClick={() => onDecide('block')} className={`${btn.primary} h-auto! min-h-12 py-2`}>
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          <T k="famKeepBlocked" stacked />
        </button>
        <button type="button" disabled={busy} onClick={() => onDecide('allow')} className={`${btn.secondary} h-auto! min-h-12 py-2`}>
          <Check className="size-4 shrink-0" aria-hidden="true" />
          <T k="famAllow" stacked />
        </button>
      </div>
    </motion.li>
  )
}

function MemberRow({ m, guardianView, onStrict, onRemove }: { m: FamilyMember; guardianView: boolean; onStrict: (v: boolean) => void; onRemove: () => void }) {
  const showStatus = !(m.role === 'guardian' && m.status !== 'protected')
  return (
    <li className="border-b border-line py-4">
      <div className="flex items-start gap-4">
        <Avatar name={m.name} role={m.role} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium text-paper">
            {m.name}
            {m.me && (
              <span className="ms-2 text-sm font-normal text-paper-3">
                (<T k="famYou" />)
              </span>
            )}
          </p>
          <p className="mt-0.5 text-sm text-paper-3">
            <T k={ROLE[m.role].k} />
          </p>
          {showStatus && (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className={`inline-flex items-center gap-1.5 font-medium ${m.status === 'protected' ? 'text-safe' : 'text-warn'}`}>
                {m.status === 'protected' ? <ShieldCheck className="size-4" aria-hidden="true" /> : <Hourglass className="size-4" aria-hidden="true" />}
                <T k={m.status === 'protected' ? 'statusProtected' : 'statusSetup'} />
              </span>
              {m.stopped_week > 0 && (
                <span className="text-paper-3">
                  <T text={{ en: `${m.stopped_week} stopped this week`, ar: `${m.stopped_week} أُوقفت هذا الأسبوع` }} />
                </span>
              )}
            </p>
          )}
        </div>
      </div>
      {guardianView && m.role !== 'guardian' && (
        <div className="mt-3 flex items-center justify-between gap-4 ps-16">
          <label className="flex min-w-0 cursor-pointer items-start gap-3">
            <input type="checkbox" checked={m.strict} onChange={(e) => onStrict(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--color-gold)]" />
            <span className="min-w-0">
              <Tx k="strictLabel" as="span" className="block text-sm text-paper" split="stack" />
              <Tx k="strictHint" as="span" className="block text-xs text-paper-3" split="stack" />
            </span>
          </label>
          <button type="button" onClick={onRemove} className={`${btn.quiet} shrink-0`}>
            <T k="famRemove" />
          </button>
        </div>
      )}
    </li>
  )
}

function InviteModal({ open, onClose, deviceId }: { open: boolean; onClose: () => void; deviceId: string }) {
  const { t } = useLang()
  const [name, setName] = useState('')
  const [role, setRole] = useState<FamilyRole>('elder')
  const [strict, setStrict] = useState(true)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [invite, setInvite] = useState<FamilyInviteResult | null>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setRole('elder')
      setStrict(true)
      setInvite(null)
      setFailed(false)
    }
  }, [open])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setFailed(false)
    try {
      setInvite(await api.inviteMember(deviceId, name.trim() || t(ROLE[role].k), role, strict))
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const share = async () => {
    if (!invite) return
    try {
      await navigator.share({ title: 'Family Shield', text: `${t('inviteScan')}: ${invite.name}`, url: invite.url })
    } catch {
      /* the copy button is the fallback */
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={<T k="inviteTitle" />}>
      {!invite ? (
        <form onSubmit={(e) => void submit(e)} className="space-y-6">
          <label className="block">
            <Tx k="inviteName" className="mb-2 text-sm text-paper-2" split="stack" />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('inviteNamePh')} maxLength={40} className={field} />
          </label>
          <fieldset>
            <legend className="mb-2">
              <Tx k="inviteRole" className="text-sm text-paper-2" split="stack" />
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {(['elder', 'child', 'helper', 'adult', 'guardian'] as FamilyRole[]).map((r) => {
                const Icon = ROLE[r].icon
                const on = role === r
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setRole(r)
                      setStrict(STRICT_DEFAULT[r])
                    }}
                    className={`press flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 text-start text-sm transition-colors ${on ? 'bg-gold text-ink-950' : 'bg-ink-800 text-paper-2 hover:bg-ink-700'}`}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <T k={ROLE[r].k} />
                  </button>
                )
              })}
            </div>
          </fieldset>
          {role !== 'guardian' && (
            <label className="flex cursor-pointer items-start gap-3 text-sm text-paper-2">
              <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} className="mt-0.5 size-5 accent-[var(--color-gold)]" />
              <span>
                <T k="strictLabel" />
                <span className="block text-paper-3">
                  <T k="strictHint" />
                </span>
              </span>
            </label>
          )}
          {failed && <Tx k="famFailed" className="text-sm text-warn" split="stack" />}
          <button type="submit" disabled={busy} className={`${btn.primary} w-full`}>
            {busy ? <Spinner /> : <QrCode className="size-4" aria-hidden="true" />}
            <T k="inviteCreate" />
          </button>
        </form>
      ) : (
        <div className="text-center">
          <Tx k="inviteScan" as="h3" className="display text-xl text-paper" split="stack" />
          <Tx k="inviteScanSub" className="mx-auto mt-2 max-w-[40ch] text-sm text-paper-2" split="stack" />
          <motion.img
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            src={`/api/join/${invite.code}/qr.svg`}
            alt={`QR code to join: ${invite.name}`}
            className="mx-auto mt-6 size-60 rounded-xl bg-white p-3"
          />
          <p className="mt-4 inline-flex items-center gap-2 text-base text-paper">
            <Avatar name={invite.name} role={invite.role} size="size-8" />
            {invite.name} · <T k={ROLE[invite.role].k} />
          </p>
          <p className="evidence mt-3 break-all text-xs text-paper-3">{invite.url}</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {typeof navigator.share === 'function' ? (
              <button type="button" onClick={() => void share()} className={btn.secondary}>
                <Share2 className="size-4" aria-hidden="true" />
                <T k="inviteShare" />
              </button>
            ) : (
              <CopyButton value={invite.url} className={btn.secondary} />
            )}
            <button type="button" onClick={onClose} className={btn.primary}>
              <T k="inviteDone" />
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function Stat({ value, label, tone = 'text-paper' }: { value: number; label: StringKey; tone?: string }) {
  return (
    <div className="border-t border-line pt-4">
      <Counter value={value} className={`display num block text-4xl ${tone}`} />
      <Tx k={label} className="mt-1 text-sm text-paper-3" split="stack" />
    </div>
  )
}

function GuardianView({ state, deviceId, update }: { state: FamilyState; deviceId: string; update: (s: FamilyState) => void }) {
  const [inviteOpen, setInviteOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const pending = (state.requests ?? []).filter((r) => r.status === 'pending')
  const members = state.members ?? []
  const stats = state.stats ?? { stopped_week: 0, members: 0, protected: 0 }

  const act = async (key: string, fn: () => Promise<FamilyState>) => {
    setBusy(key)
    try {
      update(await fn())
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <section className="shell grid-12 gap-y-10 pt-8 pb-8 lg:pt-10">
        <Reveal className="col-span-4 sm:col-span-8 lg:col-span-12">
          <p className="evidence text-sm text-gold">
            <T k="famKicker" />
          </p>
          <h1 className="display mt-3 text-4xl text-paper sm:text-5xl">{state.family?.name}</h1>
          <div className="mt-10 grid max-w-3xl grid-cols-3 gap-6">
            <Stat value={stats.stopped_week} label="famStopped" tone="text-safe" />
            <Stat value={stats.protected} label="famProtected" />
            <Stat value={pending.length} label="famWaiting" tone={pending.length ? 'text-warn' : 'text-paper'} />
          </div>
          <div className="mt-8 max-w-3xl">
            <AccountLink deviceId={deviceId} />
          </div>
        </Reveal>
      </section>

      {pending.length > 0 && (
        <section className="border-t border-line bg-ink-850/60">
          <div className="shell py-8">
            <SectionHead title="famApprovals" sub="famApprovalsSub" />
            <ul className="mt-8 grid gap-4 lg:grid-cols-2">
              <AnimatePresence initial={false}>
                {pending.map((r) => (
                  <RequestCard key={r.id} r={r} busy={busy === r.id} onDecide={(d) => void act(r.id, () => api.decideRequest(deviceId, r.id, d))} />
                ))}
              </AnimatePresence>
            </ul>
          </div>
        </section>
      )}

      <section className="border-t border-line">
        <div className="shell grid-12 gap-y-10 py-8 lg:py-10">
          <div className="col-span-4 sm:col-span-8 lg:col-span-7">
            <SectionHead
              title="famMembers"
              aside={
                <button type="button" onClick={() => setInviteOpen(true)} className={btn.primary}>
                  <Plus className="size-4" aria-hidden="true" />
                  <T k="famAdd" />
                </button>
              }
            />
            <Stagger as="div" className="mt-6">
              <ul>
                {members.map((m) => (
                  <StaggerItem key={m.device_id} as="li">
                    <ul>
                      <MemberRow
                        m={m}
                        guardianView
                        onStrict={(v) => void act(`s-${m.device_id}`, () => api.setStrict(deviceId, m.device_id, v))}
                        onRemove={() => void act(`r-${m.device_id}`, () => api.removeMember(deviceId, m.device_id))}
                      />
                    </ul>
                  </StaggerItem>
                ))}
              </ul>
            </Stagger>
            <div className="mt-10">
              <Alerts deviceId={deviceId} />
            </div>
          </div>
          <div className="col-span-4 space-y-10 sm:col-span-8 lg:col-span-4 lg:col-start-9">
            <Warnings state={state} />
            <Timeline events={state.events ?? []} />
          </div>
        </div>
      </section>
      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} deviceId={deviceId} />
    </div>
  )
}

function Tile({ to, href, icon: Icon, label, tone = 'bg-ink-850 text-paper' }: { to?: string; href?: string; icon: LucideIcon; label: Bilingual; tone?: string }) {
  const cls = `press flex min-h-32 flex-col justify-between gap-4 rounded-2xl p-5 text-start transition-colors hover:bg-ink-800 ${tone}`
  const body = (
    <>
      <Icon className="size-8 text-gold" aria-hidden="true" />
      <Tx text={label} as="span" className="block text-lg font-medium" arClassName="text-base text-paper-2" split="stack" />
    </>
  )
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <a href={href} className={cls}>
      {body}
    </a>
  )
}

function SosModal({ open, onClose, deviceId }: { open: boolean; onClose: () => void; deviceId: string }) {
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<Helpline[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (open) {
      setSent(null)
      setFailed(false)
    }
  }, [open])
  const send = async () => {
    setBusy(true)
    setFailed(false)
    try {
      setSent((await api.sendSos(deviceId)).helplines)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={<T k={sent ? 'sosSentTitle' : 'sosConfirmTitle'} />}>
      {!sent ? (
        <div>
          <Tx k="sosConfirmBody" className="text-base text-paper-2" split="stack" />
          {failed && <Tx k="famFailed" className="mt-4 text-sm text-warn" split="stack" />}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose} className={`${btn.secondary} h-auto! min-h-12 py-2`}>
              <T k="sosCancel" stacked />
            </button>
            <button type="button" onClick={() => void send()} disabled={busy} className={`${btn.danger} h-auto! min-h-12 py-2`}>
              {busy ? <Spinner /> : <Siren className="size-4 shrink-0" aria-hidden="true" />}
              <T k="sosSend" stacked />
            </button>
          </div>
        </div>
      ) : (
        <div>
          <img src="/illustrations/scam-response.webp" alt="" loading="lazy" className="mb-5 w-full rounded-2xl bg-ink-900" />
          <ol className="space-y-4">
            {(['sosStep1', 'sosStep2', 'sosStep3'] as StringKey[]).map((k, i) => (
              <li key={k} className="flex gap-4">
                <span className="evidence num grid size-8 shrink-0 place-items-center rounded-full bg-scam/15 text-sm text-scam">{i + 1}</span>
                <Tx k={k} className="text-base text-paper" split="stack" />
              </li>
            ))}
          </ol>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <a href="tel:999" className={btn.danger}>
              <Phone className="size-4" aria-hidden="true" />
              999
            </a>
            <a href="tel:8002626" className={btn.secondary}>
              <Phone className="size-4" aria-hidden="true" />
              <T text={{ en: 'Aman 8002626', ar: 'أمان 8002626' }} />
            </a>
          </div>
          <Tx k="sosBanks" as="h4" className="mt-8 text-sm font-medium text-paper-2" split="stack" />
          <ul className="mt-2 max-h-56 overflow-y-auto">
            {sent.map((h) => (
              <li key={h.brand.id} className="border-b border-line">
                <a href={`tel:${h.number}`} className="flex items-center gap-3 py-3 hover:bg-ink-800">
                  <BrandMark brand={h.brand} className="size-8" />
                  <span className="min-w-0 flex-1 truncate text-sm text-paper">
                    <T text={{ en: h.brand.name_en, ar: h.brand.name_ar }} />
                  </span>
                  <span className="evidence text-sm text-gold" dir="ltr">
                    {h.number}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}

function MemberView({ state, reg }: { state: FamilyState; reg: DeviceRegistration }) {
  const [sosOpen, setSosOpen] = useState(false)
  const me = state.me!
  const guardians = (state.members ?? []).filter((m) => m.role === 'guardian' && !m.me)
  const main = guardians[0]
  const mine = (state.events ?? []).filter((e) => e.member === me.name && ['blocked', 'held', 'allowed', 'kept_blocked', 'test'].includes(e.kind))
  return (
    <div>
      <section className="shell grid-12 gap-y-10 pt-8 pb-8 lg:pt-10">
        <Reveal className="col-span-4 sm:col-span-8 lg:col-span-7">
          <p className="evidence text-sm text-gold">
            {state.family?.name} · <T k="famKicker" />
          </p>
          <Tx
            text={{ en: `Hello, ${me.name}`, ar: `مرحبًا ${iso(me.name)}` }}
            as="h1"
            className="display mt-3 text-5xl text-paper sm:text-6xl"
            arClassName="text-3xl text-paper-2 sm:text-4xl"
            split="stack"
          />
          <div className={`mt-8 flex items-start gap-4 rounded-2xl p-5 ${me.status === 'protected' ? 'bg-safe/10' : 'bg-warn/10'}`}>
            {me.status === 'protected' ? <ShieldCheck className="mt-0.5 size-7 shrink-0 text-safe" aria-hidden="true" /> : <Hourglass className="mt-0.5 size-7 shrink-0 text-warn" aria-hidden="true" />}
            <div className="min-w-0 flex-1">
              <Tx k={me.status === 'protected' ? 'famActive' : 'famFinishSetup'} className={`text-lg font-medium ${me.status === 'protected' ? 'text-safe' : 'text-warn'}`} split="stack" />
              {main && (
                <Tx
                  text={{ en: `${main.name} looks after this phone and is alerted if you need help.`, ar: `يرعى ${iso(main.name)} هذا الهاتف ويصله تنبيه إذا احتجت المساعدة.` }}
                  className="mt-1 text-base text-paper-2"
                  split="stack"
                />
              )}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <Tile to="/" icon={ScanSearch} label={S.tileCheck} />
            <Tile to="/?qr=1" icon={QrCode} label={S.tileQr} />
            {main?.phone ? (
              <Tile href={`tel:${main.phone}`} icon={Phone} label={{ en: `Call ${main.name}`, ar: `اتصل بـ${iso(main.name)}` }} />
            ) : (
              <Tile href="tel:8002626" icon={Phone} label={{ en: 'Call Aman 8002626', ar: 'اتصل بأمان 8002626' }} />
            )}
            <Tile to="/protect" icon={ShieldCheck} label={S.tileBlocks} />
          </div>

          <button type="button" onClick={() => setSosOpen(true)} className="press mt-4 flex min-h-20 w-full items-center justify-center gap-4 rounded-2xl bg-scam px-5 py-4 text-lg font-medium text-ink-950 transition-colors hover:bg-[#ec6a63] sm:text-xl">
            <Siren className="size-8 shrink-0" aria-hidden="true" />
            <T k="sosButton" stacked />
          </button>
        </Reveal>

        <div className="col-span-4 space-y-10 sm:col-span-8 lg:col-span-4 lg:col-start-9">
          {me.status !== 'protected' && (
            <section>
              {isAndroid() ? <AndroidSetup reg={reg} /> : <IphoneSetup reg={reg} />}
            </section>
          )}
          <AccountLink deviceId={reg.device_id} />
          <TestProtection />
          <Alerts deviceId={reg.device_id} />
          {mine.length > 0 && <Timeline events={mine} />}
          <button
            type="button"
            onClick={() => void api.removeMember(reg.device_id, reg.device_id).then(() => window.location.reload())}
            className={btn.quiet}
          >
            <T k="famLeave" />
          </button>
        </div>
      </section>
      <SosModal open={sosOpen} onClose={() => setSosOpen(false)} deviceId={reg.device_id} />
    </div>
  )
}

function CreateFamily({ deviceId, onCreated }: { deviceId: string; onCreated: (s: FamilyState) => void }) {
  const { t } = useLang()
  // The Home Screen app starts with empty storage, so whoever opens it there most likely set up a family in Safari.
  const installed = isStandalone()
  const [familyName, setFamilyName] = useState('')
  const [myName, setMyName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setFailed(false)
    try {
      onCreated(await api.createFamily(deviceId, familyName.trim() || t('famNamePh'), myName.trim() || t('famMyNamePh'), phone.trim()))
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="shell grid-12 items-start gap-y-10 pt-8 pb-8 lg:pt-10 lg:pb-10">
      <Reveal className="col-span-4 sm:col-span-8 lg:col-span-6">
        {installed && (
          <div className="mb-8">
            <SignInLink />
          </div>
        )}
        <img src="/brand/family-shield.png" alt="" className="mb-6 size-20" />
        <p className="evidence text-sm text-gold">
          <T k="famKicker" />
        </p>
        <Tx k="famHeroTitle" as="h1" className="display mt-3 text-4xl text-paper sm:text-5xl" arClassName="text-2xl text-paper-2 sm:text-3xl" split="stack" />
        <Tx k="famHeroBody" className="mt-6 max-w-[60ch] text-lg text-paper-2" split="stack" />
        <Stagger as="div" className="mt-10 grid gap-x-8 sm:grid-cols-3" gap={0.08}>
          {(['famPoint1', 'famPoint2', 'famPoint3'] as StringKey[]).map((k, i) => (
            <StaggerItem key={k} className="border-t border-line pt-4 pb-6">
              <span className="evidence num text-sm text-gold">{i + 1}</span>
              <Tx k={k} className="mt-2 text-base text-paper" split="stack" />
            </StaggerItem>
          ))}
        </Stagger>
        <img src="/illustrations/family-shield.webp" alt="A guardian's phone linked to a parent, a child and a helper, with Keep blocked and Allow buttons" loading="lazy" className="mt-4 w-full rounded-[2rem]" />
      </Reveal>
      <Reveal className="col-span-4 sm:col-span-8 lg:col-span-5 lg:col-start-8" delay={0.1}>
        {!installed && <SignInLink />}
        <form onSubmit={(e) => void submit(e)} className={`${installed ? '' : 'mt-6 '}space-y-5 rounded-2xl bg-ink-850 p-6`}>
          <Tx k="famCreateTitle" as="h2" className="display text-2xl text-paper" split="stack" />
          <label className="block">
            <Tx k="famNameLabel" className="mb-2 text-sm text-paper-2" split="stack" />
            <input value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder={t('famNamePh')} maxLength={60} className={field} />
          </label>
          <label className="block">
            <Tx k="famMyName" className="mb-2 text-sm text-paper-2" split="stack" />
            <input value={myName} onChange={(e) => setMyName(e.target.value)} placeholder={t('famMyNamePh')} maxLength={40} className={field} />
          </label>
          <label className="block">
            <Tx k="famPhone" className="mb-2 text-sm text-paper-2" split="stack" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 50 000 0000" inputMode="tel" dir="ltr" maxLength={20} className={field} />
          </label>
          {failed && <Tx k="famFailed" className="text-sm text-warn" split="stack" />}
          <button type="submit" disabled={busy} className={`${btn.primary} w-full`}>
            {busy ? <Spinner /> : <Users className="size-4" aria-hidden="true" />}
            <T k="famCreate" />
          </button>
        </form>
      </Reveal>
    </section>
  )
}

export function Family() {
  const { reg, failed, retry } = useDevice()
  const [state, setState] = useState<FamilyState | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    if (!reg) return
    let alive = true
    let loaded = false
    const load = () =>
      api
        .familyState(reg.device_id)
        .then((s) => {
          if (alive) {
            loaded = true
            setState(s)
            setLoadFailed(false)
          }
        })
        // A failed background refresh keeps the page as it is; only a failed first load shows the error.
        .catch(() => alive && !loaded && setLoadFailed(true))
    void load()
    const timer = window.setInterval(() => void load(), 8000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [reg])

  if (failed || loadFailed) {
    return (
      <div className="shell py-8">
        <ErrorState message="deviceFailed" onRetry={retry} />
      </div>
    )
  }
  if (!reg || !state) {
    return (
      <div className="shell flex items-center gap-3 py-24 text-base text-paper-3">
        <Spinner />
        <T k="settingUp" />
      </div>
    )
  }
  if (!state.family) return <CreateFamily deviceId={reg.device_id} onCreated={setState} />
  if (state.me?.role === 'guardian') return <GuardianView state={state} deviceId={reg.device_id} update={setState} />
  return <MemberView state={state} reg={reg} />
}
