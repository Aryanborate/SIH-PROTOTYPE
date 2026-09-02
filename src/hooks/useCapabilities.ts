import { useMemo } from 'react'

export type QualityTier = 'high' | 'medium' | 'low'

export interface Capabilities {
  /** WebGL available at all — otherwise the site renders designed static fallbacks */
  webgl: boolean
  reducedMotion: boolean
  isTouch: boolean
  isMobile: boolean
  quality: QualityTier
  particleCount: number
  dpr: [number, number]
}

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    )
  } catch {
    return false
  }
}

/**
 * Device capability detection — computed once per mount.
 * Mobile / low-end devices keep live 3D but with reduced density, DPR and motion.
 */
export function useCapabilities(): Capabilities {
  return useMemo(() => {
    const webgl = detectWebGL()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isTouch = window.matchMedia('(pointer: coarse)').matches
    const isMobile = isTouch || window.innerWidth < 768

    const cores = navigator.hardwareConcurrency ?? 4
    const nav = navigator as Navigator & { deviceMemory?: number }
    const mem = nav.deviceMemory ?? 8

    let quality: QualityTier = 'high'
    if (isMobile || cores <= 4 || mem <= 4) quality = 'low'
    else if (cores <= 8 || mem <= 8) quality = 'medium'

    const particleCount = quality === 'high' ? 900 : quality === 'medium' ? 450 : 220
    const dpr: [number, number] =
      quality === 'high' ? [1, 2] : quality === 'medium' ? [1, 1.5] : [1, 1.25]

    return { webgl, reducedMotion, isTouch, isMobile, quality, particleCount, dpr }
  }, [])
}
