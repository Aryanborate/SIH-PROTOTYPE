import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCapabilities, type QualityTier } from '../../hooks/useCapabilities'

/**
 * Full-page live 3D background: a deep particle field with constellation
 * clusters and faint orbital rings. The camera traverses the volume as the
 * page scrolls and parallaxes with the mouse. Deliberately dim — it must
 * add depth without ever competing with content.
 */

const INDIGO = new THREE.Color('#4F46E5')
const SKY = new THREE.Color('#60A5FA')
const CYAN = new THREE.Color('#22D3EE')

interface FieldProps {
  quality: QualityTier
  reducedMotion: boolean
}

function DataField({ quality, reducedMotion }: FieldProps) {
  const field = useRef<THREE.Group>(null)
  const particles = useRef<THREE.Points>(null)
  const smooth = useRef({ p: 0, mx: 0, my: 0 })
  const input = useRef({ p: 0, mx: 0, my: 0 })

  // Scroll + mouse are read through refs inside useFrame —
  // no React re-renders, ever.
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      input.current.p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
    }
    const onMove = (e: MouseEvent) => {
      input.current.mx = (e.clientX / window.innerWidth) * 2 - 1
      input.current.my = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('mousemove', onMove)
    }
  }, [])

  const { positions, colors } = useMemo(() => {
    const count = quality === 'high' ? 620 : quality === 'medium' ? 380 : 200
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30
      positions[i * 3 + 1] = (Math.random() - 0.5) * 22
      positions[i * 3 + 2] = -3 - Math.random() * 34
      const roll = Math.random()
      c.copy(roll > 0.9 ? CYAN : roll > 0.5 ? SKY : INDIGO).multiplyScalar(
        0.55 + Math.random() * 0.45,
      )
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    return { positions, colors }
  }, [quality])

  // Three constellation clusters at different depths — scrolling passes each one.
  const clusters = useMemo(() => {
    const defs = [
      { center: new THREE.Vector3(-8.5, 6.5, -14), n: 9 },
      { center: new THREE.Vector3(9, -4.5, -22), n: 8 },
      { center: new THREE.Vector3(-5, -9.5, -30), n: 10 },
    ]
    return defs.map(({ center, n }) => {
      const pts: THREE.Vector3[] = []
      for (let i = 0; i < n; i++) {
        pts.push(
          center
            .clone()
            .add(
              new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 4,
              ),
            ),
        )
      }
      const segments: number[] = []
      pts.forEach((p, i) => {
        pts
          .map((q, j) => ({ j, d: p.distanceTo(q) }))
          .filter((x) => x.j !== i)
          .sort((a, b) => a.d - b.d)
          .slice(0, 2)
          .forEach(({ j }) => {
            const q = pts[j]
            segments.push(p.x, p.y, p.z, q.x, q.y, q.z)
          })
      })
      return { pts, segments: new Float32Array(segments) }
    })
  }, [])

  useFrame((state, delta) => {
    const k = 1 - Math.exp(-3.2 * delta)
    smooth.current.p += (input.current.p - smooth.current.p) * k
    smooth.current.mx += (input.current.mx - smooth.current.mx) * k
    smooth.current.my += (input.current.my - smooth.current.my) * k
    const { p, mx, my } = smooth.current
    const t = state.clock.elapsedTime
    const cam = state.camera

    // scroll → traverse; mouse → parallax
    const camY = -p * 5.5 + my * 0.6
    const camX = mx * 0.9
    cam.position.x += (camX - cam.position.x) * k
    cam.position.y += (camY - cam.position.y) * k
    cam.lookAt(mx * 0.3, camY * 0.9, -14)

    if (field.current && !reducedMotion) {
      field.current.rotation.y = p * 0.7 + t * 0.008
      field.current.rotation.z = p * 0.06
    }
    if (particles.current) {
      const m = particles.current.material as THREE.PointsMaterial
      m.opacity = reducedMotion ? 0.42 : 0.38 + Math.sin(t * 0.7) * 0.08
    }
  })

  return (
    <>
      <group ref={field}>
        <points ref={particles}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            <bufferAttribute attach="attributes-color" args={[colors, 3]} />
          </bufferGeometry>
          <pointsMaterial
            size={0.075}
            vertexColors
            transparent
            opacity={0.42}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            sizeAttenuation
          />
        </points>

        {clusters.map((c, i) => (
          <group key={i}>
            {c.pts.map((p, j) => (
              <mesh key={j} position={p}>
                <sphereGeometry args={[0.09, 10, 10]} />
                <meshBasicMaterial
                  color={j % 3 === 0 ? '#A5B4FC' : '#60A5FA'}
                  toneMapped={false}
                />
              </mesh>
            ))}
            <lineSegments>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[c.segments, 3]} />
              </bufferGeometry>
              <lineBasicMaterial
                color="#4F46E5"
                transparent
                opacity={0.14}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </lineSegments>
          </group>
        ))}

        {/* faint orbital rings — depth structure, never loud */}
        <mesh position={[0, 0, -18]}>
          <torusGeometry args={[7, 0.012, 6, 140]} />
          <meshBasicMaterial color="#6366F1" transparent opacity={0.07} />
        </mesh>
        <mesh position={[3, -2, -26]} rotation={[0.5, 0.4, 0]}>
          <torusGeometry args={[10, 0.012, 6, 140]} />
          <meshBasicMaterial color="#6366F1" transparent opacity={0.055} />
        </mesh>
        <mesh position={[-4, 2, -34]} rotation={[-0.4, 0.2, 0.3]}>
          <torusGeometry args={[13, 0.012, 6, 140]} />
          <meshBasicMaterial color="#2563EB" transparent opacity={0.05} />
        </mesh>
      </group>
      <ambientLight intensity={0.4} />
    </>
  )
}

/** Fixed, pointer-transparent WebGL layer behind the whole page. */
export default function BackgroundScene() {
  const caps = useCapabilities()
  if (!caps.webgl) return null
  return (
    <div className="pointer-events-none fixed inset-0 -z-20" aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ fov: 55, position: [0, 0, 8], near: 0.1, far: 80 }}
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <DataField quality={caps.quality} reducedMotion={caps.reducedMotion} />
      </Canvas>
    </div>
  )
}
