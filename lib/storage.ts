const isBrowser = typeof window !== 'undefined'

export const createStorage = (key: string) => {
  const read = () => {
    if (!isBrowser) return null
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch (error) {
      console.warn('Failed to read storage for key', key, error)
      return null
    }
  }

  const write = (value: any) => {
    if (!isBrowser) return
    if (value === null) {
      window.localStorage.removeItem(key)
      return
    }
    window.localStorage.setItem(key, JSON.stringify(value))
  }

  return { read, write }
}

