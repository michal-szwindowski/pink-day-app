import { RouteGuard } from '@/components/route-guard'

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <RouteGuard allow={['owner', 'admin']}>
      <div className="mx-auto min-h-screen w-full max-w-7xl px-4 py-5 lg:px-8 lg:py-8">
        <div className="lg:min-h-[calc(100vh-4rem)] lg:rounded-[36px] lg:border lg:border-white/80 lg:bg-white/50 lg:p-6 lg:shadow-[0_28px_90px_-48px_rgba(107,55,78,0.55)] lg:backdrop-blur">
          {children}
        </div>
      </div>
    </RouteGuard>
  )
}
