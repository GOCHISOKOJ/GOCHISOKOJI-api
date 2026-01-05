import * as React from 'react';

export type KeyboardState = {
  isOpen: boolean;
  /**
   * CSS px. Intended to be used as `bottom` offset for fixed elements to sit above the keyboard.
   * Do NOT treat as secret; contains no PII.
   */
  offsetPx: number;
};

/**
 * iOS/Safari friendly keyboard detector using VisualViewport.
 * Falls back to focus heuristics if VisualViewport is unavailable.
 */
export function useKeyboard(): KeyboardState {
  const [state, setState] = React.useState<KeyboardState>({ isOpen: false, offsetPx: 0 });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const vv = window.visualViewport;

    const compute = () => {
      try {
        if (vv) {
          // On mobile, VisualViewport height shrinks when keyboard appears.
          const raw = window.innerHeight - vv.height - vv.offsetTop;
          const offsetPx = Math.max(0, Math.round(raw));
          const isOpen = offsetPx > 0;

          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/a2183a97-7691-4013-9b1b-c6f1b8ad2750',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'kbd',hypothesisId:'H_vv',location:'src/lib/hooks/useKeyboard.ts:compute',message:'visualViewport computed',data:{innerH:window.innerHeight,vvH:vv.height,vvTop:vv.offsetTop,offsetPx,isOpen},timestamp:Date.now()})}).catch(()=>{});
          // #endregion

          setState((prev) => (prev.isOpen === isOpen && prev.offsetPx === offsetPx ? prev : { isOpen, offsetPx }));
          return;
        }

        // Fallback: assume keyboard open while focusing an input/textarea/select.
        const el = document.activeElement as HTMLElement | null;
        const isEditable =
          !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/a2183a97-7691-4013-9b1b-c6f1b8ad2750',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'kbd',hypothesisId:'H_fallback',location:'src/lib/hooks/useKeyboard.ts:compute',message:'fallback computed',data:{isEditable,tag:el?.tagName??null},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        setState((prev) => (prev.isOpen === isEditable && prev.offsetPx === 0 ? prev : { isOpen: isEditable, offsetPx: 0 }));
      } catch {
        // ignore
      }
    };

    compute();

    const onFocus = () => compute();
    const onBlur = () => compute();

    window.addEventListener('focusin', onFocus);
    window.addEventListener('focusout', onBlur);

    if (vv) {
      vv.addEventListener('resize', compute);
      vv.addEventListener('scroll', compute);
    } else {
      window.addEventListener('resize', compute);
    }

    return () => {
      window.removeEventListener('focusin', onFocus);
      window.removeEventListener('focusout', onBlur);
      if (vv) {
        vv.removeEventListener('resize', compute);
        vv.removeEventListener('scroll', compute);
      } else {
        window.removeEventListener('resize', compute);
      }
    };
  }, []);

  return state;
}


