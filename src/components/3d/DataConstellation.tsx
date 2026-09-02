import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { QualityTier } from '../../hooks/useCapabilities'
import { cn } from '../../lib/utils'
import { glowTexture } from './glow'

export interface FocusInfo {
  label: string
  desc: string
}

interface SceneProps {
  quality: QualityTier
  reducedMotion: boolean
  dpr: [number, number]
  onFocus: (info: FocusInfo | null) => void
  onReady?: () => void
}

interface NodeDef {
  position: THREE.Vector3
  category: boolean
  label?: string
  desc?: string
  phase: number
}

/** Labels surfaced when a category node is clicked. */
const CATEGORY_DEFS = [
  { label: 'DATA SCIENCE', desc: 'Core focus — statistics, modeling, analysis' },
  { label: 'AI', desc: 'Literacy steadily growing into practice' },
  { label: 'ANALYTICS', desc: 'Turning raw data into readable answers' },
  { label: 'SQL', desc: 'Querying, joining and shaping data' },
  { label: 'PROGRAMMING', desc: 'Fundamentals built in C' },
]

const rand = (seed: number) => {
  const x = Math.sin(seed * 127.1) * 43758.5453
  return x - Math.floor(x)
}

function buildNodes(): NodeDef[] {
  const count = 26
  const radius = 2.55
  const golden = Math.PI * (3 - Math.sqrt(5))
  const categoryIndices = [1, 6, 11, 16, 21]
  const nodes: NodeDef[] = []
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    const position = new THREE.Vector3(
      Math.cos(theta) * r + (rand(i) - 0.5) * 0.5,
      y + (rand(i + 100) - 0.5) * 0.4,
      Math.sin(theta) * r + (rand(i + 200) - 0.5) * 0.5,
    ).multiplyScalar(radius)
    const catIndex = categoryIndices.indexOf(i)
    const cat = catIndex >= 0 ? CATEGORY_DEFS[catIndex] : undefined
    nodes.push({
      position,
      category: catIndex >= 0,
      label: cat?.label,
      desc: cat?.desc,
      phase: rand(i) * Math.PI * 2,
    })
  }
  return nodes
}

function buildEdges(nodes: NodeDef[]): Array<[number, number]> {
  const seen = new Set<string>()
  const edges: Array<[number, number]> = []
  const add = (a: number, b: number) => {
    if (a === b) return
    const key = a < b ? `${a}-${b}` : `${b}-${a}`
    if (seen.has(key)) return
    seen.add(key)
    edges.push([a, b])
  }
  for (let i = 0; i < nodes.length; i++) {
    const nearest = nodes
      .map((n, j) => ({ j, d: nodes[i].position.distanceTo(n.position) }))
      .filter((x) => x.j !== i)
      .sort((a, b) => a.d - b.d)
    add(i, nearest[0].j)
    add(i, nearest[1].j)
    if (nodes[i].category) add(i, -1) // spoke to the core (-1)
    else if (rand(i * 7) > 0.78) add(i, nearest[2].j)
  }
  return edges
}

function Core() {
  const glow = useMemo(() => glowTexture('#6366F1'), [])
  return (
    <group>
      <sprite scale={[3.8, 3.8, 1]}>
        <spriteMaterial map={glow} transparent opacity={0.28} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <mesh>
        <icosahedronGeometry args={[0.48, 2]} />
        <meshBasicMaterial color="#818CF8" toneMapped={false} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[1.42, 1]} />
        <meshBasicMaterial color="#4F46E5" wireframe transparent opacity={0.22} />
      </mesh>
      <pointLight color="#6366F1" intensity={6} distance={9} />
    </group>
  )
}

function Connections({
  nodes,
  edges,
  highlight,
}: {
  nodes: NodeDef[]
  edges: Array<[number, number]>
  highlight: boolean
}) {
  const materialRef = useRef<THREE.LineBasicMaterial>(null)
  const { positions, colors } = useMemo(() => {
    const core = new THREE.Vector3(0, 0, 0)
    const pos: number[] = []
    const col: number[] = []
    const dim = new THREE.Color('#4F46E5').multiplyScalar(0.55)
    const bright = new THREE.Color('#60A5FA').multiplyScalar(0.95)
    edges.forEach(([a, b]) => {
      const pa = a === -1 ? core : nodes[a].position
      const pb = b === -1 ? core : nodes[b].position
      pos.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z)
      const strong =
        (a !== -1 && nodes[a].category) || (b !== -1 && nodes[b].category)
      const c = strong ? bright : dim
      col.push(c.r, c.g, c.b, c.r, c.g, c.b)
    })
    return { positions: new Float32Array(pos), colors: new Float32Array(col) }
  }, [nodes, edges])

  useFrame((_, delta) => {
    if (!materialRef.current) return
    const target = highlight ? 0.5 : 0.26
    materialRef.current.opacity = THREE.MathUtils.lerp(
      materialRef.current.opacity,
      target,
      1 - Math.exp(-4 * delta),
    )
  })

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <lineBasicMaterial
        ref={materialRef}
        vertexColors
        transparent
        opacity={0.26}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </lineSegments>
  )
}

