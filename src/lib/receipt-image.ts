import { formatBRL } from '../domain/money'

export interface ReceiptImageItem {
  name: string
  quantity: number
  unitPriceCents: number
  totalCents: number
  wasPromo: boolean
}

export interface ReceiptImageData {
  purchaseId: string
  storeName: string
  purchasedAt: string
  items: ReceiptImageItem[]
  totalCents: number
  savingsCents: number
}

const SCALE = 2
const WIDTH = 384
const OUTER = 16
const PAPER_X = OUTER
const PAPER_W = WIDTH - OUTER * 2
const PAD = 20
const CONTENT_X = PAPER_X + PAD
const CONTENT_W = PAPER_W - PAD * 2
const TOOTH = 10
const MONO = "'Courier New', ui-monospace, monospace"

const INK = '#1f2937'
const MUTED = '#6b7280'
const PAPER = '#ffffff'
const BG = '#eef1f4'

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function paperPath(ctx: CanvasRenderingContext2D, top: number, height: number): void {
  const bottom = top + height
  ctx.beginPath()
  ctx.moveTo(PAPER_X, top + TOOTH)
  for (let x = PAPER_X; x < PAPER_X + PAPER_W; x += TOOTH) {
    ctx.lineTo(x + TOOTH / 2, top)
    ctx.lineTo(x + TOOTH, top + TOOTH)
  }
  ctx.lineTo(PAPER_X + PAPER_W, bottom - TOOTH)
  for (let x = PAPER_X + PAPER_W; x > PAPER_X; x -= TOOTH) {
    ctx.lineTo(x - TOOTH / 2, bottom)
    ctx.lineTo(x - TOOTH, bottom - TOOTH)
  }
  ctx.closePath()
}

function hashBars(value: string): number[] {
  const bars: number[] = []
  let seed = 7
  for (let i = 0; i < value.length; i += 1) seed = (seed * 31 + value.charCodeAt(i)) % 100000
  for (let i = 0; i < 42; i += 1) {
    seed = (seed * 1103515245 + 12345) % 2147483648
    bars.push(1 + (seed % 3))
  }
  return bars
}

function drawBarcode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  value: string,
) {
  const bars = hashBars(value)
  const totalUnits = bars.reduce((sum, b) => sum + b + 1, 0)
  const unit = width / totalUnits
  let cursor = x
  ctx.fillStyle = INK
  bars.forEach((bar, index) => {
    if (index % 2 === 0) ctx.fillRect(cursor, y, bar * unit, 40)
    cursor += (bar + 1) * unit
  })
}

/**
 * Desenha o recibo em canvas. Retorna a altura final (para dimensionar o canvas).
 * Quando `draw` é false, apenas mede o texto para calcular a altura.
 */
