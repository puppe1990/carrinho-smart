import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizeBarcode } from '../domain/barcode'

export type CameraStatus = 'idle' | 'starting' | 'running' | 'error'

export interface UseBarcodeCameraOptions {
  /** Disparado quando um código é decodificado (já normalizado). */
  onDetect: (code: string) => void
  /** Ignora novas leituras por este tempo após um detect (ms). */
  cooldownMs?: number
}

export interface UseBarcodeCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>
  status: CameraStatus
  error: string | null
  /** true quando nenhum decodificador (nativo ou fallback) está disponível. */
  autoDetectUnsupported: boolean
  /** true quando a leitura usa o decoder JS (ZXing) em vez da API nativa. */
  usingFallback: boolean
  /** Formatos suportados pela BarcodeDetector nativa (quando disponível). */
  supportedFormats: string[]
  start: () => Promise<void>
  stop: () => void
}

interface DetectedBarcodeLike {
  rawValue?: string
  format?: string
}

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcodeLike[]>
}

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike

interface ScannerControlsLike {
  stop: () => void
}

const PREFERRED_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'itf',
  'qr_code',
]

const FALLBACK_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf']

/** Leituras idênticas consecutivas exigidas antes de aceitar um código (evita misreads). */
const CONFIRMATIONS = 2

function getDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined') return null
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  return ctor ?? null
}

export function useBarcodeCamera({
  onDetect,
  cooldownMs = 1500,
}: UseBarcodeCameraOptions): UseBarcodeCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const detectorRef = useRef<BarcodeDetectorLike | null>(null)
  const zxingControlsRef = useRef<ScannerControlsLike | null>(null)
  const lastHitRef = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const pendingRef = useRef<{ code: string; count: number }>({ code: '', count: 0 })
  const onDetectRef = useRef(onDetect)
  onDetectRef.current = onDetect

  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [supportedFormats, setSupportedFormats] = useState<string[]>([])
  const [autoDetectUnsupported, setAutoDetectUnsupported] = useState(false)
  const [usingFallback, setUsingFallback] = useState(false)

  const emitCode = useCallback(
    (raw: string | undefined) => {
      if (!raw) return
      const normalized = normalizeBarcode(raw)
      if (!normalized) return
      const now = Date.now()
      const last = lastHitRef.current
      if (normalized === last.code && now - last.at < cooldownMs) return

      const pending = pendingRef.current
      pendingRef.current =
        pending.code === normalized
          ? { code: normalized, count: pending.count + 1 }
          : { code: normalized, count: 1 }
      if (pendingRef.current.count < CONFIRMATIONS) return

      lastHitRef.current = { code: normalized, at: now }
      pendingRef.current = { code: '', count: 0 }
      onDetectRef.current(normalized)
    },
    [cooldownMs],
  )

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    zxingControlsRef.current?.stop()
    zxingControlsRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('idle')
  }, [])

  const scanLoop = useCallback(async () => {
    const video = videoRef.current
    if (!video) return

    // A API nativa pode não existir no início (ex.: permissão concedida depois).
    // Detecta tardiamente e liga o loop de leitura.
    if (!detectorRef.current) {
      const Detector = getDetectorCtor()
      if (Detector) {
        detectorRef.current = new Detector()
        setAutoDetectUnsupported(false)
      }
    }

    const activeDetector = detectorRef.current
    if (activeDetector && video.readyState >= 2) {
      try {
        const codes = await activeDetector.detect(video)
        const hit = codes.find((code) => code.rawValue)
        emitCode(hit?.rawValue)
      } catch {
        // frames ocasionais falham (foco/exposição) — segue o loop
      }
    }

    rafRef.current = requestAnimationFrame(() => void scanLoop())
  }, [emitCode])

  const start = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador não expõe a câmera (use HTTPS ou localhost).')
      setStatus('error')
      return
    }

    setError(null)
    setStatus('starting')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream
      await applyContinuousFocus(stream)
      const video = videoRef.current
      if (!video) throw new Error('Elemento de vídeo indisponível')

      video.srcObject = stream
      video.setAttribute('playsinline', 'true')
      video.setAttribute('webkit-playsinline', 'true')
      await video.play().catch(() => undefined)

      const Detector = getDetectorCtor()
      if (Detector) {
        const formats = await getSupportedFormats(Detector)
        detectorRef.current = formats.length
          ? new Detector({
              formats: formats.filter((format) => PREFERRED_FORMATS.includes(format)),
            })
          : new Detector()
        setSupportedFormats(formats)
        setAutoDetectUnsupported(false)
        setUsingFallback(false)
        setStatus('running')
        rafRef.current = requestAnimationFrame(() => void scanLoop())
        return
      }

      const started = await startZxingFallback(video, emitCode, zxingControlsRef)
      detectorRef.current = null
      setSupportedFormats(started ? FALLBACK_FORMATS : [])
      setAutoDetectUnsupported(!started)
      setUsingFallback(started)
      setStatus('running')
    } catch (cause) {
      const message = describeCameraError(cause)
      setError(message)
      setStatus('error')
      stop()
    }
  }, [emitCode, scanLoop, stop])

  useEffect(() => stop, [stop])

  return {
    videoRef,
    status,
    error,
    autoDetectUnsupported,
    usingFallback,
    supportedFormats,
    start,
    stop,
  }
}

