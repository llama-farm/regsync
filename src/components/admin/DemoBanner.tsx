import { ShieldAlert } from 'lucide-react'

export function DemoBanner() {
  return (
    <div className="mb-4 flex items-start gap-3 text-sm bg-amber-500/10 border border-amber-500/20 text-amber-200 px-4 py-3 rounded-lg">
      <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-medium text-amber-400">Shared demo environment</p>
        <p className="text-amber-200/80 mt-0.5">
          Do not upload documents containing PII, PHI, or confidential information.
          All uploads are visible to other demo users.
        </p>
      </div>
    </div>
  )
}
