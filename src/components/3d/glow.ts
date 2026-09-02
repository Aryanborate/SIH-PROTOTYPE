import * as THREE from 'three'

const cache = new Map<string, THREE.CanvasTexture>()

/** Soft radial glow sprite texture — cheap bloom without postprocessing. */
export function glowTexture(color = '#6366F1'): THREE.CanvasTexture {
  const hit = cache.get(color)
  if (hit) return hit
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, color)
  gradient.addColorStop(0.35, `${color}77`)
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  cache.set(color, texture)
  return texture
}
