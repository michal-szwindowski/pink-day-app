'use client'

import { Download, MoreVertical, Share2, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

type InstallPlatform = 'android' | 'ios' | 'other'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function getInstallPlatform(): InstallPlatform {
  const userAgent = window.navigator.userAgent
  const isIpadOs = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1

  if (/android/i.test(userAgent)) {
    return 'android'
  }

  if (/iphone|ipad|ipod/i.test(userAgent) || isIpadOs) {
    return 'ios'
  }

  return 'other'
}

function isStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

export function PwaInstallHelp() {
  const [platform, setPlatform] = useState<InstallPlatform>('other')
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(true)

  useEffect(() => {
    setPlatform(getInstallPlatform())
    setIsStandalone(isStandaloneMode())

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    const handleInstalled = () => {
      setInstallPrompt(null)
      setIsStandalone(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  if (isStandalone || platform === 'other') {
    return null
  }

  if (platform === 'ios') {
    return (
      <Card className="space-y-4 bg-[linear-gradient(135deg,#fff8fb,#fff1df)]">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-white/80 p-3 text-[#d34d7d]">
            <Smartphone size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#422c36]">Dodaj Pink Day do ekranu</h2>
            <p className="text-sm leading-6 text-[#7f6870]">
              Na iPhonie i iPadzie trzeba dodać aplikację ręcznie przez menu udostępniania.
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-white/75 p-4 text-sm leading-6 text-[#6f5b63]">
          <p className="flex items-center gap-2 font-semibold text-[#422c36]">
            <Share2 size={16} />
            Jak dodać
          </p>
          <p className="mt-2">1. Stuknij `Udostępnij`.</p>
          <p>2. Wybierz `Dodaj do ekranu początkowego`.</p>
          <p>3. Potwierdź nazwę `Pink Day`.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="space-y-4 bg-[linear-gradient(135deg,#fff8fb,#fff1df)]">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-white/80 p-3 text-[#d34d7d]">
          <Smartphone size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#422c36]">Zainstaluj Pink Day</h2>
          <p className="text-sm leading-6 text-[#7f6870]">
            Na Androidzie możesz zainstalować aplikację jak zwykłą apkę webową.
          </p>
        </div>
      </div>

      {installPrompt ? (
        <Button
          fullWidth
          onClick={() => {
            void installPrompt.prompt().finally(() => setInstallPrompt(null))
          }}
        >
          <Download className="mr-2" size={16} />
          Zainstaluj aplikację
        </Button>
      ) : (
        <div className="rounded-3xl bg-white/75 p-4 text-sm leading-6 text-[#6f5b63]">
          <p className="flex items-center gap-2 font-semibold text-[#422c36]">
            <MoreVertical size={16} />
            Jeśli nie ma przycisku
          </p>
          <p className="mt-2">1. Otwórz menu przeglądarki.</p>
          <p>2. Wybierz `Zainstaluj aplikację` albo `Dodaj do ekranu głównego`.</p>
        </div>
      )}
    </Card>
  )
}
