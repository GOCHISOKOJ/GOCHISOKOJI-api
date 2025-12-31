'use client';

import React from 'react';
import Image from 'next/image';
import { Bot } from 'lucide-react';

interface AIAvatarProps {
  /**
   * 後からロゴ画像（例: YouTubeロゴ）に差し替えるためのURL/パス。
   * 未指定の場合は仮のチャットボットアイコンを表示。
   */
  src?: string | null;
  alt?: string;
  className?: string;
}

export function AIAvatar({ src, alt = 'AI', className = '' }: AIAvatarProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const [imgFailed, setImgFailed] = React.useState(false);

  const log = React.useCallback((payload: Record<string, unknown>) => {
    // 同一オリジン経由で確実にログファイルへ落とす（CORS回避）
    fetch('/api/debug-log', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
    }).catch(() => {});

    // 既存のingestにも送る（残しておく）
    fetch('http://127.0.0.1:7244/ingest/a2183a97-7691-4013-9b1b-c6f1b8ad2750',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).catch(()=>{});
  }, []);

  const debugLog = React.useCallback((payload: Record<string, unknown>) => {
    fetch('/api/debug-log', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, []);

  React.useEffect(() => {
    // #region agent log
    log({location:'src/components/AIAvatar.tsx:AIAvatar',message:'mount',data:{src:src??null,alt,className,href:typeof window!=='undefined'?window.location.href:null},timestamp:Date.now(),sessionId:'debug-session',runId:'kochan-avatar',hypothesisId:'D'});
    // #endregion

    // #region agent log
    debugLog({
      sessionId: 'debug-session',
      runId: 'avatar-debug',
      hypothesisId: 'H2_next_image_load',
      location: 'src/components/AIAvatar.tsx:effect',
      message: 'effect start',
      data: {
        src: src ?? null,
        imgFailed,
        href: typeof window !== 'undefined' ? window.location.href : null,
      },
      timestamp: Date.now(),
    });
    // #endregion

    const el = rootRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const styles = window.getComputedStyle(el);
      // #region agent log
      log({location:'src/components/AIAvatar.tsx:AIAvatar',message:'layout',data:{rect:{w:Math.round(rect.width),h:Math.round(rect.height)},display:styles.display,visibility:styles.visibility,opacity:styles.opacity,overflow:styles.overflow},timestamp:Date.now(),sessionId:'debug-session',runId:'kochan-avatar',hypothesisId:'C'});
      // #endregion

      // #region agent log
      debugLog({
        sessionId: 'debug-session',
        runId: 'avatar-debug',
        hypothesisId: 'H2_next_image_load',
        location: 'src/components/AIAvatar.tsx:layout',
        message: 'container layout',
        data: {
          rect: { w: Math.round(rect.width), h: Math.round(rect.height) },
          display: styles.display,
          visibility: styles.visibility,
          opacity: styles.opacity,
          overflow: styles.overflow,
        },
        timestamp: Date.now(),
      });
      // #endregion
    }

    if (!src) return;
    const url = src.startsWith('http') ? src : `${window.location.origin}${src}`;
    const img = new window.Image();
    img.onload = () => {
      // #region agent log
      log({location:'src/components/AIAvatar.tsx:AIAvatar',message:'img-onload',data:{url,natural:{w:img.naturalWidth,h:img.naturalHeight}},timestamp:Date.now(),sessionId:'debug-session',runId:'kochan-avatar',hypothesisId:'B_ok'});
      // #endregion
    };
    img.onerror = () => {
      // #region agent log
      log({location:'src/components/AIAvatar.tsx:AIAvatar',message:'img-onerror',data:{url},timestamp:Date.now(),sessionId:'debug-session',runId:'kochan-avatar',hypothesisId:'B'});
      // #endregion
    };
    img.src = url;

    fetch(url, { method: 'HEAD' })
      .then((res) => {
        // #region agent log
        log({location:'src/components/AIAvatar.tsx:AIAvatar',message:'asset-head',data:{url,status:res.status,ok:res.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'kochan-avatar',hypothesisId:res.ok?'A_ok':'A'});
        // #endregion

        // #region agent log
        debugLog({
          sessionId: 'debug-session',
          runId: 'avatar-debug',
          hypothesisId: 'H3_asset_response',
          location: 'src/components/AIAvatar.tsx:asset-head',
          message: 'asset head',
          data: {
            url,
            status: res.status,
            ok: res.ok,
            cacheControl: res.headers.get('cache-control'),
            etag: res.headers.get('etag'),
            lastModified: res.headers.get('last-modified'),
            contentType: res.headers.get('content-type'),
            contentLength: res.headers.get('content-length'),
          },
          timestamp: Date.now(),
        });
        // #endregion
      })
      .catch((e) => {
        // #region agent log
        log({location:'src/components/AIAvatar.tsx:AIAvatar',message:'asset-head-error',data:{url,error:e instanceof Error?e.message:String(e)},timestamp:Date.now(),sessionId:'debug-session',runId:'kochan-avatar',hypothesisId:'A'});
        // #endregion

        // #region agent log
        debugLog({
          sessionId: 'debug-session',
          runId: 'avatar-debug',
          hypothesisId: 'H3_asset_response',
          location: 'src/components/AIAvatar.tsx:asset-head-error',
          message: 'asset head error',
          data: { url, error: e instanceof Error ? e.message : String(e) },
          timestamp: Date.now(),
        });
        // #endregion
      });
  }, [src, alt, className, imgFailed, debugLog, log]);

  return (
    <div
      ref={rootRef}
      className={`h-9 w-9 rounded-full border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0 ${className}`}
      aria-label={alt}
    >
      {src && !imgFailed ? (
        <Image
          src={src}
          alt={alt}
          width={36}
          height={36}
          className="h-full w-full object-cover"
          onError={() => {
            setImgFailed(true);
            // #region agent log
            log({location:'src/components/AIAvatar.tsx:AIAvatar',message:'next-image-error',data:{src},timestamp:Date.now(),sessionId:'debug-session',runId:'kochan-avatar',hypothesisId:'B'});
            // #endregion

            // #region agent log
            debugLog({
              sessionId: 'debug-session',
              runId: 'avatar-debug',
              hypothesisId: 'H2_next_image_load',
              location: 'src/components/AIAvatar.tsx:next-image-error',
              message: 'next/image error',
              data: { src },
              timestamp: Date.now(),
            });
            // #endregion
          }}
          onLoadingComplete={(img) => {
            // #region agent log
            log({location:'src/components/AIAvatar.tsx:AIAvatar',message:'next-image-loaded',data:{src,natural:{w:img.naturalWidth,h:img.naturalHeight}},timestamp:Date.now(),sessionId:'debug-session',runId:'kochan-avatar',hypothesisId:'B_ok'});
            // #endregion

            // #region agent log
            const observed = (() => {
              const el = rootRef.current;
              const node = el ? (el.querySelector('img') as HTMLImageElement | null) : null;
              return {
                imgSrc: node?.src ?? null,
                imgCurrentSrc: (node as any)?.currentSrc ?? null,
                imgComplete: node?.complete ?? null,
              };
            })();
            debugLog({
              sessionId: 'debug-session',
              runId: 'avatar-debug',
              hypothesisId: 'H2_next_image_load',
              location: 'src/components/AIAvatar.tsx:next-image-loaded',
              message: 'next/image loaded',
              data: { src, natural: { w: img.naturalWidth, h: img.naturalHeight }, ...observed },
              timestamp: Date.now(),
            });
            // #endregion

            // #region agent log
            // next/image の実際の取得先（/_next/image?...）が古い内容を返していないか、HEADで確認
            const current = (observed as any)?.imgCurrentSrc as string | null;
            if (current && typeof current === 'string') {
              fetch(current, { method: 'HEAD' })
                .then((res) => {
                  debugLog({
                    sessionId: 'debug-session',
                    runId: 'avatar-debug',
                    hypothesisId: 'H6_next_image_cache',
                    location: 'src/components/AIAvatar.tsx:next-image-head',
                    message: 'next/image head',
                    data: {
                      url: current,
                      status: res.status,
                      ok: res.ok,
                      xNextjsCache: res.headers.get('x-nextjs-cache'),
                      cacheControl: res.headers.get('cache-control'),
                      etag: res.headers.get('etag'),
                      lastModified: res.headers.get('last-modified'),
                      contentType: res.headers.get('content-type'),
                      contentLength: res.headers.get('content-length'),
                    },
                    timestamp: Date.now(),
                  });
                })
                .catch((e) => {
                  debugLog({
                    sessionId: 'debug-session',
                    runId: 'avatar-debug',
                    hypothesisId: 'H6_next_image_cache',
                    location: 'src/components/AIAvatar.tsx:next-image-head-error',
                    message: 'next/image head error',
                    data: { url: current, error: e instanceof Error ? e.message : String(e) },
                    timestamp: Date.now(),
                  });
                });
            }
            // #endregion
          }}
        />
      ) : (
        <Bot className="h-5 w-5 text-foreground/70" />
      )}
    </div>
  );
}


