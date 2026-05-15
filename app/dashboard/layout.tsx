import { RouteGuard } from '@/components/route-guard'

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <RouteGuard allow={['owner', 'admin']}>
      <div className="app-shell px-4 py-5">{children}</div>
    </RouteGuard>
  )
}
