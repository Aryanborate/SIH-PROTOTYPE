import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { skillNetworkEdges, skillNetworkNodes } from '../../data/skills'
import { useInViewport } from '../../hooks/useInViewport'
import { cn } from '../../lib/utils'
import { glowTexture } from './glow'

/**
 * Skill constellation — a structured technical diagram in 2.5D.
 * Render loop pauses when scrolled out of view. Desktop only;
 * the section falls back to interactive cards on small screens.
 */
function NetworkContents({ reducedMotion }: { reducedMotion: boolean }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const byId = useMemo(
    () => Object.fromEntries(skillNetworkNodes.map((n) => [n.id, n])),
    [],
  )
  const refs = useRef<Array<THREE.Group | null>>([])
  const parallax = useRef<THREE.Group>(null)
  const glow = useMemo(() => glowTexture('#6366F1'), [])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    refs.current.forEach((g, i) => {
      if (!g) return
      const node = skillNetworkNodes[i]
      g.position.y = node.pos[1] + Math.sin(t * 0.7 + i * 1.7) * 0.06
      const target = hovered === node.id ? 1.28 : 1
      const s = THREE.MathUtils.lerp(g.scale.x || 1, target, 1 - Math.exp(-10 * delta))
      g.scale.setScalar(s)
    })
    if (parallax.current && !reducedMotion) {
      parallax.current.rotation.y = THREE.MathUtils.lerp(
        parallax.current.rotation.y,
        state.pointer.x * 0.14,
        1 - Math.exp(-3 * delta),
      )
      parallax.current.rotation.x = THREE.MathUtils.lerp(
        parallax.current.rotation.x,
        -state.pointer.y * 0.1,
        1 - Math.exp(-3 * delta),
      )
    }
  })

  return (
    <group ref={parallax}>
      {skillNetworkEdges.map(([a, b]) => {
        const na = byId[a]
        const nb = byId[b]
        if (!na || !nb) return null
        const lit = hovered === a || hovered === b
        return (
          <Line
            key={`${a}-${b}`}
            points={[na.pos, nb.pos]}
            color={lit ? '#818CF8' : '#4F46E5'}
            lineWidth={lit ? 1.6 : 1}
            transparent
            opacity={lit ? 0.85 : 0.22}
          />
        )
      })}
      {skillNetworkNodes.map((node, i) => (
        <group
          key={node.id}
          ref={(el) => {
            refs.current[i] = el
          }}
          position={node.pos}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(node.id)
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            setHovered(null)
            document.body.style.cursor = ''
          }}
        >
          <mesh>
            <sphereGeometry args={[node.hub ? 0.14 : 0.095, 20, 20]} />
            <meshBasicMaterial color={node.hub ? '#A5B4FC' : '#7DA9FA'} toneMapped={false} />
          </mesh>
          <sprite scale={node.hub ? [1.15, 1.15, 1] : [0.7, 0.7, 1]}>
            <spriteMaterial
              map={glow}
              transparent
              opacity={0.38}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </sprite>
          <Html center position={[0, 0.3, 0]} zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }} wrapperClass="pointer-events-none">
            <div
              className={cn(
                'pointer-events-none flex select-none flex-col items-center gap-1 transition-opacity duration-200',
                hovered && hovered !== node.id ? 'opacity-40' : 'opacity-100',
              )}
            >
              <span
                className={cn(
                  'whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] backdrop-blur-sm transition-colors duration-200',
                  hovered === node.id
                    ? 'border-indigo-300/50 bg-[#0A0F1F]/95 text-indigo-100'
                    : 'border-white/10 bg-[#0A0F1F]/70 text-slate-300/90',
                )}
              >
                {node.label}
              </span>
              {hovered === node.id && (
                <span className="whitespace-nowrap rounded-md border border-white/10 bg-[#0A0F1F]/90 px-2 py-1 text-[11px] text-slate-300 backdrop-blur-sm">
                  {node.desc}
                </span>
              )}
            </div>
          </Html>
        </group>
      ))}
    </group>
  )
}

export default function SkillNetwork({ reducedMotion }: { reducedMotion: boolean }) {
  const { ref, inView } = useInViewport<HTMLDivElement>(0.01)
  return (
    <div ref={ref} className="relative h-[440px] w-full lg:h-[500px]">
      <Canvas
        frameloop={inView ? 'always' : 'never'}
        dpr={[1, 1.75]}
        camera={{ fov: 46, position: [0, 0, 6.8] }}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={() => undefined}
        style={{ position: 'absolute', inset: 0 }}
      >
        <NetworkContents reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  )
}
