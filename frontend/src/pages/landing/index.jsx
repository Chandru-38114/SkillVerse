import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { initLanding } from './landingAnimations'
import markup from './landingMarkup'
import { prewarmServer } from '../../api'
import './landing.css'

gsap.registerPlugin(ScrollTrigger)

export default function Landing() {
  const navigate = useNavigate()
  const rootRef = useRef(null)

  useEffect(() => {
    prewarmServer()
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

  // The page's markup is plain HTML, so its "Log in" / "Create your profile"
  // links are ordinary <a href="/login">. Left alone they would full-page
  // reload and drop the React app. Catch them and route instead. In-page
  // anchors (href="#…") are untouched — the animation script smooth-scrolls those.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onClick = (e) => {
      const a = e.target.closest && e.target.closest('a[href]')
      if (!a || !root.contains(a)) return
      const href = a.getAttribute('href')
      if (!href || !href.startsWith('/') || href.startsWith('//')) return
      if (a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      e.preventDefault()
      navigate(href)
    }
    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [navigate])

  return <div ref={rootRef} className="sv-landing-root" dangerouslySetInnerHTML={{ __html: markup }} />
}
