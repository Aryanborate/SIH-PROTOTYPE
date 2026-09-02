/**
 * Central site configuration — the single place to update identity + links.
 *
 * IMPORTANT: values left as '' are intentionally empty (nothing is invented).
 * The UI hides or gracefully degrades every feature whose config is empty.
 * Fill these in before sharing the site publicly.
 */
export const siteConfig = {
  name: 'Aditya Mengar',
  shortName: 'Aditya',
  role: 'Computer Engineering Student',
  tagline: 'Computer Engineering • Data • AI',
  location: 'Pune, Maharashtra, India',

  // --- Fill these in before launch -------------------------------------
  email: 'mengagraditya@gmail.com', // e.g. 'you@example.com' → enables the EMAIL button
  linkedin: 'https://www.linkedin.com/in/aditya-mengar-b86a34385', // e.g. 'https://www.linkedin.com/in/your-handle' → enables LINKEDIN
  github: 'https://github.com/adityamengar', // e.g. 'https://github.com/your-handle' → enables GitHub buttons
  githubUsername: 'adityamengar', // optional: username for the live repositories fetch
  // ---------------------------------------------------------------------

  resumePath: '/resume.pdf', // drop the file into /public — buttons activate automatically
  siteUrl: 'https://my-portfolio-gamma-two-ou648auiiu.vercel.app', // canonical URL placeholder — update after deploy
} as const

export function hasLink(url: string | undefined | null): boolean {
  return typeof url === 'string' && url.trim().length > 0
}

/** GitHub username for the repositories API — env var overrides data file. */
export function githubUsername(): string {
  const env = (import.meta.env.VITE_GITHUB_USERNAME as string | undefined)?.trim()
  if (env) return env
  if (siteConfig.githubUsername.trim()) return siteConfig.githubUsername.trim()
  // Fall back to parsing the profile URL if a GitHub link is configured.
  const match = siteConfig.github.match(/github\.com\/([^/?#]+)/i)
  return match ? match[1].replace(/\.git$/, '') : ''
}
