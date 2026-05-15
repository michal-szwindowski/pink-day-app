import type { ReactNode } from 'react'

export function ModalOverlay({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-[#3d2632]/35 px-4 py-6">
      {children}
    </div>
  )
}