function ConstellationNodes({
  nodes,
  hovered,
  active,
  setHovered,
  onActivate,
}: {
  nodes: NodeDef[]
  hovered: number | null
  active: number | null
  setHovered: (i: number | null) => void
  onActivate: (i: number, node: NodeDef) => void
}) {
  const refs = useRef<Array<THREE.Mesh | null>>([])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    refs.current.forEach((mesh, i) => {
      if (!mesh) return
      const def = nodes[i]
      const target = i === hovered || i === active ? 1.9 : def.category ? 1.25 : 1
      const s = THREE.MathUtils.lerp(mesh.scale.x || 1, target, 1 - Math.exp(-8 * delta))
      mesh.scale.setScalar(s)
      mesh.position.y = def.position.y + Math.sin(t * 0.6 + def.phase) * 0.07
    })
  })

  return (
    <group>
      {nodes.map((n, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          position={n.position}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(i)
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            setHovered(null)
            document.body.style.cursor = ''
          }}
          onClick={(e) => {
            e.stopPropagation()
            onActivate(i, n)
          }}
        >
          <sphereGeometry args={[n.category ? 0.085 : 0.05, 16, 16]} />
          <meshBasicMaterial color={n.category ? '#A5B4FC' : '#7DA9FA'} toneMapped={false} />
          {n.category && (
            <Html
              center
              zIndexRange={[40, 0]}
              style={{ pointerEvents: 'none' }}
              wrapperClass="pointer-events-none"
            >
              <div
                className={cn(
                  'pointer-events-none select-none whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[9px] tracking-[0.18em] backdrop-blur-sm transition-colors duration-300',
                  hovered === i || active === i
                    ? 'border-indigo-300/50 bg-[#0A0F1F]/90 text-indigo-100'
                    : 'border-white/10 bg-[#0A0F1F]/70 text-indigo-200/70',
                )}
              >
                {n.label}
              </div>
            </Html>
          )}
        </mesh>
      ))}
    </group>
  )
}

function Particles({ count, reducedMotion }: { count: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 3.2 + Math.random() * 3.2
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.cos(phi) * 0.75
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    return arr
  }, [count])

  useFrame((_, delta) => {
    if (ref.current && !reducedMotion) ref.current.rotation.y += delta * 0.012
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.022}
        color="#60A5FA"
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

function OrbitRing({
  radius,
  tilt,
  speed,
  reducedMotion,
}: {
  radius: number
  tilt: [number, number, number]
  speed: number
  reducedMotion: boolean
}) {
  const sat = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (sat.current && !reducedMotion) sat.current.rotation.z += delta * speed
  })
  return (
    <group rotation={tilt}>
      <mesh>
        <torusGeometry args={[radius, 0.006, 8, 160]} />
        <meshBasicMaterial color="#6366F1" transparent opacity={0.16} />
      </mesh>
      <group ref={sat}>
        <mesh position={[radius, 0, 0]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshBasicMaterial color="#93C5FD" toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

/** Camera parallax + slow architectural rotation of the whole constellation. */
function Rig({
  reducedMotion,
  children,
}: {
  reducedMotion: boolean
  children: React.ReactNode
}) {
  const group = useRef<THREE.Group>(null)
  const target = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, delta) => {
    if (group.current && !reducedMotion) {
      group.current.rotation.y += delta * 0.05
      group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.05
    }
    if (!reducedMotion) {
      target.set(state.pointer.x * 0.55, 0.2 + state.pointer.y * 0.35, 7.4)
      state.camera.position.lerp(target, 1 - Math.exp(-2.2 * delta))
      state.camera.lookAt(0, 0, 0)
    }
  })

  return <group ref={group}>{children}</group>
}

function Constellation({
  quality,
  reducedMotion,
  onFocus,
}: {
  quality: QualityTier
  reducedMotion: boolean
  onFocus: (info: FocusInfo | null) => void
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const [active, setActive] = useState<number | null>(null)
  const nodes = useMemo(buildNodes, [])
  const edges = useMemo(() => buildEdges(nodes), [nodes])

  useEffect(() => {
    if (active === null) return
    const timer = setTimeout(() => setActive(null), 2600)
    return () => clearTimeout(timer)
  }, [active])

  const onActivate = useCallback(
    (i: number, node: NodeDef) => {
      setActive(i)
      if (node.category && node.label) {
        onFocus({ label: node.label, desc: node.desc ?? '' })
      }
    },
    [onFocus],
  )

  return (
    <>
      <Rig reducedMotion={reducedMotion}>
        <Core />
        <Connections
          nodes={nodes}
          edges={edges}
          highlight={hovered !== null || active !== null}
        />
        <ConstellationNodes
          nodes={nodes}
          hovered={hovered}
          active={active}
          setHovered={setHovered}
          onActivate={onActivate}
        />
        <Particles count={quality === 'high' ? 900 : quality === 'medium' ? 450 : 220} reducedMotion={reducedMotion} />
        <OrbitRing radius={3.05} tilt={[Math.PI / 2.4, 0.3, 0]} speed={0.25} reducedMotion={reducedMotion} />
        <OrbitRing radius={3.45} tilt={[Math.PI / 1.9, -0.5, 0.2]} speed={-0.18} reducedMotion={reducedMotion} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 6, 5]} intensity={0.6} />
      </Rig>
    </>
  )
}

/** The live WebGL hero scene: a "Data Intelligence Constellation". */
export default function DataConstellation({
  quality,
  reducedMotion,
  dpr,
  onFocus,
  onReady,
}: SceneProps) {
  return (
    <Canvas
      dpr={dpr}
      camera={{ fov: 40, position: [0, 0.2, 7.4], near: 0.1, far: 60 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={() => onReady?.()}
      onPointerMissed={() => onFocus(null)}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Constellation quality={quality} reducedMotion={reducedMotion} onFocus={onFocus} />
    </Canvas>
  )
}
