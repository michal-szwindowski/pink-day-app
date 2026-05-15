'use client'

import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import {
  createContext,
  type PropsWithChildren,
  use,
  useEffect,
  useEffectEvent,
  useState,
} from 'react'

type ToastTone = 'success' | 'error' | 'info'

type Toast = {
  count: number
  id: number
  message: string
  tone: ToastTone
}

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void
}

const MAX_VISIBLE_TOASTS = 2
const ToastContext = createContext<ToastContextValue | null>(null)

const toneClasses: Record<ToastTone, string> = {
  error: 'border-[#f3c5d1] bg-[#fff1f4] text-[#a2435f]',
  info: 'border-[#f4dfc8] bg-[#fff8ef] text-[#8b6240]',
  success: 'border-[#ccebd8] bg-[#eefaf3] text-[#2f7753]',
}

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useEffectEvent((toastId: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId))
  })

  useEffect(() => {
    if (toasts.length === 0) {
      return
    }

    const timeoutIds = toasts.map((toast) =>
      window.setTimeout(() => removeToast(toast.id), toast.tone === 'error' ? 4200 : 2800),
    )

    return () => {
      timeoutIds.forEach((timeoutId) => {
        window.clearTimeout(timeoutId)
      })
    }
  }, [toasts])

  return (
    <ToastContext
      value={{
        showToast: (message, tone = 'info') => {
          setToasts((current) => {
            const duplicate = current.find(
              (toast) => toast.message === message && toast.tone === tone,
            )

            if (duplicate) {
              return current.map((toast) =>
                toast.id === duplicate.id
                  ? {
                      ...toast,
                      count: toast.count + 1,
                      id: Date.now() + Math.random(),
                    }
                  : toast,
              )
            }

            return [
              ...current.slice(-(MAX_VISIBLE_TOASTS - 1)),
              {
                count: 1,
                id: Date.now() + Math.random(),
                message,
                tone,
              },
            ]
          })
        },
      }}
    >
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            className={`toast-enter pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[24px] border px-4 py-3 shadow-[0_18px_40px_-24px_rgba(66,44,54,0.48)] backdrop-blur ${toneClasses[toast.tone]}`}
            key={toast.id}
          >
            <div className="mt-0.5 shrink-0">
              {toast.tone === 'success' ? <CheckCircle2 size={18} /> : null}
              {toast.tone === 'error' ? <XCircle size={18} /> : null}
              {toast.tone === 'info' ? <Info size={18} /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-5">{toast.message}</p>
              {toast.count > 1 ? (
                <p className="mt-0.5 text-xs opacity-75">Powtórzono {toast.count} razy</p>
              ) : null}
            </div>
            <button
              className="rounded-full p-1 opacity-70 transition hover:opacity-100"
              onClick={() => removeToast(toast.id)}
              type="button"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  )
}

export function useToast() {
  const context = use(ToastContext)

  if (!context) {
    throw new Error('useToast must be used inside ToastProvider.')
  }

  return context
}
