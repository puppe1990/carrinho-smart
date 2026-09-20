export interface IconProps {
  name: string
  className?: string
  filled?: boolean
}

export function Icon({ name, className = 'text-[20px]', filled = false }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined ${filled ? 'fill' : ''} ${className}`}
    >
      {name}
    </span>
  )
}