async function getSupportedFormats(Detector: BarcodeDetectorCtor): Promise<string[]> {
  try {
    const getter = (Detector as unknown as { getSupportedFormats?: () => Promise<string[]> })
      .getSupportedFormats
    if (typeof getter === 'function') {
      const formats = await (
        Detector as unknown as { getSupportedFormats(): Promise<string[]> }
      ).getSupportedFormats()
      return Array.isArray(formats) ? formats : []
    }
  } catch {
    // segue sem a lista explícita
  }
  return []
}

/** Pede foco contínuo quando o dispositivo suporta (melhora muito a leitura de 1D). */
async function applyContinuousFocus(stream: MediaStream): Promise<void> {
  try {
    const track = stream.getVideoTracks()[0]
    const capabilities = track?.getCapabilities?.() as { focusMode?: string[] } | undefined
    if (capabilities?.focusMode?.includes('continuous')) {
      await track.applyConstraints({
        advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
      })
    }
  } catch {
    // segue sem foco contínuo
  }
}

/**
 * Decoder em JS (ZXing) para navegadores sem a Barcode Detection API (ex.: Safari/iOS).
 * Importado sob demanda para não pesar o bundle principal.
 */
async function startZxingFallback(
  video: HTMLVideoElement,
  emitCode: (raw: string | undefined) => void,
  controlsRef: { current: ScannerControlsLike | null },
): Promise<boolean> {
  try {
    const [{ BrowserMultiFormatReader }, zxing] = await Promise.all([
      import('@zxing/browser'),
      import('@zxing/library'),
    ])
    const hints = new Map<number, unknown>()
    hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [
      zxing.BarcodeFormat.EAN_13,
      zxing.BarcodeFormat.EAN_8,
      zxing.BarcodeFormat.UPC_A,
      zxing.BarcodeFormat.UPC_E,
      zxing.BarcodeFormat.CODE_128,
      zxing.BarcodeFormat.CODE_39,
      zxing.BarcodeFormat.ITF,
    ])
    hints.set(zxing.DecodeHintType.TRY_HARDER, true)

    const reader = new BrowserMultiFormatReader(hints as Map<never, never>, {
      delayBetweenScanAttempts: 150,
    })
    const controls = await reader.decodeFromVideoElement(video, (result) => {
      if (result) emitCode(result.getText())
    })
    controlsRef.current = controls
    return true
  } catch {
    return false
  }
}

function describeCameraError(cause: unknown): string {
  const name = (cause as { name?: string })?.name ?? ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Permissão de câmera negada. Autorize o acesso para bipar pela câmera.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'Nenhuma câmera encontrada neste dispositivo.'
  }
  if (name === 'NotReadableError') {
    return 'A câmera está em uso por outro aplicativo.'
  }
  return 'Não foi possível iniciar a câmera.'
}
