# Aditya Mengar — Live 3D Portfolio

A single-page, data-driven portfolio with real-time WebGL scenes, built to present
early-career work **honestly**: real projects, real limitations, no invented metrics.

**Stack:** React 18 · TypeScript · Vite · Tailwind CSS · Three.js (React Three Fiber + drei) · Framer Motion · Lucide

---

## Features

- **Live 3D hero** — a "Data Intelligence Constellation": nodes, connections, orbiting
  rings and particles rendered with React Three Fiber. Mouse parallax, node hover/click
  interactions with labelled categories. Not a video, not a gimmick.
- **3D skill constellation** — a structured technical diagram of the 8 verified skills
  with hover tooltips and highlighted edges (desktop only; elegant cards on mobile).
- **Deep-linkable case studies** — every project opens an immersive case-study modal,
  shareable via `#case/<id>`, with back/forward button support.
- **Project filters + search** — filter chips are derived from actual project data.
- **Honest data architecture** — every section renders from typed data files. Missing
  links (GitHub, LinkedIn, email, resume, certificate scans) hide or degrade gracefully;
  nothing is faked.
- **Performance** — lazy-loaded 3D chunks, device quality tiers (particle counts, DPR),
  render loops that pause off-screen, code-split Three.js bundle.
- **Accessibility** — semantic HTML, skip link, focus-visible styles, focus-trapped
  modals, keyboard-operable cards, `prefers-reduced-motion` support throughout
  (including the 3D scenes).
- **WebGL fallback** — a designed static constellation replaces the 3D scene when
  WebGL is unavailable; the site never breaks.
- **SEO** — title/meta/OG/Twitter tags, canonical placeholder, JSON-LD Person schema,
  robots.txt, sitemap.xml, SVG favicon.

## Project structure

```
src/
  components/
    3d/            HeroScene, DataConstellation, SkillNetwork, SceneFallback, glow
    cursor/        CustomCursor
    layout/        Background
    loader/        Loader
    navigation/    Navbar (+ mobile menu)
    sections/      Hero, About, Skills, Projects, CaseStudyModal, ProjectVisual,
                   Journey, Certifications, Github, Learning, ResumeCTA, Contact, Footer
    ui/            GlassCard, Buttons, Chips, Modal, Reveal, SectionHeading
  data/            siteConfig, profile, skills, projects, certifications,
                   achievements, journey, learning, education, github
  hooks/           useCapabilities, useMediaQuery, useInViewport,
                   useRepos, useResumeAvailable
  lib/             utils
public/            favicon.svg, robots.txt, sitemap.xml, resume.pdf (add yours)
```

## Run locally

```bash
npm install
npm run dev       # http://localhost:5173
```

## Build & preview

```bash
npm run build     # type-checks then bundles to /dist
npm run preview   # serves the production build locally
```

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import it on [vercel.com](https://vercel.com) — Vercel auto-detects Vite:
   build command `npm run build`, output directory `dist`.
3. Add environment variables (optional, see below) in the Vercel dashboard.

## Environment variables

Copy `.env.example` to `.env` for local overrides. All values are public/browser-safe —
never put secrets here:

| Variable                | Purpose                                    |
| ----------------------- | ------------------------------------------ |
| `VITE_GITHUB_USERNAME`  | Username for the live repositories section |
| `VITE_SITE_URL`         | Canonical URL override                     |

## ✅ Pre-launch checklist (fill in before sharing)

All identity/links live in **`src/data/siteConfig.ts`**:

1. `email` — enables the EMAIL contact button
2. `linkedin` — enables LINKEDIN buttons (hero, contact, footer)
3. `github` + `githubUsername` — enables GitHub buttons and the live repo grid
4. Drop your **`resume.pdf`** into `/public` — View/Download buttons activate automatically
5. Optional: certificate scans → `/public/certificates/*`, referenced by `image`
   in `src/data/certifications.ts`
6. Optional: add an `og.png` (1200×630) in `/public` + an `og:image` meta tag in `index.html`

## Updating content

| What                          | File                            |
| ----------------------------- | ------------------------------- |
| Name, role, links, resume     | `src/data/siteConfig.ts`        |
| Hero + about copy             | `src/data/profile.ts`           |
| Skills + skill network        | `src/data/skills.ts`            |
| Projects & case studies       | `src/data/projects.ts`          |
| Certifications                | `src/data/certifications.ts`    |
| Beyond-the-code highlights    | `src/data/achievements.ts`      |
| Journey timeline              | `src/data/journey.ts`           |
| Currently-learning cards      | `src/data/learning.ts`          |
| Education                     | `src/data/education.ts`         |
| Static repo fallback          | `src/data/github.ts`            |

Components never hardcode content — edit the data files and the UI follows.

### Adding a project

Append to `src/data/projects.ts`. Only the fields you fill in appear in the UI
(`githubUrl`, `demoUrl`, `architecture`, `challenges`… are all optional). The
category you pick automatically becomes a filter chip.

## Design decisions worth knowing

- **Nothing is invented.** Skills, projects, certifications and the journey timeline
  use only real source material; statuses like *Ongoing / Learning / Concept* replace
  fabricated dates, and measured metrics are never claimed.
- **A GitHub 3D activity grid was intentionally omitted** until a real profile is
  connected — a fake contribution grid would be fabricated data.
- Glassmorphism is used sparingly (navbar, cards, modal); neumorphism only on tiny
  controls (icon buttons, chips).

## Future improvements

- Dedicated case-study pages (`/projects/:slug`) with richer media
- Admin-less CMS via MDX or a headless source
- Lighthouse budget CI check
- i18n if needed
