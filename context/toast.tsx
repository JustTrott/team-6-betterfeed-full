import { createContext, useContext, useMemo, useState, ReactNode } from 'react'
import { cn } from '../lib/utils'

interface Toast {
  id: string
  variant?: 'default' | 'success' | 'error'
  title: string
  description?: string
}

interface ToastContextType {
  toasts: Toast[]
  pushToast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

const isBrowser = typeof window !== 'undefined'

const createId = () =>
  isBrowser && typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(16).slice(2)

const VARIANT_STYLES = {
  default: 'bf-toast--default',
  success: 'bf-toast--success',
  error: 'bf-toast--error',
}

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const pushToast = (toast: Omit<Toast, 'id'>) => {
    const id = createId()
    setToasts((prev) => [...prev, { id, variant: 'default', ...toast }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, 3200)
  }

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }

  const value = useMemo(() => ({ toasts, pushToast, dismissToast }), [toasts])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="bf-toast-layer">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'bf-toast',
              VARIANT_STYLES[toast.variant ?? 'default']
            )}
          >
            <div className="bf-toast__body">
              <div>
                <p className="bf-toast__title">{toast.title}</p>
                {toast.description ? <p className="bf-toast__description">{toast.description}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="bf-toast__close"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

