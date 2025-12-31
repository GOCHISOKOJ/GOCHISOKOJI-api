import { NextRequest, NextResponse } from 'next/server';
import { generateChatReply, type ChatMessage } from '@/lib/gemini/client';
import { createKojiChatSystemInstruction } from '@/lib/gemini/prompts';
import { createClient } from '@/lib/supabase/server';
import { searchEvidence, type EvidenceItem } from '@/lib/rag';

export const runtime = 'nodejs';

type RequestBody = {
  kojiType?: string; // オプショナル（未選択でも会話可能）
  messages: Array<{ role: 'user' | 'ai'; text: string }>;
  firstTurn?: boolean; // 新規チャット開始後の最初の送信で true（現在は会話モードのみ使用）
};

function extractJsonObject(text: string): string | null {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null;
  const withoutFence = trimmed.replace(/```json\s*/g, '').replace(/```/g, '').trim();
  const match = withoutFence.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

function formatEvidenceForPrompt(evidence: EvidenceItem[]): string {
  if (!Array.isArray(evidence) || evidence.length === 0) return '';
  const lines = evidence.map((e) => {
    const head = `[${e.sourceType}:${e.sourceId}#${e.chunkIndex}${e.title ? ` ${e.title}` : ''}]`;
    return `- ${head} ${e.content}`;
  });
  return [
    '【参考（エビデンス）】',
    '以下は過去のレシピ例/注意点の抜粋です。矛盾しないように参考にしてください（そのまま引用する必要はありません）。',
    ...lines,
  ].join('\n');
}

export async function POST(request: NextRequest) {
  const t0 = Date.now();
  const LOG_URL = 'http://127.0.0.1:7244/ingest/a2183a97-7691-4013-9b1b-c6f1b8ad2750';
  const log = (msg: string, data: any, hyp: string) => fetch(LOG_URL, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat/route.ts',message:msg,data,timestamp:Date.now(),sessionId:'debug',runId:'chat-debug',hypothesisId:hyp})}).catch(()=>{});
  
  try {
    const body = await request.json() as RequestBody;

    // kojiTypeは省略可能（未選択でも会話開始可能）
    const kojiType = body?.kojiType?.trim() || '';
    
    // #region agent log
    await log('1_request_received', {kojiType,messagesCount:body?.messages?.length,hasKojiType:!!kojiType}, 'A');
    // #endregion

    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: 'messages が必要です' }, { status: 400 });
    }

    // 注: firstTurn === true でも、いきなりレシピ生成はせず、通常の会話フローで対応
    // （ユーザーが自由に話しかけた場合、AIが適切にガイドする）

    // 人気ランキング（view_count）から提案用に取得
    // 麹が選択されている場合はその麹のレシピのみ、未選択なら全体から取得
    let popular: Array<{ id: string; title: string; image_url: string | null; koji_type: string; view_count: number }> = [];
    try {
      const supabase = await createClient();
      let query = supabase
        .from('posts')
        .select('id,title,image_url,koji_type,view_count')
        .eq('is_public', true);
      
      if (kojiType) {
        query = query.eq('koji_type', kojiType);
      }
      
      const { data, error } = await query
        .order('view_count', { ascending: false })
        .limit(10);
      if (!error && data) popular = data as any;
    } catch {
      // ignore
    }

    // フロントエンドの'ai'を'model'に変換（Gemini API形式）
    const geminiMessages: ChatMessage[] = body.messages.map(msg => ({
      role: msg.role === 'ai' ? 'model' : 'user',
      text: msg.text,
    }));

    // ユーザーのメッセージ数をカウント（会話の進行度を把握）
    const userMessageCount = body.messages.filter(m => m.role === 'user').length;

    // #region agent log
    console.log(JSON.stringify({location:'src/app/api/chat/route.ts:65',message:'messages converted',data:{originalCount:body.messages.length,convertedCount:geminiMessages.length,userMessageCount,firstConverted:geminiMessages[0],lastConverted:geminiMessages[geminiMessages.length-1]},timestamp:Date.now(),sessionId:'debug-session',runId:'chat-debug',hypothesisId:'B_J'}));
    // #endregion

    // システムインストラクション（キャラクター設定 + 会話進行状況 + 人気レシピリスト）
    const popularListStr = popular.map(p => `- ID:${p.id} タイトル:${p.title} こうじ:${p.koji_type}`).join('\n');
    const baseSystemInstruction = createKojiChatSystemInstruction(kojiType, userMessageCount, popularListStr);

    // RAG: 直近のユーザー発話をクエリにして、コーパス+投稿の抜粋を追加
    let evidenceBlock = '';
    try {
      const lastUserText = [...body.messages].reverse().find((m) => m.role === 'user')?.text?.trim() || '';
      if (lastUserText) {
        const queryStr = kojiType ? `${kojiType} ${lastUserText}` : lastUserText;
        const evidence = await searchEvidence({ query: queryStr, topK: 6, sourceTypes: ['corpus', 'post'] });
        evidenceBlock = formatEvidenceForPrompt(evidence);
      }
    } catch (e) {
      await log('rag_chat_failed', { message: e instanceof Error ? e.message : String(e) }, 'RAG2');
      evidenceBlock = '';
    }

    const systemInstruction = evidenceBlock ? `${baseSystemInstruction}\n\n${evidenceBlock}` : baseSystemInstruction;

    // #region agent log
    await log('2_before_gemini', {model:'gemini-1.5-flash',userMessageCount,messagesCount:geminiMessages.length}, 'B');
    // #endregion

    // Gemini APIに会話履歴全てを送信（JSON形式で返答とチップを同時生成）
    const rawResponse = await generateChatReply(
      geminiMessages,
      systemInstruction,
      {
        model: 'gemini-2.0-flash',
        temperature: 0.7,
        maxOutputTokens: 4000,
      }
    );

    // #region agent log
    await log('3_gemini_response', {responseLength:rawResponse?.length,responsePreview:rawResponse?.substring(0,300),userMessageCount}, 'C');
    // #endregion

    // JSONをパースして返答とチップを取得
    let reply = '';
    let chips: string[] = [];
    let recommendedIds: string[] = [];
    let suggestedKoji: string | null = null; // AIが提案した麹（未選択時用）
    
    // 複数の方法でreplyを抽出
    function extractReply(text: string): string {
      // 方法1: "reply": "..." を正規表現で抽出（改行含む）
      const replyMatch = text.match(/"reply"\s*:\s*"((?:[^"\\]|\\["\\nrt])*)"/);
      if (replyMatch) {
        return replyMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
      }
      
      // 方法2: reply: の後の内容を抽出（JSON形式でない場合）
      const simpleMatch = text.match(/["']?reply["']?\s*:\s*["']([^"']+)["']/i);
      if (simpleMatch) {
        return simpleMatch[1];
      }
      
      return '';
    }
    
    function extractChips(text: string): string[] {
      const chipsMatch = text.match(/"chips"\s*:\s*\[([\s\S]*?)\]/);
      if (chipsMatch) {
        return chipsMatch[1]
          .split(',')
          .map(s => s.trim().replace(/"/g, '').replace(/'/g, ''))
          .filter(s => s.length >= 2 && s.length <= 10);
      }
      return [];
    }
    
    try {
      // JSON形式の文字列をパース
      let jsonStr = rawResponse.trim();
      
      // ```json ... ``` を除去
      jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```/g, '').trim();
      
      // { ... } を抽出
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      
      const parsed = JSON.parse(jsonStr);
      reply = typeof parsed.reply === 'string' ? parsed.reply : '';
      chips = Array.isArray(parsed.chips) ? parsed.chips.filter((c: any) => typeof c === 'string' && c.length >= 2 && c.length <= 15) : [];
      // AIが判断した関連性の高い人気レシピのIDを取得
      recommendedIds = Array.isArray(parsed.recommended_ids) ? parsed.recommended_ids.filter((id: any) => typeof id === 'string') : [];
      // AIが提案した麹の種類（未選択時に使用）
      suggestedKoji = typeof parsed.suggested_koji === 'string' ? parsed.suggested_koji.trim() : null;
      
      // #region agent log
      await log('4_json_parsed_ok', {replyLength:reply.length,chipsCount:chips.length,replyPreview:reply.substring(0,100)}, 'D');
      // #endregion
    } catch (parseError) {
      // #region agent log
      await log('4_json_parse_failed', {error:parseError instanceof Error ? parseError.message : 'unknown'}, 'D');
      // #endregion
      
      // フォールバック: 正規表現で抽出
      reply = extractReply(rawResponse);
      chips = extractChips(rawResponse);
      
      // #region agent log
      await log('4_regex_fallback', {replyLength:reply.length,replyPreview:reply.substring(0,100),chipsCount:chips.length}, 'D');
      // #endregion
    }
    
    // replyが空または不正（JSON文字が含まれる）場合は再抽出
    if (!reply || reply.includes('"reply"') || reply.includes('"chips"') || reply.startsWith('{')) {
      
      reply = extractReply(rawResponse);
      
      // それでもダメなら、JSONを除いたテキストを使用
      if (!reply || reply.startsWith('{')) {
        // JSON部分を完全に除去して残りのテキストを取得
        const cleanText = rawResponse
          .replace(/```json[\s\S]*?```/g, '')
          .replace(/\{[\s\S]*?\}/g, '')
          .trim();
        if (cleanText && !cleanText.includes('"')) {
          reply = cleanText;
        }
      }
    }
    
    // chipsのサーバー側フィルタ（AIが雑な選択肢を出してもUIに出さない）
    const isConstraintTurn =
      /作業時間|調理時間|何分|どのくらい|どれくらい|手間|時短|手早く|簡単に|ラクに/.test(reply);
    const isTasteTurn = /味|辛|あっさり|こってり|濃いめ|うすめ|さっぱり|マイルド|スパイシ/.test(reply);

    const replyNormalized = reply.replace(/\s+/g, '');

    // 確認用チップ（ステップ3で使用）は長さフィルタをスキップ
    const confirmationChips = ['はい、作って', 'もう少し考える'];
    const isConfirmationChip = (c: string) => confirmationChips.includes(c);
    
    chips = chips
      .map((c) => c.trim())
      .filter((c) => isConfirmationChip(c) || (c.length >= 2 && c.length <= 15))
      // 確認用チップはreplyチェックをスキップ
      .filter((c) => isConfirmationChip(c) || replyNormalized.includes(c.replace(/\s+/g, '')))
      // 「その他」系は常に除外
      .filter((c) => !/^(その他|そのほか|他)$/.test(c))
      // 曖昧表現（例: もっとあっさりに）は除外
      .filter((c) => !/^もっと/.test(c))
      // 材料入替（例: 鶏肉を豚肉に）は除外
      .filter((c) => !/.+を.+に$/.test(c))
      // 「時短」は調理条件を聞いているときだけ許可（味の好み/それ以外では除外）
      .filter((c) => (c === '時短' ? isConstraintTurn && !isTasteTurn : true));

    // チップをフロントエンド形式に変換（フェーズに応じて表示を制御）
    let suggestions: Array<{ label: string; text: string }> = [];
    // レシピ下書き生成を促すボタンを表示するか（ユーザーが3回以上メッセージを送った後）
    const shouldShowCreateButton = userMessageCount >= 3;
    
    if (userMessageCount === 0) {
      // フェーズ1（初回挨拶）: チップなし
      suggestions = [];
    } else if (chips.length > 0) {
      // AIが生成したチップを表示
      suggestions = chips.slice(0, 5).map(chip => ({
        label: chip,
        text: chip
      }));
    }
    const finalReply = reply || 'ごめんね、うまく返答できなかったよ。もう一度送ってみて！';
    
    // #region agent log
    await log('5_final_response', {finalReplyLength:finalReply.length,finalReply,suggestionsCount:suggestions.length,durationMs:Date.now()-t0}, 'E');
    // #endregion
    
    // AIが判断した関連性の高い人気レシピのみをフィルタリング
    const filteredPopular = recommendedIds.length > 0
      ? popular.filter(p => recommendedIds.includes(p.id))
      : []; // 関連性がなければ空配列

    return NextResponse.json({
      success: true,
      reply: finalReply,
      suggestions,
      shouldShowCreateButton, // レシピ下書き生成を促す段階か
      suggestedKoji, // AIが会話から推測した最適な麹（未選択時用）
      popular: filteredPopular.map((p) => ({
        id: p.id,
        title: p.title,
        imageUrl: p.image_url,
        kojiType: p.koji_type,
        viewCount: p.view_count,
      })),
    });
  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/a2183a97-7691-4013-9b1b-c6f1b8ad2750',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat/route.ts',message:'CATCH_ERROR',data:{error:error?.message,stack:error?.stack?.substring(0,300)},timestamp:Date.now(),sessionId:'debug',runId:'chat-debug',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    console.error('Error in /api/chat:', error);
    return NextResponse.json(
      {
        error: 'チャットの生成に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
