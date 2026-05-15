import { RouteGuard } from '@/components/route-guard'

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <RouteGuard allow={['owner', 'admin']}>
      <div className="mx-auto min-h-screen w-full max-w-6xl px-4 py-5 lg:px-8 lg:py-8">
        {children}
      </div>
    </RouteGuard>
  )
}
