export function LoadingScreen({ label = 'Ładowanie aplikacji...' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#ffd2e2] border-t-[#ff6e9d]" />
      <p className="text-sm text-[#7f6870]">{label}</p>
    </div>
  )
}