function layout(ctx: CanvasRenderingContext2D, data: ReceiptImageData, draw: boolean): number {
  let y = OUTER + TOOTH + PAD

  const setFont = (font: string, color: string) => {
    ctx.font = font
    if (draw) ctx.fillStyle = color
  }
  const text = (value: string, options: { x?: number; gap?: number } = {}) => {
    if (draw) ctx.fillText(value, options.x ?? CONTENT_X, y)
    y += options.gap ?? 0
  }

  const lineHeight = 16

  // Cabeçalho
  setFont(`bold 16px ${MONO}`, INK)
  ctx.textAlign = 'center'
  text(data.storeName, { x: WIDTH / 2, gap: 20 })
  setFont(`11px ${MONO}`, MUTED)
  const date = new Date(data.purchasedAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  text(date, { x: WIDTH / 2, gap: 14 })
  setFont(`9px ${MONO}`, MUTED)
  text('DOCUMENTO AUXILIAR', { x: WIDTH / 2, gap: 11 })
  text('NÃO É DOCUMENTO FISCAL', { x: WIDTH / 2, gap: 18 })

  const dashed = () => {
    if (draw) {
      ctx.strokeStyle = '#c7cdd4'
      ctx.setLineDash([4, 4])
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(CONTENT_X, y)
      ctx.lineTo(CONTENT_X + CONTENT_W, y)
      ctx.stroke()
      ctx.setLineDash([])
    }
    y += 14
  }

  dashed()

  // Itens
  ctx.textAlign = 'left'
  for (const item of data.items) {
    setFont(`bold 12px ${MONO}`, INK)
    const nameLines = wrap(ctx, item.name, CONTENT_W)
    for (const nameLine of nameLines) {
      text(nameLine, { gap: lineHeight })
    }
    setFont(`11px ${MONO}`, MUTED)
    const qty = item.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
    const left = `  ${qty} x ${formatBRL(item.unitPriceCents)}${item.wasPromo ? ' *' : ''}`
    const right = formatBRL(item.totalCents)
    if (draw) {
      ctx.fillStyle = MUTED
      ctx.fillText(left, CONTENT_X, y)
      ctx.textAlign = 'right'
      ctx.fillStyle = INK
      ctx.fillText(right, CONTENT_X + CONTENT_W, y)
      ctx.textAlign = 'left'
    }
    y += lineHeight + 4
  }

  dashed()

  // Totais
  setFont(`11px ${MONO}`, MUTED)
  if (draw) {
    ctx.textAlign = 'right'
    ctx.fillStyle = MUTED
    ctx.fillText(`Qtde. total de itens: ${data.items.length}`, CONTENT_X + CONTENT_W, y)
    ctx.textAlign = 'left'
  }
  y += 18

  setFont(`bold 20px ${MONO}`, INK)
  if (draw) {
    ctx.fillText('VALOR TOTAL', CONTENT_X, y)
    ctx.textAlign = 'right'
    ctx.fillText(formatBRL(data.totalCents), CONTENT_X + CONTENT_W, y)
    ctx.textAlign = 'left'
  }
  y += 26

  if (data.savingsCents > 0) {
    setFont(`11px ${MONO}`, MUTED)
    if (draw) {
      ctx.fillText('Economia', CONTENT_X, y)
      ctx.textAlign = 'right'
      ctx.fillText(formatBRL(data.savingsCents), CONTENT_X + CONTENT_W, y)
      ctx.textAlign = 'left'
    }
    y += 18
  }

  y += 6
  dashed()

  // Rodapé
  ctx.textAlign = 'center'
  setFont(`11px ${MONO}`, MUTED)
  text('Obrigado e volte sempre!', { x: WIDTH / 2, gap: 16 })
  setFont(`10px ${MONO}`, INK)
  text('CarrinhoSmart', { x: WIDTH / 2, gap: 20 })

  if (draw) {
    const barcodeW = CONTENT_W - 40
    drawBarcode(ctx, CONTENT_X + 20, y, barcodeW, data.purchaseId)
  }
  y += 40 + 8
  setFont(`9px ${MONO}`, MUTED)
  text(data.purchaseId.toUpperCase(), { x: WIDTH / 2, gap: 12 })

  return y + TOOTH + PAD
}

export async function downloadReceiptPng(data: ReceiptImageData, filename: string): Promise<void> {
  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) throw new Error('Canvas indisponível')
  const height = Math.ceil(layout(measure, data, false))

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * SCALE
  canvas.height = height * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível')
  ctx.scale(SCALE, SCALE)

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, WIDTH, height)

  const paperHeight = height - OUTER * 2
  ctx.save()
  ctx.shadowColor = 'rgba(15, 23, 42, 0.18)'
  ctx.shadowBlur = 14
  ctx.shadowOffsetY = 4
  paperPath(ctx, OUTER, paperHeight)
  ctx.fillStyle = PAPER
  ctx.fill()
  ctx.restore()

  ctx.save()
  paperPath(ctx, OUTER, paperHeight)
  ctx.clip()
  ctx.textBaseline = 'alphabetic'
  layout(ctx, data, true)
  ctx.restore()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Falha ao gerar a imagem')

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function receiptFilename(data: ReceiptImageData): string {
  const store = data.storeName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const date = data.purchasedAt.slice(0, 10)
  return `recibo-${store || 'compra'}-${date}.png`
}
