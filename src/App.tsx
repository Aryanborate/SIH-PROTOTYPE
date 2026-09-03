import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import Background from './components/layout/Background'
import Navbar from './components/navigation/Navbar'
import Dock from './components/navigation/Dock'
import CustomCursor from './components/cursor/CustomCursor'
import Loader from './components/loader/Loader'

const BackgroundScene = lazy(() => import('./components/3d/BackgroundScene'))
import Hero from './components/sections/Hero'
import About from './components/sections/About'
import Skills from './components/sections/Skills'
import Projects from './components/sections/Projects'
import Journey from './components/sections/Journey'
import Certifications from './components/sections/Certifications'
import GithubSection from './components/sections/Github'
import Learning from './components/sections/Learning'
import ResumeCTA from './components/sections/ResumeCTA'
import Contact from './components/sections/Contact'
import Footer from './components/sections/Footer'

export default function App() {
  const [booted, setBooted] = useState(false)
  const sceneReady = useRef(false)
  const minDelayDone = useRef(false)

  const tryBoot = useCallback(() => {
    if (minDelayDone.current && sceneReady.current) setBooted(true)
  }, [])

  useEffect(() => {
    const min = setTimeout(() => {
      minDelayDone.current = true
      tryBoot()
    }, 1100)
    // hard failsafe: never trap a visitor behind the loader
    const failsafe = setTimeout(() => setBooted(true), 3200)
    return () => {
      clearTimeout(min)
      clearTimeout(failsafe)
    }
  }, [tryBoot])

  const onSceneReady = useCallback(() => {
    sceneReady.current = true
    tryBoot()
  }, [tryBoot])

  return (
    <>
      <CustomCursor />
      <Background />
      <Suspense fallback={null}>
        <BackgroundScene />
      </Suspense>
      <AnimatePresence>{!booted && <Loader key="loader" />}</AnimatePresence>

      <a
        href="#about"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:rounded-full focus:bg-indigo-500 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>

      <Navbar />
      <Dock />

      <main>
        <Hero booted={booted} onSceneReady={onSceneReady} />
        <About />
        <Skills />
        <Projects />
        <Journey />
        <Certifications />
        <GithubSection />
        <Learning />
        <ResumeCTA />
        <Contact />
      </main>

      <Footer />
    </>
  )
}
