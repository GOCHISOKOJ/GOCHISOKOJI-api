import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/gemini/client';
import { toKojiDisplayName } from '@/lib/utils/koji';
import { getJstHour, getSeasonalIngredientCandidatesForMonth, pickSeasonalIngredientsForNow } from '@/lib/utils/seasonal';

export const runtime = 'nodejs';

type IntroExample = { title: string; description: string };
type IntroResponse = {
  greeting: string;
  pickedIngredients: string[];
  examples: Record<string, IntroExample>;
};

function includesAnyIngredient(text: string, ingredients: string[]): boolean {
  return ingredients.some((ing) => text.includes(ing));
}

function includesAllIngredients(text: string, ingredients: string[]): boolean {
  return ingredients.every((ing) => text.includes(ing));
}


/**
 * 「1食材=1こうじ=1品」を検証するロジック
 * 各こうじに「担当の旬食材」を割り当て、その食材がタイトルに含まれているかチェック
 * AIの例がない場合はシンプルなフォールバックを生成
 */
function validateExamples(args: {
  examples: Record<string, IntroExample>;
  displayKojiTypes: string[];
  pickedIngredients: string[];
}): Record<string, IntroExample> {
  const { examples, displayKojiTypes, pickedIngredients } = args;
  const ingredients = pickedIngredients.slice(0, 3);
  const validated: Record<string, IntroExample> = {};

  // 各こうじに「担当食材」を1対1で割り当て（displayKojiTypes[i] ↔ ingredients[i]）
  for (let i = 0; i < displayKojiTypes.length; i++) {
    const koji = displayKojiTypes[i];
    const assignedIng = ingredients[i] || ingredients[0] || '旬の食材';
    const aiExample = examples[koji];

    if (aiExample && typeof aiExample.title === 'string' && typeof aiExample.description === 'string') {
      // AIの例があれば、担当食材がタイトルに含まれているかチェック
      if (aiExample.title.includes(assignedIng)) {
        // すでに含まれていればOK
        validated[koji] = aiExample;
      } else {
        // 含まれていなければタイトルを補正
        validated[koji] = {
          title: `${assignedIng}の${aiExample.title.replace(/^.+?の/, '')}`,
          description: aiExample.description.includes(assignedIng)
            ? aiExample.description
            : `${aiExample.description}（旬の${assignedIng}を使って！）`,
        };
      }
    } else {
      // AIの例がない場合はシンプルなフォールバック
      validated[koji] = {
        title: `${assignedIng}を使った${koji}料理`,
        description: `${koji}で${assignedIng}を美味しく調理するよ！`,
      };
    }
  }

  return validated;
}

