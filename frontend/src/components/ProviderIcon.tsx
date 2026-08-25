import { cn } from '@/lib/utils'

const PROVIDER_ICONS: Record<string, string> = {
  groq: '/providers/groq.png',
  openai: '/providers/openai.png',
  gemini: '/providers/gemini.png',
  mistral: '/providers/mistral.png',
}

interface ProviderIconProps {
  name: string
  size?: number
  className?: string
}

export default function ProviderIcon({ name, size = 24, className }: ProviderIconProps) {
  const baseName = name.replace(/-\d+$/, '')
  const icon = PROVIDER_ICONS[baseName]

  if (!icon) {
    return (
      <div
        className={cn('rounded-md bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground', className)}
        style={{ width: size, height: size }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    )
  }

  return (
    <img
      src={icon}
      alt={name}
      className={cn('rounded-md', className)}
      style={{ width: size, height: size }}
    />
  )
}
