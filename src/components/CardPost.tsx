'use client';

import React from 'react';
import { Clock, Bookmark } from 'lucide-react';
import { ChipTag } from './ChipTag';
import type { Ingredient } from '@/lib/types/database';
import { toKojiDisplayName } from '@/lib/utils/koji';

interface CardPostProps {
  postId: string;
  image?: string | null;
  title: string;
  description?: string | null;
  authorName?: string | null;
  authorAvatarUrl?: string | null;
  kojiType: string;
  ingredients?: Ingredient[] | null;
  totalMinutes: number;
  postedDate: string;
  isSaved?: boolean;
  isSaving?: boolean;
  onToggleSave?: (postId: string) => void;
  onClick?: () => void;
  className?: string;
}

export function CardPost({
  postId,
  image,
  title,
  description,
  authorName,
  authorAvatarUrl,
  kojiType,
  ingredients,
  totalMinutes,
  postedDate,
  isSaved = false,
  isSaving = false,
  onToggleSave,
  onClick,
  className = '',
}: CardPostProps) {
  const rightBoxRef = React.useRef<HTMLDivElement | null>(null);
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = React.useState(false);

  const ingredientNames = React.useMemo(() => {
    const names = (ingredients ?? [])
      .map((i) => (i?.name ?? '').trim())
      .filter(Boolean);
    return names.slice(0, 3);
  }, [ingredients]);

  const authorInitial = (authorName ?? '').trim().slice(0, 1) || 'U';

  const logRects = React.useCallback((stage: 'layout' | 'img:onload') => {
    const right = rightBoxRef.current;
    const imgEl = imgRef.current;
    if (!right || !imgEl) return;
    const rightRect = right.getBoundingClientRect();
    const imgRect = imgEl.getBoundingClientRect();
    const rightStyle = window.getComputedStyle(right);
    const imgStyle = window.getComputedStyle(imgEl);

    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/a2183a97-7691-4013-9b1b-c6f1b8ad2750',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'src/components/CardPost.tsx:logRects',message:'CardPost image box measurements',data:{stage,hasImage:!!image,imgLoaded,imgNatural:{w:imgEl.naturalWidth||null,h:imgEl.naturalHeight||null},rightRect:{w:Math.round(rightRect.width),h:Math.round(rightRect.height)},imgRect:{w:Math.round(imgRect.width),h:Math.round(imgRect.height)},rightStyle:{display:rightStyle.display,alignSelf:rightStyle.alignSelf,overflow:rightStyle.overflow,borderRadius:rightStyle.borderRadius,backgroundColor:rightStyle.backgroundColor},imgStyle:{display:imgStyle.display,objectFit:imgStyle.objectFit,objectPosition:imgStyle.objectPosition}},timestamp:Date.now(),sessionId:'debug-session',runId:'cardpost-bottom-gap',hypothesisId:stage==='layout'?'A':'B'})}).catch(()=>{});
    // #endregion
  }, [image, imgLoaded]);

  React.useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    if (!image) return;
    logRects('layout');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, logRects]);

  return (
    <article 
      className={`bg-surface rounded-lg overflow-hidden shadow-card hover:shadow-medium transition-shadow cursor-pointer ${className}`}
      onClick={onClick}
    >
      {/* 画像は上下いっぱいに、テキスト側だけ上下パディングを持たせる（Cookpad風） */}
      <div className="pl-3 pr-0 flex items-stretch gap-3">
        {/* 左：情報 */}
        <div className="flex-1 min-w-0 flex flex-col gap-2 pr-3 py-3">
          {/* タイトル */}
          <h3 className="text-sm font-semibold leading-snug line-clamp-2">{title}</h3>

          {/* 材料（A: 材料名だけ最大3つ） */}
          {ingredientNames.length > 0 && (
            <div className="text-xs text-muted-foreground line-clamp-1">
              {ingredientNames.join('、')}
            </div>
          )}

          {/* タグと情報 */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <ChipTag type="koji" label={toKojiDisplayName(kojiType)} />
            {totalMinutes > 0 && (
              <ChipTag type="time" label={`${totalMinutes}分`} icon={<Clock className="h-3 w-3" />} />
            )}
          </div>

          {/* 下寄せスペーサー（ユーザー行を“ちょこん”と下へ） */}
          <div className="flex-1" />

          {/* ユーザー（アイコン + 名前）: 小さく、下の方に */}
          {authorName && (
            <div className="flex items-center gap-2 min-w-0 text-xs text-foreground/60">
              <div className="h-4 w-4 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0">
                {authorAvatarUrl ? (
                  <img
                    src={authorAvatarUrl}
                    alt={authorName}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-xs font-medium">{authorInitial}</span>
                )}
              </div>
              <div className="truncate leading-none">{authorName}</div>
            </div>
          )}
        </div>

        {/* 右：サムネ（Cookpad風） */}
        {/* h-full(%) は親に明示高さがないと効かず、stretchを阻害して下に余白が残るので外す */}
        <div ref={rightBoxRef} className="relative w-32 self-stretch overflow-hidden bg-muted shrink-0 rounded-r-lg">
          {image ? (
            <img
              ref={imgRef}
              src={image}
              alt={title}
              className="block w-full h-full object-cover"
              loading="lazy"
              onLoad={() => {
                setImgLoaded(true);
                logRects('img:onload');
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/10">
              <div className="text-xs text-foreground/70">写真なし</div>
            </div>
          )}

          {onToggleSave && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave(postId);
              }}
              disabled={isSaving}
              className="absolute bottom-2 right-2 z-10 h-11 w-11 rounded-full bg-surface/90 border border-border shadow-sm flex items-center justify-center hover:bg-surface transition-colors disabled:opacity-60"
              aria-label={isSaved ? '保存を解除' : '保存する'}
            >
              <Bookmark
                className={isSaved ? 'h-4 w-4 text-primary' : 'h-4 w-4 text-foreground/70'}
                fill={isSaved ? 'currentColor' : 'none'}
              />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

