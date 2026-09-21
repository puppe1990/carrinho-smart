// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBarcodeCamera, type UseBarcodeCameraResult } from './use-barcode-camera'

const decodeFromVideoElement = vi.hoisted(() => vi.fn())

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: class {
    decodeFromVideoElement(...args: unknown[]) {
      return decodeFromVideoElement(...args)
    }
  },
}))

vi.mock('@zxing/library', () => ({
  DecodeHintType: { POSSIBLE_FORMATS: 0, TRY_HARDER: 1 },
  BarcodeFormat: {
    EAN_13: 'ean_13',
    EAN_8: 'ean_8',
    UPC_A: 'upc_a',
    UPC_E: 'upc_e',
    CODE_128: 'code_128',
    CODE_39: 'code_39',
    ITF: 'itf',
  },
}))

let latest: UseBarcodeCameraResult

function Harness({ onDetect }: { onDetect: (code: string) => void }) {
  const camera = useBarcodeCamera({ onDetect })
  latest = camera
  return createElement('video', { ref: camera.videoRef })
}

beforeEach(() => {
  decodeFromVideoElement.mockReset()
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) },
  })
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
})

afterEach(() => cleanup())

describe('useBarcodeCamera fallback', () => {
  it('usa o ZXing quando a BarcodeDetector nativa não existe', async () => {
    const onDetect = vi.fn()
    decodeFromVideoElement.mockImplementation(
      async (
        _video: unknown,
        callback: (result: unknown, error: unknown, controls: unknown) => void,
      ) => {
        callback({ getText: () => '7896089011982' }, undefined, { stop: vi.fn() })
        callback({ getText: () => '7896089011982' }, undefined, { stop: vi.fn() })
        return { stop: vi.fn() }
      },
    )

    render(createElement(Harness, { onDetect }))
    await act(async () => {
      await latest.start()
    })

    expect(decodeFromVideoElement).toHaveBeenCalledTimes(1)
    expect(latest.usingFallback).toBe(true)
    expect(latest.autoDetectUnsupported).toBe(false)
    expect(onDetect).toHaveBeenCalledTimes(1)
    expect(onDetect).toHaveBeenCalledWith('7896089011982')
  })

  it('descarta leituras isoladas que não se confirmam', async () => {
    const onDetect = vi.fn()
    decodeFromVideoElement.mockImplementation(
      async (
        _video: unknown,
        callback: (result: unknown, error: unknown, controls: unknown) => void,
      ) => {
        callback({ getText: () => '6415181089791' }, undefined, { stop: vi.fn() })
        callback({ getText: () => '884808711517' }, undefined, { stop: vi.fn() })
        return { stop: vi.fn() }
      },
    )

    render(createElement(Harness, { onDetect }))
    await act(async () => {
      await latest.start()
    })

    expect(onDetect).not.toHaveBeenCalled()
  })

  it('marca como sem suporte quando o fallback também falha', async () => {
    const onDetect = vi.fn()
    decodeFromVideoElement.mockRejectedValue(new Error('boom'))

    render(createElement(Harness, { onDetect }))
    await act(async () => {
      await latest.start()
    })

    expect(latest.usingFallback).toBe(false)
    expect(latest.autoDetectUnsupported).toBe(true)
    expect(onDetect).not.toHaveBeenCalled()
  })
})
