/**
 * Skills — strictly limited to what's supported by the source material.
 * Add a skill by appending to a category; the UI (cards + 3D network)
 * both render from these structures.
 */

export interface Skill {
  name: string
  /** short honest qualifier, shown as a micro-note */
  note?: string
}

export interface SkillCategory {
  title: string
  note: string
  skills: Skill[]
}

export const skillCategories: SkillCategory[] = [
  {
    title: 'Data & Analytics',
    note: 'Core focus',
    skills: [
      { name: 'Data Science', note: 'core focus' },
      { name: 'Data Analytics' },
      { name: 'Statistical Modeling' },
      { name: 'Linear Regression', note: 'first model learned properly' },
      { name: 'Predictive Analytics' },
    ],
  },
  {
    title: 'Programming & Technical',
    note: 'Foundations',
    skills: [
      { name: 'SQL', note: 'coursework + practice' },
      { name: 'C', note: 'coursework' },
    ],
  },
  {
    title: 'AI',
    note: 'Growing layer',
    skills: [{ name: 'AI Literacy', note: 'developing' }],
  },
]

/** Layout for the 3D skill constellation (desktop only). */
export interface SkillNode {
  id: string
  label: string
  desc: string
  pos: [number, number, number]
  hub?: boolean
}

export const skillNetworkNodes: SkillNode[] = [
  { id: 'data-science', label: 'Data Science', desc: 'Core focus — statistics, modeling, analysis', pos: [0, 0.55, 0], hub: true },
  { id: 'data-analytics', label: 'Data Analytics', desc: 'Turning raw data into readable answers', pos: [-2.1, 0.05, 0.4] },
  { id: 'stat-modeling', label: 'Statistical Modeling', desc: 'Regression and statistical thinking', pos: [-1.15, 1.7, -0.5] },
  { id: 'linear-reg', label: 'Linear Regression', desc: 'The first model I learned properly', pos: [0.95, 1.95, 0.2] },
  { id: 'pred-analytics', label: 'Predictive Analytics', desc: 'Where modeling meets forecasting', pos: [2.15, 0.85, -0.3] },
  { id: 'sql', label: 'SQL', desc: 'Querying and shaping data', pos: [-2.55, -1.35, 0.1] },
  { id: 'c', label: 'C', desc: 'Where programming fundamentals clicked', pos: [1.45, -1.6, 0.5] },
  { id: 'ai-literacy', label: 'AI Literacy', desc: 'Understanding how AI systems work', pos: [-0.25, -2.0, -0.6] },
]

export const skillNetworkEdges: [string, string][] = [
  ['data-science', 'data-analytics'],
  ['data-science', 'stat-modeling'],
  ['data-science', 'linear-reg'],
  ['data-science', 'pred-analytics'],
  ['data-science', 'ai-literacy'],
  ['data-analytics', 'stat-modeling'],
  ['data-analytics', 'sql'],
  ['sql', 'c'],
  ['linear-reg', 'pred-analytics'],
  ['ai-literacy', 'c'],
]
