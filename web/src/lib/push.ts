import { api } from './api'
import { readItem, writeItem } from './storage'

const ALERTS_KEY = 'ti.alerts'

export type AlertsState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

export function isIOS(): boolean {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent)
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

export function alertsState(): AlertsState {
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission === 'granted' && readItem(ALERTS_KEY) === 'on') return 'on'
  return 'off'
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])
}

export async function enableAlerts(deviceId: string): Promise<AlertsState> {
  const permission = await Notification.requestPermission()
  if (permission === 'denied') return 'denied'
  if (permission !== 'granted') return 'off'
  const registration = await withTimeout(navigator.serviceWorker.ready, 6000)
  const key = await api.vapidKey()
  const existing = await registration.pushManager.getSubscription()
  const sub =
    existing ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }))
  await api.savePush(deviceId, sub.toJSON())
  writeItem(ALERTS_KEY, 'on')
  return 'on'
}
