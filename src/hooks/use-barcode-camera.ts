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
  /** true quando o navegador não expõe a API de decodificação nativa. */
  autoDetectUnsupported: boolean
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
  const lastHitRef = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const onDetectRef = useRef(onDetect)
  onDetectRef.current = onDetect

  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [supportedFormats, setSupportedFormats] = useState<string[]>([])
  const [autoDetectUnsupported, setAutoDetectUnsupported] = useState(false)

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
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
        if (hit?.rawValue) {
          const normalized = normalizeBarcode(hit.rawValue)
          const now = Date.now()
          const isDuplicate =
            normalized === lastHitRef.current.code && now - lastHitRef.current.at < cooldownMs
          if (normalized && !isDuplicate) {
            lastHitRef.current = { code: normalized, at: now }
            onDetectRef.current(normalized)
          }
        }
      } catch {
        // frames ocasionais falham (foco/exposição) — segue o loop
      }
    }

    rafRef.current = requestAnimationFrame(() => void scanLoop())
  }, [cooldownMs])

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
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) throw new Error('Elemento de vídeo indisponível')

      video.srcObject = stream
      video.setAttribute('playsinline', 'true')
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
      } else {
        detectorRef.current = null
        setSupportedFormats([])
        setAutoDetectUnsupported(true)
      }

      setStatus('running')
      rafRef.current = requestAnimationFrame(() => void scanLoop())
    } catch (cause) {
      const message = describeCameraError(cause)
      setError(message)
      setStatus('error')
      stop()
    }
  }, [scanLoop, stop])

  useEffect(() => stop, [stop])

  return { videoRef, status, error, autoDetectUnsupported, supportedFormats, start, stop }
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