function uniqueStrings(arr: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of arr) {
    if (typeof v !== 'string') continue;
    const s = v.trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function hasReadableLineBreaks(text: string): boolean {
  // 見やすさ要件: 空行（\n\n）が少なくとも2回ある（指定の7行フォーマット想定）
  const m = (text || '').match(/\n\s*\n/g);
  return (m?.length ?? 0) >= 2;
}

function startsWithExpectedGreeting(text: string, timeLabel: 'morning' | 'day'): boolean {
  const s = (text || '').trim();
  if (!s) return false;
  if (timeLabel === 'morning') {
    // 10:00前は「おはよう！」
    return /^おはよう[！!]/.test(s);
  }
  // 10:00以降は「こんにちは！」
  return /^こんにちは[！!]/.test(s);
}

function includesSelfIntro(text: string): boolean {
  return (text || '').includes('こうじのコウちゃんだよ！');
}

function extractJsonObject(text: string): string | null {
  let s = text.trim();
  // ```json ... ``` を除去
  s = s.replace(/```json\s*/g, '').replace(/```/g, '').trim();
  const m = s.match(/\{[\s\S]*\}/);
  return m ? m[0] : null;
}

export async function POST(request: NextRequest) {
  const LOG_URL = 'http://127.0.0.1:7244/ingest/a2183a97-7691-4013-9b1b-c6f1b8ad2750';
  const logSync = async (message: string, data: any, hypothesisId: string) => {
    try {
      await fetch(LOG_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'intro-api2',
          hypothesisId,
          location: 'src/app/api/chat-intro/route.ts',
          message,
          data,
          timestamp: Date.now(),
        }),
      });
    } catch {
      // ignore
    }
  };
  try {
    const body = (await request.json().catch(() => ({}))) as {
      kojiTypes?: string[];
      avoidSets?: string[][];
      pickedIngredients?: string[];
    };
    const dbKojiTypes = Array.isArray(body.kojiTypes) && body.kojiTypes.length > 0 ? body.kojiTypes : [];
    const avoidSetsRaw = Array.isArray(body.avoidSets) ? body.avoidSets : [];
    const avoidSets = avoidSetsRaw
      .filter((x) => Array.isArray(x) && x.every((v) => typeof v === 'string'))
      .slice(0, 3)
      .map((x) => (x as string[]).map((s) => s.trim()).filter(Boolean).slice(0, 3).sort((a, b) => a.localeCompare(b)));

    // 表示用のこうじ名に変換（DB値は保持する前提）
    const displayKojiTypes =
      dbKojiTypes.length > 0
        ? dbKojiTypes.map((k) => toKojiDisplayName(k))
        : ['たまねぎこうじ', '中華こうじ', 'コンソメこうじ'];

    // 今月の旬食材候補（AIがここから選ぶ）
    const month = new Date().getMonth() + 1;
    const candidates = getSeasonalIngredientCandidatesForMonth(month);

    // クライアントから「旬食材3つ」が渡された場合はそれを固定で採用する
    const forcedPickedRaw = Array.isArray(body.pickedIngredients) ? uniqueStrings(body.pickedIngredients) : [];
    const forcedPicked = forcedPickedRaw.filter((x) => candidates.includes(x)).slice(0, 3);

    // #region agent log
    await logSync('intro_entry', { month, candidatesCount: candidates.length, displayKojiTypes, avoidSets }, 'H1');
    // #endregion

    // #region agent log
    fetch(LOG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'intro-api',
        hypothesisId: 'H3_intro_api_entry',
        location: 'src/app/api/chat-intro/route.ts:entry',
        message: 'chat-intro start',
        data: { month, candidatesCount: candidates.length, displayKojiTypes },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    // 日本時間(JST)で「10:00」を境に切り替える（UTC+9の手計算でブレ防止）
    const hourJst = getJstHour(new Date());
    const timeLabel: 'morning' | 'day' = hourJst < 10 ? 'morning' : 'day';
    // 旬食材とこうじの割り当て例を生成（AIに具体例を示すため）
    const ingredientList = forcedPicked.length === 3 ? forcedPicked : ['食材A', '食材B', '食材C'];
    const assignmentExample = displayKojiTypes.map((koji, i) => `${koji} → ${ingredientList[i]}`).join('、');

    const prompt = `
あなたは「こうじのコウちゃん」です。
今日は${month}月です。旬食材の候補は次の通りです: ${candidates.join('・')}
今の時間帯は「${timeLabel}」です（morning/day）。

【旬食材の指定】
旬食材は次の3つで固定: ${ingredientList.join('・')}
pickedIngredientsにはこの3つだけを入れる（他は入れない）

【挨拶(greeting)のルール】
- 時間帯で先頭を切り替え: ${timeLabel === 'morning' ? 'おはよう！' : 'こんにちは！'}
- 必ず次の7行フォーマット:
  1行目: ${timeLabel === 'morning' ? 'おはよう！' : 'こんにちは！'}
  2行目: こうじのコウちゃんだよ！
  3行目: （空行）
  4行目: ${month}月の旬: ${ingredientList.join('・')} とかがおすすめ😋
  5行目: （空行）
  6行目: 今日はどんな料理を作りたい？
  7行目: 下の「例」や「使うこうじ」を選んでね！

【例(examples)のルール - 超重要】
★★★ 1食材=1こうじ=1品 で、「美味しそう！食べたい！」と思える料理名を提案 ★★★
3つの旬食材を、3つのこうじに1対1で割り当てて、それぞれの「ベストな相性メニュー」を考えてください。

【各こうじの基本特性】
- たまねぎこうじ: 甘みとコクがあり、和洋問わず使える万能タイプ
- 中華こうじ: 生姜・にんにくの風味があり、中華系の味付けに合う
- コンソメこうじ: 野菜の甘みがあり、洋食の味付けに合う

【重要: 食材とこうじの相性を考えて割り当てる】
- 各こうじの基本特性を活かして、食材に最も合う料理を自由に考えて提案する
- 料理名は具体的で、美味しそうで、作りたくなるようなものにする

割り当て:
${assignmentExample}

具体的には:
- ${displayKojiTypes[0]} は「${ingredientList[0]}」を主役にした具体的な料理名を提案
- ${displayKojiTypes[1]} は「${ingredientList[1]}」を主役にした具体的な料理名を提案
- ${displayKojiTypes[2]} は「${ingredientList[2]}」を主役にした具体的な料理名を提案

【絶対NG - 出力禁止】
× 「〇〇の簡単おかず」「〇〇料理」など曖昧な名前
× 食材と料理の組み合わせがおかしいもの（例: 「いちごの麻婆」「大根のグラタン」など）
× 実際に作っても美味しくなさそうな組み合わせ

【OK例 - 美味しそうな組み合わせ】
○ 「白菜のポトフ」「大根と豚バラの煮物」「ほうれん草のソテー」
○ 「長ねぎの中華炒め」「キャベツの回鍋肉」「ブリの照り焼き」
○ 「鶏もも肉のクリームシチュー」「鮭のちゃんちゃん焼き」

【こうじ名の表記】
必ず「${displayKojiTypes.join(' / ')}」の表記を使う（「麹」は使わない）

【出力形式】
JSONのみ（コードフェンスや説明文なし）:
{
  "greeting": "7行の挨拶文",
  "pickedIngredients": ["${ingredientList[0]}", "${ingredientList[1]}", "${ingredientList[2]}"],
  "examples": {
    "${displayKojiTypes[0]}": {"title": "${ingredientList[0]}の具体的な料理名", "description": "短い説明（作り方のヒント）"},
    "${displayKojiTypes[1]}": {"title": "${ingredientList[1]}の具体的な料理名", "description": "短い説明（作り方のヒント）"},
    "${displayKojiTypes[2]}": {"title": "${ingredientList[2]}の具体的な料理名", "description": "短い説明（作り方のヒント）"}
  }
}
`.trim();

    const raw = await generateText(prompt, { model: 'gemini-1.5-flash', temperature: 0.7, maxOutputTokens: 3000 });
    // #region agent log
    await logSync(
      'intro_raw',
      {
        rawLength: raw?.length ?? null,
        hasFence: typeof raw === 'string' ? raw.includes('```') : false,
        hasOpenBrace: typeof raw === 'string' ? raw.includes('{') : false,
        hasCloseBrace: typeof raw === 'string' ? raw.includes('}') : false,
        head: typeof raw === 'string' ? raw.slice(0, 120) : null,
        tail: typeof raw === 'string' ? raw.slice(Math.max(0, raw.length - 120)) : null,
      },
      'H2'
    );
    // #endregion
    // #region agent log
    fetch(LOG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'intro-api',
        hypothesisId: 'H3_intro_api_raw',
        location: 'src/app/api/chat-intro/route.ts:after_generateText',
        message: 'chat-intro raw received',
        data: {
          rawLength: raw?.length ?? null,
          hasFence: typeof raw === 'string' ? raw.includes('```') : false,
          hasOpenBrace: typeof raw === 'string' ? raw.includes('{') : false,
          hasCloseBrace: typeof raw === 'string' ? raw.includes('}') : false,
          head: typeof raw === 'string' ? raw.slice(0, 80) : null,
          tail: typeof raw === 'string' ? raw.slice(Math.max(0, raw.length - 80)) : null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    const jsonStr = extractJsonObject(raw);
    // #region agent log
    await logSync('intro_extract', { jsonFound: !!jsonStr, jsonLength: jsonStr?.length ?? null }, 'H3');
    // #endregion
    // #region agent log
    fetch(LOG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'intro-api',
        hypothesisId: 'H3_intro_api_extract',
        location: 'src/app/api/chat-intro/route.ts:extractJsonObject',
        message: 'chat-intro extractJsonObject',
        data: { jsonFound: !!jsonStr, jsonLength: jsonStr?.length ?? null },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    // サーバ側で確定する旬食材（固定指定があればそれを優先）
    const serverPickedBase =
      forcedPicked.length === 3 ? forcedPicked : pickSeasonalIngredientsForNow(3).pickedIngredients.slice(0, 3);

    if (!jsonStr) {
      // JSONが取れない場合はフォールバックを返す
      // #region agent log
      await logSync('intro_no_json_fallback', { rawHead: raw.slice(0, 200) }, 'H4');
      // #endregion

      const pickedIngredients = serverPickedBase.slice(0, 3).sort((a, b) => a.localeCompare(b));
      const fallbackGreeting =
        `${timeLabel === 'morning' ? 'おはよう！' : 'こんにちは！'}\n` +
        `こうじのコウちゃんだよ！\n\n` +
        `${month}月の旬: ${pickedIngredients.join('・')} とかがおすすめ😋\n\n` +
        `今日はどんな料理を作りたい？\n` +
        `下の「例」や「使うこうじ」を選んでね！`;
      const examples = validateExamples({
        examples: {},
        displayKojiTypes,
        pickedIngredients,
      });

      return NextResponse.json({
        success: true,
        greeting: fallbackGreeting,
        pickedIngredients,
        examples,
        displayKojiTypes,
        degraded: true,
      });
    }

    let parsed: IntroResponse | null = null;
    try {
      parsed = JSON.parse(jsonStr) as IntroResponse;
    } catch {
      // 最後の手段: pickedIngredients はサーバ側の値を採用し、greetingだけ空で返す
      parsed = null;
    }

    // AIが選んだ旬食材を検証（候補外は弾く）。足りない分はサーバ側でランダム補完。
    const aiPickedRaw = (parsed as any)?.pickedIngredients;
    const aiPicked = Array.isArray(aiPickedRaw) ? uniqueStrings(aiPickedRaw) : [];
    const validPicked = aiPicked.filter((x) => candidates.includes(x));
    const fallbackPicked = serverPickedBase.slice(0, 3).sort((a, b) => a.localeCompare(b));
    let pickedIngredients: string[] = [];
    for (const x of validPicked) {
      if (pickedIngredients.length >= 3) break;
      pickedIngredients.push(x);
    }
    for (const x of fallbackPicked) {
      if (pickedIngredients.length >= 3) break;
      if (pickedIngredients.includes(x)) continue;
      pickedIngredients.push(x);
    }
    pickedIngredients = pickedIngredients.slice(0, 3).sort((a, b) => a.localeCompare(b));

    // 直近の被り回避：一致したらフォールバックで置き換え（最大数回）
    if (
      avoidSets.some(
        (s) =>
          s.length === 3 &&
          s[0] === pickedIngredients[0] &&
          s[1] === pickedIngredients[1] &&
          s[2] === pickedIngredients[2]
      )
    ) {
      for (let i = 0; i < 6; i++) {
        const p = pickSeasonalIngredientsForNow(3).pickedIngredients.slice(0, 3).sort((a, b) => a.localeCompare(b));
        if (!avoidSets.some((s) => s.length === 3 && s[0] === p[0] && s[1] === p[1] && s[2] === p[2])) {
          pickedIngredients = p;
          break;
        }
        pickedIngredients = p;
      }
    }

    const fallbackGreeting =
      `${timeLabel === 'morning' ? 'おはよう！' : 'こんにちは！'}\n` +
      `こうじのコウちゃんだよ！\n\n` +
      `${month}月の旬: ${pickedIngredients.join('・')} とかがおすすめ😋\n\n` +
      `今日はどんな料理を作りたい？\n` +
      `下の「例」や「使うこうじ」を選んでね！`;

    // AIのgreetingが旬食材（pickedIngredients）とズレると、例との整合が崩れる。
    // そのため「pickedIngredientsを必ず含む」ことを検証し、満たさない場合はサーバ生成の挨拶に差し替える。
    const aiGreeting = parsed?.greeting && typeof parsed.greeting === 'string' ? parsed.greeting : '';
    const greetingOk =
      !!aiGreeting &&
      includesAllIngredients(aiGreeting, pickedIngredients) &&
      startsWithExpectedGreeting(aiGreeting, timeLabel) &&
      includesSelfIntro(aiGreeting) &&
      hasReadableLineBreaks(aiGreeting);
    const greeting = greetingOk ? aiGreeting : fallbackGreeting;

    const rawExamples = parsed?.examples && typeof parsed.examples === 'object' ? parsed.examples : {};
    const examples = validateExamples({
      examples: rawExamples,
      displayKojiTypes,
      pickedIngredients,
    });

    // pickedIngredients はサーバ側の決定値を返す（挨拶と例の整合の根拠）
    return NextResponse.json({
      success: true,
      greeting,
      pickedIngredients,
      examples,
      displayKojiTypes,
    });
  } catch (e: any) {
    // #region agent log
    await logSync('intro_fatal_error', { message: e instanceof Error ? e.message : String(e) }, 'ERROR');
    // #endregion

    const month = new Date().getMonth() + 1;
    // 旬食材をランダムに再取得
    const p = pickSeasonalIngredientsForNow(3).pickedIngredients.slice(0, 3).sort((a, b) => a.localeCompare(b));
    const fallbackKojiTypes = ['たまねぎこうじ', '中華こうじ', 'コンソメこうじ'];
    
    const fallbackGreeting =
      `こんにちは！\n` +
      `こうじのコウちゃんだよ！\n\n` +
      `${month}月の旬: ${p.join('・')} とかがおすすめ😋\n\n` +
      `今日はどんな料理を作りたい？\n` +
      `下の「例」や「使うこうじ」を選んでね！`;
      
    // 既存のvalidateExamplesを使ってフォールバック例を生成
    const examples = validateExamples({
      examples: {},
      displayKojiTypes: fallbackKojiTypes,
      pickedIngredients: p,
    });

    return NextResponse.json({
      success: true,
      greeting: fallbackGreeting,
      pickedIngredients: p,
      examples,
      displayKojiTypes: fallbackKojiTypes,
      degraded: true,
      error: e instanceof Error ? e.message : String(e) // デバッグ用に含める
    });
  }
}


