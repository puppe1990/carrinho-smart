import { Icon } from './Icon'

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container text-on-primary">
        <Icon name="shopping_cart" className="text-[18px]" filled />
      </div>
      {!compact && (
        <span className="text-[17px] font-extrabold tracking-tight text-on-surface">
          Carrinho<span className="text-primary">Smart</span>
        </span>
      )}
    </div>
  )
}
