/**
 * Projects — the most important content on the site.
 * Every field the UI renders lives here; components never hardcode projects.
 * Optional fields are hidden by the UI when absent (no broken buttons, no fake data).
 */

export interface Project {
  id: string
  title: string
  slug: string
  category: string
  year?: string
  summary: string
  problem: string
  whyItMatters?: string
  solution: string
  contribution?: string
  technologies: string[]
  status?: string
  githubUrl?: string
  demoUrl?: string
  images?: string[]
  architecture?: string[]
  challenges?: string[]
  lessonsLearned?: string[]
  futureImprovements?: string[]
  featured: boolean
}

export const projects: Project[] = [
  {
    id: 'agri-ai-iot',
    title: 'AI + IoT Agricultural Monitoring',
    slug: 'ai-iot-agricultural-monitoring',
    category: 'AI / ML',
    summary:
      'An early-stage concept exploring how AI and IoT-style monitoring could help detect crop threats earlier — so protection can be targeted instead of routine.',
    problem:
      'Crop protection is often reactive. By the time a threat becomes visible in a field, the intervention is bigger than it needed to be — more pesticide, more cost, more exposure. The core idea: if threats could be detected earlier through continuous monitoring, intervention could become targeted instead of routine.',
    whyItMatters:
      'Precision matters more than intensity in agriculture. A farmer who knows which rows need attention makes better decisions than one who treats the whole field on a schedule. Early detection converts a large, late, blind intervention into a small, early, informed one.',
    solution:
      'The concept explores a monitoring-first loop: field-level sensing feeds a data pipeline, patterns are classified for early signs of trouble, and the output is a targeted intervention signal rather than blanket treatment. This project is currently at the concept and research stage — the sensing architecture, data requirements and detection logic are being scoped before anything is built.',
    contribution:
      'Personal concept project — problem definition, research into AI/IoT monitoring approaches, and early solution thinking, documented openly.',
    technologies: ['AI', 'IoT', 'Agriculture Tech', 'Data Monitoring'],
    status: 'Concept — in exploration',
    lessonsLearned: [
      'Defining the problem precisely is harder — and more valuable — than jumping to a model.',
      'Early detection is a data-collection problem before it is an AI problem.',
      'A concept needs constraints to become real: what gets sensed, how often, and at what cost.',
    ],
    futureImprovements: [
      'Define a concrete sensing + data architecture.',
      'Scope a small, honest proof-of-concept dataset.',
      'Prototype the detection logic on real field data.',
    ],
    featured: true,
  },
  {
    id: 'live-3d-portfolio',
    title: 'This Website — a Live 3D Portfolio',
    slug: 'live-3d-portfolio',
    category: 'Web',
    summary:
      'The site you are reading: a single-page, data-driven portfolio with real-time WebGL scenes, built from scratch to present my work honestly.',
    problem:
      'I wanted a way to present my work that a recruiter could scan in sixty seconds — and that would not overstate where I am in my career. Templates either over-claim or look generic, so I designed and built my own.',
    whyItMatters:
      'How you present technical work is itself a technical skill. Building the presentation layer by hand meant every design and engineering decision had a reason behind it — and the result is something I can explain line by line.',
    solution:
      'A React + TypeScript single-page app. Content lives in typed data files, the hero and skills sections render live React Three Fiber scenes, motion is Framer Motion with reduced-motion support, and everything degrades gracefully — a designed static fallback appears when WebGL is unavailable.',
    contribution: 'Everything — design, code, 3D scenes, and copy.',
    technologies: ['React', 'TypeScript', 'Three.js', 'React Three Fiber', 'Tailwind CSS', 'Framer Motion', 'Vite', 'Vercel'],
    status: 'Live — you are here',
    lessonsLearned: [
      'Shipped beats perfect: version 1 exists, refinement is ongoing.',
      '3D is easy to make loud and hard to make subtle.',
      'Typed data files mean content updates never touch components.',
    ],
    futureImprovements: [
      'Deep-linkable case-study pages for each project.',
      'A live GitHub repositories integration.',
      'Performance profiling against a strict Lighthouse budget.',
    ],
    featured: true,
  },
]

export function getProject(id: string): Project | undefined {
  return projects.find((p) => p.id === id)
}
