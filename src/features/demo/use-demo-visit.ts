import { useEffect } from 'react'
import { recordDemoVisit } from '../board/board-api'
import { IS_DEMO } from './demo-config'
import { getVisitorFingerprint } from './visitor-fingerprint'

const VISIT_LOGGED_KEY = 'demo-visit-logged'

/** Set before the request goes out, so a repeated effect can't log it twice. */
let isVisitBeingLogged = false

function wasVisitLogged(): boolean {
  try {
    return sessionStorage.getItem(VISIT_LOGGED_KEY) === 'yes'
  } catch {
    // Storage can be blocked; logging the visit again is harmless.
    return false
  }
}

function markVisitLogged(): void {
  try {
    sessionStorage.setItem(VISIT_LOGGED_KEY, 'yes')
  } catch {
    // Without storage the next page may log the visit again, which is fine.
  }
}

/**
 * Demo only: logs one visit per browser tab, and starts working out the
 * fingerprint straight away so the first save doesn't have to wait for it.
 */
export function useDemoVisit(): void {
  useEffect(() => {
    if (!IS_DEMO) return
    if (isVisitBeingLogged || wasVisitLogged()) {
      void getVisitorFingerprint()
      return
    }
    isVisitBeingLogged = true
    recordDemoVisit()
      .then(markVisitLogged)
      .catch(() => {
        // The visit log is best effort: the board works without it, and the
        // next page in this tab tries again since nothing was marked.
      })
      .finally(() => {
        isVisitBeingLogged = false
      })
  }, [])
}
