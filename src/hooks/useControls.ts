import { useEffect } from 'react'
import { useApp } from '@/state/store'
import { TIME } from '@/config'
import { startPresentation, stopPresentation } from '@/present/director'

/** Advances the scenario clock while playing. 1× = one 10-min step per second. */
export function usePlayback() {
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const s = useApp.getState()
      if (s.playing && !s.presenting) {
        const t = s.t + dt * s.speed * TIME.stepMin
        if (t >= TIME.endMin) {
          s.setT(TIME.endMin)
          s.setPlaying(false)
        } else s.setT(t)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
}

export function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target instanceof Element ? e.target : null
      if (e.ctrlKey || e.metaKey || e.altKey) return
      // Text fields keep every key. Focused buttons / the scenario picker keep only Space and Enter,
      // so P, arrows etc. still work right after picking a scenario or clicking a control.
      if (el?.closest('input, textarea, select, [contenteditable="true"], [role="listbox"], [role="option"]')) return
      if ((e.key === ' ' || e.key === 'Enter') && el?.closest('button, [role="combobox"], [role="tab"]')) {
        if (e.key === 'Enter') return
        e.preventDefault()
        ;(el as HTMLElement).blur()
      }
      const s = useApp.getState()
      if (!s.user) return
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (s.presenting && key !== 'p' && key !== 'Escape') return
      if (key === '/') {
        e.preventDefault()
        s.setAssistantOpen(true)
        return
      }
      if (key === 'Escape' && s.assistantOpen) {
        s.setAssistantOpen(false)
        return
      }
      const mapPage = s.page === 'ops' || s.page === 'replay'
      const replayOnly = ['[', ']', 'g', 'p']
      if (!mapPage && key !== 'Escape') return
      if (s.page !== 'replay' && replayOnly.includes(key)) return
      switch (key) {
        case ' ':
          e.preventDefault()
          if (s.tab !== 'compare') s.togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          s.stepT(-1)
          break
        case 'ArrowRight':
          e.preventDefault()
          s.stepT(1)
          break
        case '[':
          s.stepScenario(-1)
          break
        case ']':
          s.stepScenario(1)
          break
        case 'c':
          s.setTab(s.tab === 'compare' ? 'cells' : 'compare')
          break
        case 'o':
          s.toggleOutage()
          break
        case 'w':
          s.setTab('warnings')
          break
        case 'g':
          s.setGalleryOpen(!s.galleryOpen)
          break
        case 'h':
          s.toggleHidePanels()
          break
        case 'r':
          s.reset()
          break
        case 'p':
          if (s.presenting) stopPresentation()
          else startPresentation()
          break
        case 'Escape':
          if (s.presenting) stopPresentation()
          else if (s.endCard) useApp.setState({ endCard: false })
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/** Recording mode: hide the cursor after 2 s idle and silence tooltips. */
export function useRecordingMode() {
  const recording = useApp((s) => s.recording)
  useEffect(() => {
    document.body.classList.toggle('recording', recording)
    if (!recording) {
      document.body.classList.remove('rec-idle')
      return
    }
    let id = 0
    const arm = () => {
      document.body.classList.remove('rec-idle')
      clearTimeout(id)
      id = window.setTimeout(() => document.body.classList.add('rec-idle'), 2000)
    }
    arm()
    window.addEventListener('mousemove', arm)
    return () => {
      clearTimeout(id)
      window.removeEventListener('mousemove', arm)
    }
  }, [recording])
}
