type Area = 'local' | 'session'

function area(kind: Area): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function readItem(key: string, kind: Area = 'local'): string | null {
  try {
    return area(kind)?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function writeItem(key: string, value: string, kind: Area = 'local'): void {
  try {
    area(kind)?.setItem(key, value)
  } catch {
    return
  }
}

export function removeItem(key: string, kind: Area = 'local'): void {
  try {
    area(kind)?.removeItem(key)
  } catch {
    return
  }
}

export function readJson<T>(key: string, kind: Area = 'local'): T | null {
  const raw = readItem(key, kind)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown, kind: Area = 'local'): void {
  writeItem(key, JSON.stringify(value), kind)
}
