'use client'

import { create } from 'zustand'

/**
 * Phase 6 #50/#78 — SIH Demo Mode state.
 * The demo ENGINE (demo-engine.tsx) drives this store; the control panel and
 * app shell only read from it. Kept separate from the persisted app store so
 * a page reload cleanly drops any in-flight demo run.
 */
export const DEMO_STEP_COUNT = 16

export type DemoPhase = 'idle' | 'running' | 'done' | 'error'

/**
 * Live data collected by the engine while executing the script.
 * Keys are written by demo-engine.tsx as steps complete; the panel renders
 * them per step kind. See DemoData in demo-script.ts for the typed shape.
 */
export type DemoData = Record<string, unknown>

interface DemoState {
  active: boolean
  phase: DemoPhase
  /** auto-advance between steps */
  playing: boolean
  /** #78 presentation mode — hide app chrome, big narration */
  presentation: boolean
  /** 0-based index into the 16-step script */
  stepIndex: number
  /** live narration line rendered by the control panel */
  note: string
  /** playback speed multiplier for scripted delays */
  speed: number
  /** last error message, if any */
  error: string
  /** live data collected by the engine (booking refs, worker card, payment split…) */
  data: DemoData
  /** bumped by start()/retry() so the engine re-executes even at the same stepIndex */
  runToken: number

  start: () => void
  stop: () => void
  next: () => void
  prev: () => void
  goTo: (i: number) => void
  setPlaying: (p: boolean) => void
  setPresentation: (p: boolean) => void
  setSpeed: (s: number) => void
  setNote: (n: string) => void
  /** merge live step data (idempotent partials) */
  setData: (partial: DemoData) => void
  fail: (msg: string) => void
  finish: () => void
  /** re-run the current step after an error */
  retry: () => void
}

export const useDemoStore = create<DemoState>()((set, get) => ({
  active: false,
  phase: 'idle',
  playing: true,
  presentation: true,
  stepIndex: 0,
  note: '',
  speed: 1,
  error: '',
  data: {},
  runToken: 0,

  start: () => set((s) => ({ active: true, phase: 'running', playing: true, stepIndex: 0, note: '', error: '', data: {}, runToken: s.runToken + 1 })),
  stop: () => set({ active: false, phase: 'idle', playing: false, presentation: false, note: '', error: '' }),
  next: () => {
    const i = get().stepIndex
    if (i >= DEMO_STEP_COUNT - 1) get().finish()
    else set({ stepIndex: i + 1 })
  },
  prev: () => set({ stepIndex: Math.max(0, get().stepIndex - 1) }),
  goTo: (i) => set({ stepIndex: Math.min(Math.max(0, i), DEMO_STEP_COUNT - 1), phase: 'running' }),
  setPlaying: (p) => set({ playing: p }),
  setPresentation: (p) => set({ presentation: p }),
  setSpeed: (s) => set({ speed: s }),
  setNote: (n) => set({ note: n }),
  setData: (partial) => set((s) => ({ data: { ...s.data, ...partial } })),
  fail: (msg) => set({ phase: 'error', error: msg, playing: false }),
  finish: () => set({ phase: 'done', playing: false, note: 'Demo complete — the full cooperative loop ran end to end.' }),
  retry: () => set((s) => ({ phase: 'running', error: '', runToken: s.runToken + 1 })),
}))
