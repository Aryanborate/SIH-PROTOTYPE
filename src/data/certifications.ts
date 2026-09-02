/**
 * Certifications & learning programs — only areas visible in the source material.
 * No fabricated dates, credential IDs or links: add `credentialUrl` / `image`
 * / `date` as the real documents become available — the UI reveals them automatically.
 */

export type CertType = 'Participation' | 'Completion' | 'Learning' | 'Certification'

export interface Certification {
  title: string
  issuer?: string
  area: string
  type: CertType
  date?: string
  credentialUrl?: string
  /** path to a certificate image, e.g. '/certificates/xyz.jpg' in /public */
  image?: string
  note?: string
}

export const certifications: Certification[] = [
  {
    title: 'Data Science & Analytics',
    area: 'Core learning track',
    type: 'Learning',
    note: 'Ongoing track — statistics, regression and analytics foundations.',
  },
  {
    title: 'Google Cloud Study Jam',
    issuer: 'Google Cloud',
    area: 'Cloud fundamentals',
    type: 'Participation',
  },
  {
    title: 'Artificial Intelligence',
    issuer: 'IBM SkillsBuild',
    area: 'AI literacy',
    type: 'Learning',
  },
  {
    title: 'Future of AI',
    area: 'Emerging technology',
    type: 'Learning',
  },
  {
    title: 'Natural Language Processing',
    area: 'AI — specialization area',
    type: 'Learning',
  },
  {
    title: 'Computer Vision',
    area: 'AI — specialization area',
    type: 'Learning',
  },
  {
    title: 'Cybersecurity',
    area: 'Security fundamentals',
    type: 'Learning',
  },
  {
    title: 'Digital Productivity',
    area: 'Modern tooling',
    type: 'Completion',
  },
  {
    title: 'Pregrad Learning Programs',
    issuer: 'Pregrad',
    area: 'Technical programs',
    type: 'Learning',
  },
]
