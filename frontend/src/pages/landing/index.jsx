import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { initLanding } from './landingAnimations'
import markup from './landingMarkup'
import './landing.css'

gsap.registerPlugin(ScrollTrigger)

export default function Landing() {
  useEffect(() => {
    document.body.classList.add('sv-landing')
    window.scrollTo(0, 0)

    let cleanup = () => {}
    try {
      cleanup = initLanding(gsap, ScrollTrigger, Lenis) || (() => {})
    } catch (err) {
      console.error('[landing] animations failed to start:', err)
    }

    return () => {
      try { cleanup() } catch (err) { /* nothing left to clean */ }
      document.body.classList.remove('sv-landing', 'is-dark')
      document.documentElement.classList.remove('lenis', 'lenis-smooth', 'lenis-scrolling', 'lenis-stopped')
    }
  }, [])

  return <div className="sv-landing-root" dangerouslySetInnerHTML={{ __html: markup }} />
}
