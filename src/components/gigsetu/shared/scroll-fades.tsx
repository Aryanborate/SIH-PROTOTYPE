'use client'

// Edge fades for horizontally scrollable containers — gradients appear only
// when there is hidden content in that direction (scroll/resize aware).
// Uses a callback ref so late-mounted scrollers (post-loading states) attach correctly.

import { useCallback, useEffect, useState } from 'react'

interface EdgeFades {
  left: boolean
  right: boolean
}

export function useEdgeFades<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null)
  const [fades, setFades] = useState<EdgeFades>({ left: false, right: false })

  // Callback ref: fires when the scroller mounts/unmounts — covers views that
  // render a loading skeleton first and the real tab bar later.
  const ref = useCallback((n: T | null) => setNode(n), [])

  useEffect(() => {
    if (!node) return
    const update = () => {
      setFades({
        left: node.scrollLeft > 4,
        right: node.scrollLeft + node.clientWidth < node.scrollWidth - 4,
      })
    }
    update()
    node.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(node)
    return () => {
      node.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [node])

  return { ref, fades }
}

/** Gradient overlays for a relatively-positioned scroll container (pointer-events-none, theme-aware). */
export function EdgeFadeOverlays({ fades }: { fades: EdgeFades }) {
  return (
    <>
      {fades.left && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 rounded-l-lg bg-gradient-to-r from-background via-background/80 to-transparent"
        />
      )}
      {fades.right && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 rounded-r-lg bg-gradient-to-l from-background via-background/80 to-transparent"
        />
      )}
    </>
  )
}
