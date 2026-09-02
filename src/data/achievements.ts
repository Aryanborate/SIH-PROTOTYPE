/** Honest participation / learning highlights — never labelled as awards. */

export interface Achievement {
  title: string
  detail: string
  type: 'Participation' | 'Completion' | 'Learning' | 'Certification' | 'Technical Event'
}

export const achievements: Achievement[] = [
  {
    title: 'Google Cloud Study Jam',
    detail: 'Hands-on sessions with cloud services and tooling.',
    type: 'Technical Event',
  },
  {
    title: 'Technical quizzes & challenges',
    detail: 'Participated in technical quizzes across engineering subjects.',
    type: 'Participation',
  },
  {
    title: 'Structured learning programs',
    detail: 'IBM SkillsBuild and Pregrad programs pursued alongside coursework.',
    type: 'Completion',
  },
  {
    title: 'Self-directed AI learning',
    detail: 'Ongoing NLP, computer vision and cybersecurity study beyond the syllabus.',
    type: 'Learning',
  },
]
