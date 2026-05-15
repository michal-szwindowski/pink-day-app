'use client'

import { Share2, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Card } from '@/components/ui/card'

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function isStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

export function PwaInstallHelp() {
  const [showIosHelp, setShowIosHelp] = useState(false)

  useEffect(() => {
    setShowIosHelp(isIosDevice() && !isStandaloneMode())
  }, [])

  if (!showIosHelp) {
    return null
  }

  return (
    <Card className="space-y-4 bg-[linear-gradient(135deg,#fff8fb,#fff1df)]">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-white/80 p-3 text-[#d34d7d]">
          <Smartphone size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#422c36]">Dodaj Pink Day do ekranu</h2>
          <p className="text-sm leading-6 text-[#7f6870]">
            Na iPhonie nie pojawia się automatyczny przycisk instalacji. Trzeba zrobić to ręcznie.
          </p>
        </div>
      </div>

      <div className="rounded-3xl bg-white/75 p-4 text-sm leading-6 text-[#6f5b63]">
        <p className="flex items-center gap-2 font-semibold text-[#422c36]">
          <Share2 size={16} />
          Otwórz stronę w Safari
        </p>
        <p className="mt-2">1. Stuknij `Udostępnij`.</p>
        <p>2. Wybierz `Dodaj do ekranu początkowego`.</p>
        <p>3. Potwierdź nazwę `Pink Day`.</p>
      </div>
    </Card>
  )
}
