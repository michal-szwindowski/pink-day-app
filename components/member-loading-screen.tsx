import { BottomNav } from '@/components/bottom-nav'
import { LoadingScreen } from '@/components/loading-screen'

export function MemberLoadingScreen({ label }: { label: string }) {
  return (
    <div className="app-shell px-4 pb-32 pt-5">
      <LoadingScreen label={label} />
      <BottomNav />
    </div>
  )
}
