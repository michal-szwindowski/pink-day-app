import { LoadingScreen } from '@/components/loading-screen'
import { MemberShell } from '@/components/member-shell'

export function MemberLoadingScreen({ label }: { label: string }) {
  return (
    <MemberShell>
      <LoadingScreen label={label} />
    </MemberShell>
  )
}
