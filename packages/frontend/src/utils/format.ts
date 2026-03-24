import type { VerificationStatus, EvidenceLevel } from '@/types'

export function formatScore(score: number): string {
  return `${Math.round(score)}/100`
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function getScoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-400'
  if (score >= 50) return 'text-yellow-400'
  if (score >= 25) return 'text-orange-400'
  return 'text-red-400'
}

export function getScoreBgColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500/20'
  if (score >= 50) return 'bg-yellow-500/20'
  if (score >= 25) return 'bg-orange-500/20'
  return 'bg-red-500/20'
}

export function getVerificationBadge(status: VerificationStatus): {
  label: string
  color: string
  icon: string
} {
  switch (status) {
    case 'verified':
      return { label: 'Verified', color: 'text-emerald-400 bg-emerald-500/15', icon: 'ShieldCheck' }
    case 'partially_verified':
      return { label: 'Partially Verified', color: 'text-yellow-400 bg-yellow-500/15', icon: 'ShieldAlert' }
    case 'weak_signal':
      return { label: 'Weak Signal', color: 'text-orange-400 bg-orange-500/15', icon: 'AlertTriangle' }
    case 'stale':
      return { label: 'Stale', color: 'text-gray-400 bg-gray-500/15', icon: 'Clock' }
    case 'unverified':
      return { label: 'Unverified', color: 'text-red-400 bg-red-500/15', icon: 'ShieldOff' }
  }
}

export function getEvidenceBadge(level: EvidenceLevel): {
  label: string
  color: string
} {
  switch (level) {
    case 'verified':
      return { label: 'Strong Evidence', color: 'text-emerald-400 bg-emerald-500/15' }
    case 'inferred':
      return { label: 'Inferred', color: 'text-blue-400 bg-blue-500/15' }
    case 'weak_signal':
      return { label: 'Weak Signal', color: 'text-orange-400 bg-orange-500/15' }
    case 'stale':
      return { label: 'Stale Data', color: 'text-gray-400 bg-gray-500/15' }
  }
}

export function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 3) + '...'
}
