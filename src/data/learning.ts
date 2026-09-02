/** "What I'm learning right now" — living content, updated as work progresses. */

export const learningLastUpdated = 'September 2026'

export interface LearningCard {
  title: string
  icon: 'database' | 'brain' | 'chart' | 'code' | 'cloud' | 'layers'
  focus: string
  experiment: string
  next: string
}

export const learning: LearningCard[] = [
  {
    title: 'Data Science',
    icon: 'database',
    focus: 'Statistical modeling fundamentals — regression done properly, not just run.',
    experiment: 'Small regression experiments on public datasets.',
    next: 'An end-to-end analytics project documented publicly.',
  },
  {
    title: 'AI / ML',
    icon: 'brain',
    focus: 'Turning AI literacy into working knowledge — NLP and computer vision basics.',
    experiment: 'Working through structured AI programs (IBM SkillsBuild).',
    next: 'A first small ML implementation I can explain line by line.',
  },
  {
    title: 'Analytics',
    icon: 'chart',
    focus: 'SQL — querying, joining and shaping data with intent.',
    experiment: 'Practice sets on realistic schemas.',
    next: 'An analytics build on a real dataset.',
  },
  {
    title: 'Programming',
    icon: 'code',
    focus: 'C fundamentals and disciplined problem-solving.',
    experiment: 'Coursework plus practice problems.',
    next: 'Data structures & algorithms, properly.',
  },
  {
    title: 'Cloud & Tooling',
    icon: 'cloud',
    focus: 'Google Cloud fundamentals from Study Jams.',
    experiment: 'Following along with hands-on cloud labs.',
    next: 'Deploying more of what I build.',
  },
  {
    title: 'Software Development',
    icon: 'layers',
    focus: 'Component thinking — this site is the practice.',
    experiment: 'Building and refining this portfolio in public.',
    next: 'Deeper case-study pages for each project.',
  },
]
