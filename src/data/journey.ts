/**
 * Journey timeline. No fabricated dates — honest status labels only
 * ('Ongoing', 'Learning', 'Live', ...). Add a `period` once real dates exist.
 */

export interface JourneyItem {
  title: string
  detail: string
  tag: string
  status: string
  period?: string
}

export const journey: JourneyItem[] = [
  {
    title: 'Started B.E. Computer Engineering',
    detail:
      'AISSMS Institute of Information Technology, Savitribai Phule Pune University. Fundamentals first: programming, mathematics, systems.',
    tag: 'Education',
    status: 'Ongoing',
  },
  {
    title: 'Programming fundamentals with C',
    detail:
      'Coursework in C — pointers, memory, and the habit of thinking about what the machine is actually doing.',
    tag: 'Coursework',
    status: 'Foundation',
  },
  {
    title: 'Found data science',
    detail:
      'Linear regression and statistical modeling became the core focus — the first tools that made data feel explainable rather than noisy.',
    tag: 'Focus',
    status: 'Core',
  },
  {
    title: 'SQL & analytics practice',
    detail:
      'Querying, joining and shaping data — building the unglamorous skills everything else sits on.',
    tag: 'Learning',
    status: 'Ongoing',
  },
  {
    title: 'Google Cloud Study Jam',
    detail:
      'Hands-on cloud learning sessions — first structured exposure to how modern infrastructure is organised.',
    tag: 'Program',
    status: 'Participation',
  },
  {
    title: 'IBM SkillsBuild — AI track',
    detail:
      'Structured AI learning programs, extending into NLP, computer vision and cybersecurity modules.',
    tag: 'Program',
    status: 'Learning',
  },
  {
    title: 'Pregrad learning programs',
    detail: 'Technical learning programs across data and emerging technology.',
    tag: 'Program',
    status: 'Learning',
  },
  {
    title: 'AI + IoT agriculture concept',
    detail:
      'Began exploring an AI/IoT monitoring concept for early crop-threat detection — currently at problem-definition and research stage.',
    tag: 'Project',
    status: 'Ongoing',
  },
  {
    title: 'Built this portfolio',
    detail:
      'Designed and developed this site from scratch — React, TypeScript, Three.js — as both a showcase and a practice ground.',
    tag: 'Project',
    status: 'Live',
  },
]
