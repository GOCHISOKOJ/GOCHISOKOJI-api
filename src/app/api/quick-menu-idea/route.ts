import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/gemini/client';
import { searchEvidence, type EvidenceItem } from '@/lib/rag';

export const runtime = 'nodejs';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

type RequestBody = {
  promptCategory?: string; // 単一カテゴリ（3案生成）
  allCategories?: boolean; // 全カテゴリ一括生成
};

const KOJI_TYPES = ['旨塩風こうじ調味料', '中華風こうじ調味料', 'コンソメ風こうじ調味料'] as const;
type KojiType = (typeof KOJI_TYPES)[number];
const CATEGORIES = ['5分で簡単レシピ', '材料1つでできる', '主菜（メイン）', '副菜（サブ）', '汁物'];
type Category = (typeof CATEGORIES)[number];

// 麹タイプごとの調理法（3案の調理法が被らないようにする）
const DISH_TYPE_BY_KOJI: Record<KojiType, string> = {
  '旨塩風こうじ調味料': '和え',      // あっさり系: 和え物、ナムル、マリネ
  '中華風こうじ調味料': '炒め',      // 濃厚系: 炒め物、あんかけ
  'コンソメ風こうじ調味料': 'スープ', // 洋風系: スープ、煮込み
};

// カテゴリ×麹タイプで調理法を決定（汁物は全てスープ系にする）
function getDishTypeForKoji(category: Category, kojiType: KojiType): string {
  if (category === '汁物') {
    // 汁物カテゴリは麹タイプに関係なくスープ系
    if (kojiType === '旨塩風こうじ調味料') return 'みそ汁';
    if (kojiType === '中華風こうじ調味料') return '鍋';
    return 'スープ';
  }
  if (category === '副菜（サブ）') {
    // 副菜は軽めの調理法
    if (kojiType === '旨塩風こうじ調味料') return '和え';
    if (kojiType === '中華風こうじ調味料') return 'ナムル';
    return 'サラダ';
  }
  // その他は基本マッピングを使用
  return DISH_TYPE_BY_KOJI[kojiType];
}

// カテゴリに応じた説明
const categoryPrompts: Record<string, string> = {
  '5分で簡単レシピ': '5分以内で作れる超時短',
  '材料1つでできる': 'メイン材料1つだけで作れるシンプル',
  '主菜（メイン）': 'ご飯が進むメインおかず',
  '副菜（サブ）': 'あと一品にぴったりな副菜',
  '汁物': '体が温まる汁物（スープ、みそ汁、鍋、ポトフ、シチューなど様々）',
};

// 汁物のタイプと適切な食材をセットで定義（料理として成立する組み合わせのみ）
const SOUP_WITH_INGREDIENTS = [
  // みそ汁：和風、豆腐・わかめ・油揚げなど
  { type: 'みそ汁', protein: '豆腐', veggie: 'わかめ', koji: '旨塩風こうじ調味料' },
  { type: 'みそ汁', protein: '油揚げ', veggie: '大根', koji: '旨塩風こうじ調味料' },
  { type: 'みそ汁', protein: '豆腐', veggie: 'なめこ', koji: '旨塩風こうじ調味料' },
  // ポトフ：澄んだスープ、ウインナー・野菜ゴロゴロ
  { type: 'ポトフ', protein: 'ウインナー', veggie: 'キャベツ', koji: 'コンソメ風こうじ調味料' },
  { type: 'ポトフ', protein: 'ウインナー', veggie: 'じゃがいも', koji: 'コンソメ風こうじ調味料' },
  { type: 'ポトフ', protein: 'ベーコン', veggie: 'にんじん', koji: 'コンソメ風こうじ調味料' },
  // シチュー：クリーミー、鶏肉・じゃがいも・ブロッコリー
  { type: 'シチュー', protein: '鶏肉', veggie: 'じゃがいも', koji: 'コンソメ風こうじ調味料' },
  { type: 'シチュー', protein: '鶏肉', veggie: 'ブロッコリー', koji: 'コンソメ風こうじ調味料' },
  // 鍋：豚バラ・鶏肉と白菜
  { type: '鍋', protein: '豚バラ', veggie: '白菜', koji: '中華風こうじ調味料' },
  { type: '鍋', protein: '鶏肉', veggie: '白菜', koji: '旨塩風こうじ調味料' },
  // コンソメスープ：軽いスープ、ベーコン・卵・野菜
  { type: 'スープ', protein: 'ベーコン', veggie: 'キャベツ', koji: 'コンソメ風こうじ調味料' },
  { type: 'スープ', protein: '卵', veggie: 'トマト', koji: '中華風こうじ調味料' },
  { type: 'スープ', protein: 'ベーコン', veggie: '玉ねぎ', koji: 'コンソメ風こうじ調味料' },
] as const;

function pickSoupWithIngredients(): { type: string; protein: string; veggie: string; koji: string } {
  const selected = SOUP_WITH_INGREDIENTS[Math.floor(Math.random() * SOUP_WITH_INGREDIENTS.length)];
  return { ...selected };
}

type CategoryRule = {
  mustIncludeAny?: RegExp[];
  mustIncludeAll?: RegExp[];
  mustNotInclude?: RegExp[];
  // タイトル（料理名）に必須の調理法/料理タイプ
  titleMustIncludeAny?: RegExp[];
};

type MenuIdeaJson = {
  kojiType: KojiType;
  title: string;
  summary: string; // 2〜3文
  keyIngredients: string[]; // 2〜5個（材料1つは1個）
  steps: string[]; // 3〜5個
  timeMinutes?: number; // 任意
  caloriesKcal?: number; // カロリー（kcal）
  saltG?: number; // 塩分（g）
};

// カテゴリごとに「タイトルに必ず含めるべき調理法/料理タイプ」
const TITLE_DISH_TYPE_PATTERNS: Record<string, RegExp[]> = {
  '汁物': [/スープ/, /汁/, /鍋/, /ポトフ/, /シチュー/, /みそ汁/],
  '主菜（メイン）': [/炒め/, /焼き/, /煮/, /揚げ/, /蒸し/, /丼/, /カレー/, /ハンバーグ/, /唐揚げ/, /つくね/, /麻婆/, /照り焼き/, /生姜焼き/],
  '副菜（サブ）': [/サラダ/, /和え/, /マリネ/, /漬け/, /ナムル/, /おひたし/, /ぺろり/],
  '5分で簡単レシピ': [/炒め/, /和え/, /焼き/, /サラダ/, /ナムル/, /漬け/],
  '材料1つでできる': [/炒め/, /和え/, /焼き/, /サラダ/, /ナムル/, /漬け/, /蒸し/],
};

function getCategoryRule(category: string): CategoryRule {
  const titlePatterns = TITLE_DISH_TYPE_PATTERNS[category] || [];
  switch (category) {
    case '5分で簡単レシピ':
      return {
        mustIncludeAll: [/5分/],
        titleMustIncludeAny: titlePatterns,
      };
    case '材料1つでできる':
      return {
        mustIncludeAny: [/材料1つ/, /だけ/],
        titleMustIncludeAny: titlePatterns,
      };
    case '主菜（メイン）':
      return {
        mustIncludeAny: [
          /ご飯/,
          /メイン/,
          /(鶏|豚|牛|ひき肉|魚|さば|サバ|ぶり|ブリ|鮭|たら|タラ|卵|豆腐|ツナ)/,
        ],
        titleMustIncludeAny: titlePatterns,
      };
    case '副菜（サブ）':
      return {
        mustIncludeAny: [/副菜/, /あと一品/, /サラダ/, /和え/, /マリネ/, /ぺろり/],
        titleMustIncludeAny: titlePatterns,
      };
    case '汁物':
      return {
        mustIncludeAny: [/スープ/, /汁/, /鍋/, /みそ汁/, /ポトフ/],
        titleMustIncludeAny: titlePatterns,
      };
    default:
      return {};
  }
}

// 麹の種類を示すパターン（タイトルに必須）
const KOJI_TYPE_PATTERNS = [/旨塩風こうじ/, /中華風こうじ/, /コンソメ風こうじ/];

function validateMenuIdea(category: string, menuIdea: string, kojiType?: string): boolean {
  const trimmed = (menuIdea ?? '').trim();
  if (!trimmed) return false;
  // 「チェック結果」「出力:」「引用符」「英語のメタ説明」などの混入を弾く
  // NOTE: ここは“中途半端/毎回同じ/AIの思考が混ざる”問題の最重要防波堤
  if (/^(出力|Output)\s*[:：]/i.test(trimmed)) return false;
  if (/[\"'`]/.test(trimmed)) return false;
  if (/(included\?|texture|aroma|richness|yes\s*\(|checklist|self[- ]?check)/i.test(trimmed)) return false;
  if (/(思考|プロセス|チェーン|推論|internal)/i.test(trimmed)) return false;
  if (/^[-*#]/.test(trimmed)) return false;
  if (/\b(or|and)\b/i.test(trimmed)) return false;
  // 1行、料理名。説明文 の形式
  if (!trimmed.includes('。')) return false;
  // 最後は「！」推奨（最低限の勢い）
  if (!trimmed.endsWith('！')) return false;

  const rule = getCategoryRule(category);

  // タイトル（料理名）部分を抽出
  const title = trimmed.split('。')[0] || '';
  const desc = trimmed.split('。').slice(1).join('。') || '';
  if (title.trim().length < 6) return false;
  // 「中途半端」対策: 説明文の最低文字数を担保（短すぎると「〜が！」のように途切れがち）
  if (desc.trim().length < 24) return false;
  // 余計な「。」が混ざっていない（normalizeOneLinerで潰れるが、念のため）
  if ((trimmed.match(/。/g) ?? []).length !== 1) return false;

  // 「材料1つでできる」はタイトルに複数食材が混ざりやすいので、タイトルのみ厳格にチェックする
  // 以前の /と[^ろ]/ は本文の「とても」等にも誤爆するため廃止し、タイトル内の「と（とろ除外）」のみ禁止にする
  if (category === '材料1つでできる') {
    if (/と(?!ろ)/.test(title)) return false;
    if (/、.+、/.test(title)) return false; // カンマ列挙も禁止
  }

  // タイトルに具体的な麹の種類が含まれているか検証（必須）
  const hasSpecificKoji = KOJI_TYPE_PATTERNS.some((r) => r.test(title));
  if (!hasSpecificKoji) return false;

  // タイトルに調理法/料理タイプが含まれているか検証
  if (rule.titleMustIncludeAny && rule.titleMustIncludeAny.length > 0) {
    if (!rule.titleMustIncludeAny.some((r) => r.test(title))) return false;
  }

  if (rule.mustIncludeAll) {
    for (const r of rule.mustIncludeAll) {
      if (!r.test(trimmed)) return false;
    }
  }
  if (rule.mustIncludeAny) {
    if (!rule.mustIncludeAny.some((r) => r.test(trimmed))) return false;
  }
  if (rule.mustNotInclude) {
    if (rule.mustNotInclude.some((r) => r.test(trimmed))) return false;
  }
  return true;
}

function normalizeMultilineText(s: string): string {
  return String(s ?? '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractJsonArray(text: string): string | null {
  const t = String(text ?? '').trim();
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start < 0 || end < 0 || end <= start) return null;
  return t.slice(start, end + 1);
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x.trim().length > 0;
}

function isKojiType(x: unknown): x is KojiType {
  return typeof x === 'string' && (KOJI_TYPES as readonly string[]).includes(x);
}

function validateMenuIdeaJson(
  category: Category,
  idea: any,
  required: { protein: string; veggie: string },
  kojiType: KojiType
): MenuIdeaJson | null {
  if (!idea || typeof idea !== 'object') return null;
  if (!isKojiType(idea.kojiType) || idea.kojiType !== kojiType) return null;

  const title = String(idea.title ?? '').trim();
  const summary = normalizeMultilineText(idea.summary ?? '');
  const keyIngredientsRaw = Array.isArray(idea.keyIngredients) ? idea.keyIngredients : [];
  const stepsRaw = Array.isArray(idea.steps) ? idea.steps : [];
  const timeMinutes = idea.timeMinutes;

  if (title.length < 6 || title.length > 40) return null;
  if (summary.length < 40 || summary.length > 260) return null;

  // 日本語前提。英語メタ文・出力:・引用符などは弾く（ユーザー表示に直結）
  const allText = `${title}\n${summary}\n${stepsRaw.join('\n')}`;
  if (/^(出力|Output)\s*[:：]/im.test(allText)) return null;
  if (/(included\?|checklist|self[- ]?check|texture|aroma|richness)/i.test(allText)) return null;
  if (/(思考|プロセス|チェーン|推論|internal)/i.test(allText)) return null;
  if (/\b(or|and)\b/i.test(allText)) return null;

  const keyIngredients = keyIngredientsRaw
    .map((x: any) => String(x ?? '').trim())
    .filter((s: string) => s.length > 0)
    .slice(0, 6);
  const steps = stepsRaw
    .map((x: any) => String(x ?? '').trim())
    .filter((s: string) => s.length > 0)
    .slice(0, 6);

  if (steps.length < 3) return null;
  if (category === '材料1つでできる') {
    if (required.veggie && !title.includes(required.veggie)) return null;
    if (/と(?!ろ)/.test(title)) return null;
    if (keyIngredients.length < 1) return null;
  } else {
    if (required.protein && !title.includes(required.protein)) return null;
    if (required.veggie && !title.includes(required.veggie)) return null;
    if (keyIngredients.length < 2) return null;
  }

  // 麹名（短縮）がタイトルに入ることを要求
  const kojiShort = String(kojiType).replace('こうじ調味料', '');
  if (!title.includes(kojiShort)) return null;

  // timeMinutes は任意。あるなら妥当な範囲のみ許可。
  let tm: number | undefined = undefined;
  if (typeof timeMinutes === 'number' && Number.isFinite(timeMinutes)) {
    if (timeMinutes >= 3 && timeMinutes <= 60) tm = Math.round(timeMinutes);
  }

  // caloriesKcal は任意。あるなら妥当な範囲のみ許可。
  let cal: number | undefined = undefined;
  if (typeof idea.caloriesKcal === 'number' && Number.isFinite(idea.caloriesKcal)) {
    if (idea.caloriesKcal >= 50 && idea.caloriesKcal <= 1500) cal = Math.round(idea.caloriesKcal);
  }

  // saltG は任意。あるなら妥当な範囲のみ許可。
  let salt: number | undefined = undefined;
  if (typeof idea.saltG === 'number' && Number.isFinite(idea.saltG)) {
    if (idea.saltG >= 0.1 && idea.saltG <= 10) salt = Math.round(idea.saltG * 10) / 10;
  }

  return {
    kojiType,
    title,
    summary,
    keyIngredients,
    steps,
    ...(tm !== undefined ? { timeMinutes: tm } : {}),
    ...(cal !== undefined ? { caloriesKcal: cal } : {}),
    ...(salt !== undefined ? { saltG: salt } : {}),
  };
}

function normalizeOneLiner(s: string): string {
  let t = (s ?? '').trim().replace(/\n/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();

  // 【クリーンアップ】AIが出力しがちな不要なプレフィックスを除去
  t = t
    .replace(/^(出力|Output)[：:]\s*/i, '')
    .replace(/^料理名[の:]?\s*/i, '')
    .replace(/^(決定|タイトル|メニュー)[：:]\s*/i, '')
    .replace(/^\*+\s*/g, '')
    .replace(/^#+\s*/g, '')
    .replace(/^[-–—]\s*/g, '')
    .replace(/^\d+\.\s*/g, '')
    .trim();

  // 「。」は1回だけにする（最初の1回以外は削る）
  const firstIdx = t.indexOf('。');
  if (firstIdx >= 0) {
    // タイトル末尾の不要記号を除去して「！。」を防ぐ
    const head = t
      .slice(0, firstIdx)
      .replace(/[！!。]+$/g, '')
      .replace(/\*+/g, '') // マークダウンの**を除去
      .trim();
    const tail = t.slice(firstIdx + 1).replace(/。/g, '').replace(/\*+/g, '').trim();
    t = `${head}。${tail}`;
  }

  // 末尾は「！」に統一
  t = t.replace(/[。！]*$/, '！');
  return t;
}

function cleanTitle(title: string): string {
  return String(title ?? '')
    .replace(/（.*?）/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[「」『』]/g, '')
    .trim();
}

function extractCandidateTitles(evidence: EvidenceItem[], max: number = 6): string[] {
  if (!Array.isArray(evidence)) return [];
  const titles: string[] = [];
  for (const e of evidence) {
    const t = cleanTitle(e.title || '');
    if (t && t.length >= 2 && t.length <= 24) titles.push(t);
    // titleがない/弱い場合はcontentから見出しっぽい料理名を拾う
    const c = String(e.content || '');
    const m1 = c.match(/###\s*\d+(?:-\d+)?\.\s*([^\n（\(\)]+)/);
    if (m1?.[1]) {
      const ct = cleanTitle(m1[1]);
      if (ct && ct.length >= 2 && ct.length <= 24) titles.push(ct);
    }
    // 「- **材料**:」の直前の小見出し（例: 「にんじんぺろり」）を拾う
    const m2 = c.match(/^\s*##+\s*\d+(?:-\d+)?\.\s*([^\n（\(\)]+)/m);
    if (m2?.[1]) {
      const ct = cleanTitle(m2[1]);
      if (ct && ct.length >= 2 && ct.length <= 24) titles.push(ct);
    }
  }
  return Array.from(new Set(titles)).slice(0, max);
}

// タイトルに調理法/料理タイプがない場合に追加するサフィックス
const TITLE_SUFFIX_BY_CATEGORY: Record<string, string> = {
  '汁物': 'スープ',
  '主菜（メイン）': '炒め',
  '副菜（サブ）': 'サラダ',
  '5分で簡単レシピ': '炒め',
  '材料1つでできる': '和え',
};

// 麹の種類の短縮名（タイトル用）
function getKojiShortName(kojiType: string): string {
  if (kojiType.includes('旨塩風')) return '旨塩風こうじ';
  if (kojiType.includes('中華風')) return '中華風こうじ';
  if (kojiType.includes('コンソメ風')) return 'コンソメ風こうじ';
  return 'こうじ';
}

function fixTitleDishType(category: string, title: string, kojiType?: string): string {
  const dishPatterns = TITLE_DISH_TYPE_PATTERNS[category] || [];
  let result = title;
  
  // 末尾に「の」「！」などがあれば除去
  result = result.replace(/[のの！!。]+$/g, '').trim();
  
  // 既に具体的な麹名（旨塩風こうじ/中華風こうじ/コンソメ風こうじ）が入っていればそのまま
  const hasFullKojiName = KOJI_TYPE_PATTERNS.some((r) => r.test(result));
  
  if (!hasFullKojiName && kojiType) {
    const kojiShortName = getKojiShortName(kojiType);
    
    // 「旨塩風」「中華風」「コンソメ風」だけで「こうじ」がない場合は「こうじ」を追加
    if (/旨塩風(?!こうじ)/.test(result)) {
      result = result.replace(/旨塩風/, '旨塩風こうじ');
    } else if (/中華風(?!こうじ)/.test(result)) {
      result = result.replace(/中華風/, '中華風こうじ');
    } else if (/コンソメ風(?!こうじ)/.test(result)) {
      result = result.replace(/コンソメ風/, 'コンソメ風こうじ');
    } else if (/旨塩(?!風)/.test(result)) {
      // 「旨塩」だけ（「旨塩風」ではない）場合は置換
      result = result.replace(/旨塩(?!風)/, '旨塩風こうじ');
    } else if (/中華(?!風)/.test(result)) {
      // 「中華」だけの場合は置換
      result = result.replace(/中華(?!風)/, '中華風こうじ');
    } else if (/コンソメ(?!風)/.test(result)) {
      // 「コンソメ」だけの場合は置換
      result = result.replace(/コンソメ(?!風)/, 'コンソメ風こうじ');
    } else if (/こうじ/.test(result) && !/旨塩|中華|コンソメ/.test(result)) {
      // 「こうじ」だけある場合は具体的な麹名に置換
      result = result.replace(/こうじ/, kojiShortName);
    } else if (!/旨塩|中華|コンソメ|こうじ/.test(result)) {
      // 麹関連の語がまったくない場合は追加
      // 調理法が入っている場合はその前に挿入
      if (dishPatterns.some((r) => r.test(result))) {
        // 調理法の前に麹名を挿入（例: 「〜炒め」→「〜の旨塩風こうじ炒め」）
        for (const p of dishPatterns) {
          const match = result.match(p);
          if (match) {
            const idx = result.lastIndexOf(match[0]);
            result = `${result.slice(0, idx)}${kojiShortName}${result.slice(idx)}`;
            break;
          }
        }
      } else {
        // 調理法がない場合は末尾に追加
        result = `${result}の${kojiShortName}`;
      }
    }
  }
  
  // 調理法が入っていなければ追加
  if (dishPatterns.length > 0 && !dishPatterns.some((r) => r.test(result))) {
    const suffix = TITLE_SUFFIX_BY_CATEGORY[category] || '';
    if (suffix) {
      result = `${result}${suffix}`;
    }
  }
  
  return result;
}

function enforceCategoryConstraints(
  category: string,
  menuIdea: string,
  kojiShort: string,
  kojiType: string,
  requiredIngredients?: { protein?: string; veggie?: string }
): string {
  let t = normalizeOneLiner(menuIdea);
  const requiredProtein = (requiredIngredients?.protein ?? '').trim();
  const requiredVeggie = (requiredIngredients?.veggie ?? '').trim();

  // タイトル（料理名）部分を抽出して調理法と麹名を補完
  let parts = t.split('。');
  let title = (parts[0] || '').trim() || 'こうじの簡単おかず';
  let desc = (parts[1] || '').trim() || `${kojiShort}のコクが決め手で、今日すぐ作りたくなる味！`;

  // タイトルに調理法/料理タイプと麹名がなければ補完
  title = fixTitleDishType(category, title, kojiType);
  t = normalizeOneLiner(`${title}。${desc}`);

  // 既にOKならそのまま
  if (validateMenuIdea(category, t, kojiType)) return t;

  // 不足している必須語を、説明文側に自然に追記して満たす（最後の砦）
  const ensure = (re: RegExp, suffix: string) => {
    if (!re.test(`${title}。${desc}`)) desc = `${desc}${suffix}`;
  };

  if (category === '5分で簡単レシピ') {
    ensure(/5分/, ' 5分で完成！');
  }
  if (category === '材料1つでできる') {
    ensure(/材料1つ|だけ/, ' 材料1つでOK！');
  }
  if (category === '汁物') {
    ensure(/スープ|汁|鍋|みそ汁|ポトフ|シチュー/, '');
  }
  if (category === '副菜（サブ）') {
    ensure(/副菜|あと一品|サラダ|和え|マリネ|ぺろり/, ' あと一品に！');
  }
  if (category === '主菜（メイン）') {
    ensure(/ご飯|メイン|(鶏|豚|牛|ひき肉|魚|さば|サバ|ぶり|ブリ|鮭|たら|タラ|卵|豆腐|ツナ)/, ' ご飯が進む！');
  }

  t = normalizeOneLiner(`${title}。${desc}`);

  // それでもNGなら、カテゴリに応じた安全な1行に差し替え
  const kojiName = getKojiShortName(kojiType);
  if (!validateMenuIdea(category, t, kojiType)) {
    const mainProtein = requiredProtein || '豚バラ';
    const mainVeggie = requiredVeggie || 'キャベツ';
    const safeByCategory: Record<string, string> = {
      '5分で簡単レシピ': `5分で完成！${mainProtein ? `${mainProtein}と${mainVeggie}` : mainVeggie}の${kojiName}炒め。${kojiShort}のコクがじゅわっと絡み、サッと作れて満足感たっぷり！`,
      '材料1つでできる': `${requiredVeggie || 'もやし'}だけの${kojiName}和え。${kojiShort}で味が決まり、材料1つでも箸が止まらない！`,
      '汁物': `${mainProtein ? `${mainProtein}と${mainVeggie}` : mainVeggie}の${kojiName}スープ。${kojiShort}で出汁いらず、ほっと温まる一杯！`,
      '副菜（サブ）': `${mainProtein ? `${mainProtein}と${mainVeggie}` : mainVeggie}の${kojiName}サラダ。${kojiShort}のコクで野菜がぐっとおいしく、あと一品に！`,
      '主菜（メイン）': `${mainProtein}と${mainVeggie}の${kojiName}炒め。${kojiShort}の香りとうま味で、ご飯が進む！`,
    };
    return normalizeOneLiner(safeByCategory[category] || t);
  }

  return t;
}

function formatEvidenceForPrompt(evidence: EvidenceItem[]): string {
  if (!Array.isArray(evidence) || evidence.length === 0) return '';
  const lines = evidence
    .slice(0, 6)
    .map((e) => {
      const head = `[${e.sourceType}:${e.sourceId}#${e.chunkIndex}${e.title ? ` ${e.title}` : ''}]`;
      return `- ${head} ${e.content}`;
    });
  return [
    '【参考（コーパス/投稿の抜粋）】',
    '以下の抜粋を参考にして、似た方向性のメニュー案を作ってください（そのままコピペはしない）。',
    ...lines,
  ].join('\n');
}

function pickKojiTypeForCategory(category: string): string {
  // 「麹の種類に合わせて考案」ではなく、カテゴリの相性で選ぶ（レシピの方向性が決まりやすい）
  if (category === '汁物') return 'コンソメ風こうじ調味料';
  if (category === '副菜（サブ）') return '旨塩風こうじ調味料';
  if (category === '主菜（メイン）') return '中華風こうじ調味料';
  if (category === '材料1つでできる') {
    // 迷いが出やすいのでランダムにして飽きにくく
    return KOJI_TYPES[Math.floor(Math.random() * KOJI_TYPES.length)];
  }
  // 5分は中華/旨塩が相性良いことが多いので、その中でランダム
  if (category === '5分で簡単レシピ') {
    const pool = ['中華風こうじ調味料', '旨塩風こうじ調味料'];
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return KOJI_TYPES[Math.floor(Math.random() * KOJI_TYPES.length)];
}

function buildCategoryQuery(category: string): string {
  switch (category) {
    case '5分で簡単レシピ':
      return '5分 5分で 簡単 時短 レンチン サッと 炒め 和える';
    case '材料1つでできる':
      return '材料1つ 1つだけ だけ 単品 もやし にんじん キャベツ ブロッコリー 豆腐 卵';
    case '主菜（メイン）':
      return '主菜 メイン 肉 鶏 豚 ひき肉 ご飯 進む';
    case '副菜（サブ）':
      return '副菜 あと一品 サラダ 和える 漬ける やみつき マリネ ぺろり';
    case '汁物':
      return '汁物 スープ 鍋 みそ汁 ポトフ';
    default:
      return '簡単 おいしい';
  }
}

async function generateMenuIdea(
  category: string, 
  exclusionHint?: string, 
  assignedIngredients?: { protein: string; veggie: string },
  specifiedKojiType?: string // 麹タイプを指定（指定がなければ従来通りカテゴリに応じて決定）
): Promise<{ menuIdea: string; kojiType: string }> {
  let categoryDesc = categoryPrompts[category] || '';

  // 汁物の場合、食材をセットで選ぶ（汁物の種類はAIが食材から判断）
  let kojiType: string;
  let soupIngredients: { protein: string; veggie: string } | undefined;
  
  if (specifiedKojiType) {
    // 麹タイプが指定されている場合はそれを使用
    kojiType = specifiedKojiType;
    if (category === '汁物') {
      // 汁物の場合、指定された麹に合う食材を選ぶ
      // 3案の「食材が被らない」要件のため、assignedIngredients があればそれを優先する
      if (assignedIngredients?.protein && assignedIngredients?.veggie) {
        soupIngredients = { protein: assignedIngredients.protein, veggie: assignedIngredients.veggie };
      } else {
        const matchingSoups = SOUP_WITH_INGREDIENTS.filter(s => s.koji === specifiedKojiType);
        const soupSet = matchingSoups.length > 0 
          ? matchingSoups[Math.floor(Math.random() * matchingSoups.length)]
          : SOUP_WITH_INGREDIENTS[Math.floor(Math.random() * SOUP_WITH_INGREDIENTS.length)];
        soupIngredients = { protein: soupSet.protein, veggie: soupSet.veggie };
      }
      categoryDesc = `体が温まる汁物`;
    }
  } else if (category === '汁物') {
    // 汁物の食材をセットで選択（汁物の種類はAIが食材を見て判断）
    const soupSet = pickSoupWithIngredients();
    kojiType = soupSet.koji;
    soupIngredients = { protein: soupSet.protein, veggie: soupSet.veggie };
    categoryDesc = `体が温まる汁物`;
  } else {
    kojiType = pickKojiTypeForCategory(category);
  }
  const kojiShort = kojiType.replace('こうじ調味料', '');

  // RAG: コーパス（md）や投稿から近い例を引く
  let evidenceBlock = '';
  let candidateTitles: string[] = [];
  try {
    // コーパス側は旧表記も含まれるので両方混ぜて検索
    const kojiQueryVariants = [
      kojiType,
      kojiType.replace('風こうじ調味料', 'こうじ'),
      kojiType.replace('旨塩風こうじ調味料', 'たまねぎこうじ')
        .replace('中華風こうじ調味料', '中華こうじ')
        .replace('コンソメ風こうじ調味料', 'コンソメこうじ'),
    ]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' ');

    const query = `${kojiQueryVariants} ${buildCategoryQuery(category)} ${categoryDesc} ${category}`;
    const evidence = await searchEvidence({ query, topK: 10, sourceTypes: ['corpus', 'post'] });

    // カテゴリに合う抜粋を優先（ズレた抜粋でAIが迷走するのを防ぐ）
    const categoryFilter: Record<string, RegExp> = {
      '5分で簡単レシピ': /(5分|時短|レンチン|サッと|炒め|和え)/,
      '材料1つでできる': /(だけ|1つ|材料|もやし|にんじん|キャベツ|豆腐|卵)/,
      '主菜（メイン）': /(鶏|豚|牛|ひき肉|魚|さば|サバ|ぶり|ブリ|鮭|たら|タラ|唐揚げ|ハンバーグ|つくね)/,
      '副菜（サブ）': /(サラダ|和え|マリネ|ぺろり|ドレッシング|ブロッコリー|にんじん)/,
      '汁物': /(スープ|鍋|汁|みそ汁|ポトフ|シチュー)/,
    };
    const f = categoryFilter[category];
    const filtered = f ? evidence.filter((e) => f.test(e.content) || (e.title ? f.test(e.title) : false)) : evidence;
    const picked = filtered.length > 0 ? filtered : evidence;
    evidenceBlock = formatEvidenceForPrompt(picked);
    candidateTitles = extractCandidateTitles(picked, 6);
  } catch {
    evidenceBlock = '';
    candidateTitles = [];
  }

  // カテゴリごとの「タイトルに必須の調理法/料理タイプ」のヒント
  const titleHintByCategory: Record<string, string> = {
    '汁物': '料理名は「〜スープ」「〜みそ汁」「〜鍋」「〜ポトフ」「〜シチュー」など多様な汁物から選び、毎回違う種類の汁物にする',
    '主菜（メイン）': '料理名は必ず「〜炒め」「〜焼き」「〜煮」「〜揚げ」など調理法を含める（例: 豚バラのこうじ炒め）',
    '副菜（サブ）': '料理名は必ず「〜サラダ」「〜和え」「〜マリネ」「〜ナムル」など副菜だとわかる名前にする',
    '5分で簡単レシピ': '料理名は必ず「〜炒め」「〜和え」「〜焼き」など調理法を含める',
    '材料1つでできる': '【超重要】料理名はメイン食材1つだけ！「もやしの〜」「キャベツの〜」「にんじんの〜」のように、「と」で繋がない。悪い例: 鶏肉とブロッコリー',
  };

  const requiredHints: string[] = [];
  // タイトルに調理法を含めるヒントを最優先で追加
  if (titleHintByCategory[category]) {
    requiredHints.push(titleHintByCategory[category]);
  }
  if (category === '5分で簡単レシピ') requiredHints.push('説明文に必ず「5分」を入れる');
  if (category === '材料1つでできる') requiredHints.push('説明文に必ず「材料1つ」または「だけ」を入れる');
  if (category === '汁物') requiredHints.push('（タイトルで汁物だと分かればOK）');
  if (category === '副菜（サブ）') requiredHints.push('（タイトルで副菜だと分かればOK）');
  if (category === '主菜（メイン）') requiredHints.push('説明文に「ご飯が進む」等を入れるとベター');

  const candidateBlock =
    candidateTitles.length > 0
      ? `【候補（コーパス由来）】\n${candidateTitles.map((t) => `- ${t}`).join('\n')}\n※上の候補から必ず1つ選び、その方向性をベースに書く`
      : '【候補（コーパス由来）】（候補なし。参考抜粋から方向性を推測して）';

  // 除外ヒントがあれば追加
  const exclusionBlock = exclusionHint
    ? `\n${exclusionHint}\n`
    : '';

  // 美味しい組み合わせを優先（ランダムではなく、実証済みのペアリング）
  const TASTY_COMBOS: Record<string, Array<{ protein: string; veggie: string; style?: string }>> = {
    '5分で簡単レシピ': [
      { protein: '豚こま', veggie: 'キャベツ' },
      { protein: '卵', veggie: 'もやし' },
      { protein: 'ベーコン', veggie: 'ほうれん草' },
      { protein: '豆腐', veggie: 'ニラ' },
      { protein: 'ツナ', veggie: 'きゅうり' },
    ],
    '材料1つでできる': [
      { protein: '', veggie: 'もやし' },
      { protein: '', veggie: 'キャベツ' },
      { protein: '', veggie: 'にんじん' },
      { protein: '', veggie: 'ブロッコリー' },
      { protein: '', veggie: 'なす' },
    ],
    '主菜（メイン）': [
      { protein: '鶏もも肉', veggie: 'ピーマン' },
      { protein: '豚バラ', veggie: '白菜' },
      { protein: '鮭', veggie: 'きのこ' },
      { protein: 'ひき肉', veggie: '玉ねぎ' },
      { protein: 'えび', veggie: 'ブロッコリー' },
    ],
    '副菜（サブ）': [
      { protein: '', veggie: 'ブロッコリー' },
      { protein: 'ツナ', veggie: 'キャベツ' },
      { protein: '', veggie: 'にんじん' },
      { protein: '', veggie: '小松菜' },
      { protein: 'ベーコン', veggie: 'ほうれん草' },
    ],
    '汁物': [
      { protein: '鶏肉', veggie: '白菜' },
      { protein: '豚バラ', veggie: '大根' },
      { protein: 'ウインナー', veggie: 'キャベツ' },
      { protein: '豆腐', veggie: 'わかめ' },
      { protein: 'ベーコン', veggie: 'じゃがいも' },
    ],
  };
  
  // 汁物の場合はsoupIngredientsを優先（汁物タイプと食材の整合性を保つ）
  let randomProtein: string;
  let randomVeggie: string;
  
  if (category === '汁物' && soupIngredients) {
    randomProtein = soupIngredients.protein;
    randomVeggie = soupIngredients.veggie;
  } else {
    const combosForCategory = TASTY_COMBOS[category] || TASTY_COMBOS['主菜（メイン）'];
    const selectedCombo = combosForCategory[Math.floor(Math.random() * combosForCategory.length)];
    randomProtein = assignedIngredients?.protein || selectedCombo.protein;
    randomVeggie = assignedIngredients?.veggie || selectedCombo.veggie;
  }

  // 汁物の場合、料理知識を追加
  const soupKnowledge = category === '汁物' ? `
【プロの家政婦の料理知識：汁物の正しい組み合わせ】
食材と汁物の種類は必ず以下のルールに従うこと：
- ポトフ → ウインナー、ベーコン、キャベツ、じゃがいも、にんじん（澄んだ洋風スープ）
- シチュー → 鶏肉、じゃがいも、にんじん、ブロッコリー（クリーミーで濃厚）
- みそ汁 → 豆腐、わかめ、油揚げ、大根、なめこ（和風）
- 鍋 → 豚バラ、鶏肉、白菜（鍋料理）
- コンソメスープ → ベーコン、卵、トマト、玉ねぎ、キャベツ（軽い洋風スープ）

【絶対禁止】
- 「豆腐のポトフ」「わかめのシチュー」← 料理として成立しない
- 「ウインナーのみそ汁」「キャベツのシチュー」← 不自然

【今回の指定】
食材: ${randomProtein}${randomVeggie ? 'と' + randomVeggie : ''}
→ この食材に最も合う汁物の種類を選んで提案すること
` : '';

  const promptBase = `あなたは「志麻さん」のようなプロの家政婦です。
GOCHISOKOJIのこうじ調味料を使って、家庭で簡単に作れる美味しいメニューを提案します。
料理のプロとして、食材の組み合わせは絶対に間違えません。
${exclusionBlock}
【カテゴリ】${categoryDesc}
【使用する調味料】${kojiType}
${soupKnowledge}
【必須食材（絶対に変更不可）】
${category === '材料1つでできる' 
  ? `この食材だけを使うこと: ${randomVeggie}`
  : `この食材を必ず使うこと: ${randomProtein ? `${randomProtein}と${randomVeggie}` : randomVeggie}`}

【重要】上記の食材は変更禁止です。他の食材に置き換えないでください。

${evidenceBlock || ''}

${candidateBlock}

【カテゴリの条件】
${requiredHints.length > 0 ? requiredHints.map((s) => `- ${s}`).join('\n') : '- （特になし）'}

【出力形式】
1行のみ。「料理名。説明文」の形式。
余計な前置き（例: 「出力:」「チェック結果」「英語」「引用符」）は一切書かない。

【料理名のルール（厳守）】
- 「${kojiShort}」を必ず含める
- 何料理かわかる名前にする（〜炒め、〜スープ、〜サラダ等）
${category === '材料1つでできる'
  ? `- 必ず「${randomVeggie}」を料理名に含める
- 例: 「${randomVeggie}の${kojiShort}和え」「${randomVeggie}の${kojiShort}ナムル」`
  : randomProtein 
    ? `- 必ず「${randomProtein}」と「${randomVeggie}」を料理名に含める
- 例: 「${randomProtein}と${randomVeggie}の${kojiShort}炒め」`
    : `- 必ず「${randomVeggie}」を料理名に含める
- 例: 「${randomVeggie}の${kojiShort}サラダ」「${randomVeggie}の${kojiShort}和え」`}

【絶対禁止】指定食材以外の食材を料理名に使わないこと

【説明文】50〜80文字。食感・香り・コクを伝える。最後は「！」
出力:`;

  // 要件: 必ずGemini（gemini-3-flash-preview）で考案させる。テンプレの手動フォールバックはしない。
  // 形式/カテゴリ条件を満たさない場合は自動リトライし、最後まで満たせなければ（選定済み食材を使った）安全な1行へ補正する。
  const attempts: Array<{ temperature: number; extra: string }> = [
    { temperature: 0.85, extra: '' },
    {
      temperature: 0.55,
      extra:
        '\n【追加の絶対条件】\n- 指定食材（必須食材）を料理名に必ず含める\n- 料理名は必ず完結させる（途中で終わらせない）\n- 出力は1行のみ\n',
    },
    {
      temperature: 0.35,
      extra:
        '\n【不合格条件】\n- 「料理名。説明文」の形式でない\n- 末尾が「！」でない\n- カテゴリ条件（5分/材料1つ 等）を満たさない\n上記を1つでも満たさない場合は、修正してから出力する。\n',
    },
    {
      temperature: 0.25,
      extra:
        '\n【最終確認】\n出力前に自分でチェックし、条件を満たすまで書き直す。\n',
    },
  ];

  let menuIdea = '';
  for (const a of attempts) {
    const raw = await generateText(`${promptBase}${a.extra}`, {
      model: 'gemini-3-flash-preview',
      temperature: a.temperature,
      maxOutputTokens: 700,
    });
    menuIdea = normalizeOneLiner(raw.trim().replace(/\n/g, ' ').slice(0, 320));
    // 出力を正規化/補正して、カテゴリ要件（タイトルの料理タイプ/麹名/材料1つ等）を満たすようにする
    menuIdea = enforceCategoryConstraints(category, menuIdea, kojiShort, kojiType, {
      protein: randomProtein,
      veggie: randomVeggie,
    });
    if (validateMenuIdea(category, menuIdea, kojiType)) {
      break;
    }
  }

  if (!validateMenuIdea(category, menuIdea, kojiType)) {
    throw new Error(`Menu idea validation failed for category="${category}" koji="${kojiType}"`);
  }

  // 文字の重複・異常なパターンを修正
  menuIdea = menuIdea
    .replace(/ポトポトフ/g, 'ポトフ')
    .replace(/ポポトフ/g, 'ポトフ')
    .replace(/シシチュー/g, 'シチュー')
    .replace(/ススープ/g, 'スープ')
    .replace(/みそみそ汁/g, 'みそ汁')
    .replace(/みみみそ汁/g, 'みそ汁')
    .replace(/鍋鍋/g, '鍋')
    .replace(/とろとみそ/g, 'みそ')
    .replace(/とろみ旨/g, '')
    .replace(/とろみ生/g, '')
    .replace(/コクうまみそ/g, '')
    .replace(/クリームシ(?=シチュー)/g, 'クリーム')
    .replace(/食べるスープ/g, 'スープ')
    .replace(/うま塩鍋/g, '鍋')
    .replace(/とろとろ鍋/g, '鍋')
    .replace(/炒炒め/g, '炒め')
    .replace(/こうこう/g, 'こうじ')
    .replace(/マリサラダ/g, 'サラダ')
    .replace(/焼焼き/g, '焼き')
    .replace(/煮煮/g, '煮')
    .replace(/揚揚げ/g, '揚げ')
    .replace(/旨の旨塩風/g, '旨塩風')
    .replace(/思考プロセス[：:].*/g, '')
    .replace(/^[0-9]+\.\s*/g, '')
    .replace(/^まず[、,].*/g, '')
    .replace(/^指定された.*/g, '')
    .replace(/^食材[「「].*/g, '')
    .replace(/韓国風コンソメ風/g, 'コンソメ風')
    .replace(/エスニックコンソメ風/g, 'コンソメ風')
    .replace(/エスニック中華風/g, '中華風')
    .replace(/韓国風中華風/g, '中華風')
    .replace(/和風旨塩風/g, '旨塩風')
    .replace(/エスニック旨塩風/g, '旨塩風')
    .replace(/韓国風旨塩風/g, '旨塩風')
    .replace(/コンの/g, '')
    .replace(/こうこう/g, 'こうじ')
    .replace(/風風/g, '風')
    .replace(/のの/g, 'の')
    .replace(/香る香る/g, '香る')
    .replace(/ベー(?![コカキクケ])/g, 'ベーコンの')
    .replace(/ナム(?!ル)/g, 'ナムル')
    .replace(/サラサラダ/g, 'サラダ')
    .replace(/ナムサラダ/g, 'ナムル')
    .replace(/コクうま/g, '');

  return { menuIdea, kojiType };
}

// カテゴリ×麹ごとの食材プール（毎回ランダムに選ぶ。3案は必ず旨塩/中華/コンソメ）
type MenuCombo = { protein: string; veggie: string };
// NOTE: Category はファイル先頭で定義済み（重複回避）

const INGREDIENT_POOL: Record<Category, Record<KojiType, MenuCombo[]>> = {
  '5分で簡単レシピ': {
    '旨塩風こうじ調味料': [
      { protein: '卵', veggie: 'もやし' },
      { protein: 'ツナ', veggie: 'きゅうり' },
      { protein: '豆腐', veggie: 'ニラ' },
      { protein: '鶏ささみ', veggie: 'レタス' },
      { protein: 'しらす', veggie: '大葉' },
    ],
    '中華風こうじ調味料': [
      { protein: '豚こま', veggie: 'キャベツ' },
      { protein: 'ひき肉', veggie: 'ニラ' },
      { protein: 'えび', veggie: 'もやし' },
      { protein: '鶏もも肉', veggie: 'ピーマン' },
      { protein: '豚バラ', veggie: '白菜' },
    ],
    'コンソメ風こうじ調味料': [
      { protein: 'ベーコン', veggie: 'ほうれん草' },
      { protein: 'ウインナー', veggie: 'キャベツ' },
      { protein: '鶏もも肉', veggie: 'ブロッコリー' },
      { protein: '鮭', veggie: 'きのこ' },
      { protein: 'ベーコン', veggie: '玉ねぎ' },
    ],
  },
  '材料1つでできる': {
    // 材料1つカテゴリは「メイン材料1つ」だけ（調味料はOK）。proteinは空に統一。
    '旨塩風こうじ調味料': [
      { protein: '', veggie: 'にんじん' },
      { protein: '', veggie: '大根' },
      { protein: '', veggie: 'きゅうり' },
      { protein: '', veggie: '小松菜' },
      { protein: '', veggie: 'れんこん' },
      { protein: '', veggie: 'トマト' },
    ],
    '中華風こうじ調味料': [
      { protein: '', veggie: 'もやし' },
      { protein: '', veggie: 'ニラ' },
      { protein: '', veggie: 'きくらげ' },
      { protein: '', veggie: 'なす' },
      { protein: '', veggie: '白菜' },
      { protein: '', veggie: 'チンゲン菜' },
    ],
    'コンソメ風こうじ調味料': [
      { protein: '', veggie: 'ブロッコリー' },
      { protein: '', veggie: 'じゃがいも' },
      { protein: '', veggie: '玉ねぎ' },
      { protein: '', veggie: 'かぼちゃ' },
      { protein: '', veggie: 'アスパラ' },
      { protein: '', veggie: 'きのこ' },
    ],
  },
  '主菜（メイン）': {
    '旨塩風こうじ調味料': [
      { protein: '豚バラ', veggie: '白菜' },
      { protein: '鶏もも肉', veggie: '長ねぎ' },
      { protein: '鮭', veggie: 'キャベツ' },
      { protein: 'ぶり', veggie: '大根' },
      { protein: '豚こま', veggie: '玉ねぎ' },
    ],
    '中華風こうじ調味料': [
      { protein: 'ひき肉', veggie: 'なす' },
      { protein: '豚こま', veggie: 'ピーマン' },
      { protein: 'えび', veggie: 'ブロッコリー' },
      { protein: '鶏もも肉', veggie: 'チンゲン菜' },
      { protein: '豚バラ', veggie: 'もやし' },
    ],
    'コンソメ風こうじ調味料': [
      { protein: '鶏もも肉', veggie: 'じゃがいも' },
      { protein: '鮭', veggie: 'きのこ' },
      { protein: 'ベーコン', veggie: 'キャベツ' },
      { protein: '豚ロース', veggie: '玉ねぎ' },
      { protein: 'ウインナー', veggie: 'にんじん' },
    ],
  },
  '副菜（サブ）': {
    '旨塩風こうじ調味料': [
      { protein: 'ツナ', veggie: 'キャベツ' },
      { protein: '', veggie: 'きゅうり' },
      { protein: '', veggie: 'ほうれん草' },
      { protein: '', veggie: '小松菜' },
      { protein: '', veggie: 'トマト' },
    ],
    '中華風こうじ調味料': [
      { protein: '', veggie: 'もやし' },
      { protein: '', veggie: 'きゅうり' },
      { protein: '', veggie: 'ニラ' },
      { protein: '', veggie: 'チンゲン菜' },
      { protein: '', veggie: 'きくらげ' },
    ],
    'コンソメ風こうじ調味料': [
      { protein: '', veggie: 'ブロッコリー' },
      { protein: 'ベーコン', veggie: 'ほうれん草' },
      { protein: '', veggie: 'じゃがいも' },
      { protein: '', veggie: 'にんじん' },
      { protein: '', veggie: 'アスパラ' },
    ],
  },
  '汁物': {
    '旨塩風こうじ調味料': SOUP_WITH_INGREDIENTS.filter((s) => s.koji === '旨塩風こうじ調味料').map((s) => ({ protein: s.protein, veggie: s.veggie })),
    '中華風こうじ調味料': SOUP_WITH_INGREDIENTS.filter((s) => s.koji === '中華風こうじ調味料').map((s) => ({ protein: s.protein, veggie: s.veggie })),
    'コンソメ風こうじ調味料': SOUP_WITH_INGREDIENTS.filter((s) => s.koji === 'コンソメ風こうじ調味料').map((s) => ({ protein: s.protein, veggie: s.veggie })),
  },
};

function comboKey(c: MenuCombo): string {
  return `${c.protein || ''}|${c.veggie || ''}`.trim();
}

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickUniqueCombosForCategory(category: Category): Record<KojiType, MenuCombo> {
  const used = new Set<string>();
  const out = {} as Record<KojiType, MenuCombo>;
  for (const koji of KOJI_TYPES) {
    const pool = INGREDIENT_POOL[category]?.[koji] ?? [];
    if (!pool.length) {
      throw new Error(`No ingredient pool for category="${category}" koji="${koji}"`);
    }
    // 衝突を避けて最大10回リトライ
    let picked: MenuCombo | null = null;
    for (let i = 0; i < 10; i++) {
      const cand = pickOne(pool);
      const k = comboKey(cand);
      if (!used.has(k)) {
        picked = cand;
        used.add(k);
        break;
      }
    }
    // それでもダメなら最初の未使用を探す
    if (!picked) {
      const fallback = pool.find((c) => !used.has(comboKey(c)));
      picked = fallback ?? pickOne(pool);
      used.add(comboKey(picked));
    }
    out[koji] = picked;
  }
  return out;
}

function buildFallbackIdeaJson(category: Category, kojiType: KojiType, assigned: MenuCombo): MenuIdeaJson {
  const kojiShort = String(kojiType).replace('こうじ調味料', '');
  const p = (assigned.protein ?? '').trim();
  const v = (assigned.veggie ?? '').trim();
  
  // 麹タイプごとの調理法を取得（3案が被らない）
  const dishType = getDishTypeForKoji(category, kojiType);

  if (category === '材料1つでできる') {
    const veg = v || 'もやし';
    // 材料1つでも麹タイプで調理法を変える
    const dishForSingle = kojiType === '旨塩風こうじ調味料' ? '和え' 
      : kojiType === '中華風こうじ調味料' ? 'ナムル' 
      : 'マリネ';
    
    // 材料に応じた栄養情報の推定値
    const vegCalories: Record<string, number> = {
      'もやし': 40, 'きゅうり': 35, 'キャベツ': 55, 'ほうれん草': 50,
      'ブロッコリー': 70, 'なす': 45, 'ピーマン': 50, 'トマト': 45,
      'れんこん': 90, 'きくらげ': 35, 'きのこ': 40, 'しめじ': 45,
      'えのき': 40, 'まいたけ': 35, 'エリンギ': 50, '大根': 40,
      'にんじん': 60, '玉ねぎ': 65, 'ごぼう': 100, 'アスパラ': 55,
    };
    const baseCalories = vegCalories[veg] || 60;
    // 調理法で若干変動（麹調味料分+30〜50kcal）
    const calAdjust = dishForSingle === '和え' ? 30 : dishForSingle === 'ナムル' ? 45 : 35;
    
    return {
      kojiType,
      title: `${veg}の${kojiShort}${dishForSingle}`,
      summary: `材料は${veg}だけ。${kojiShort}のうま味で味が決まり、あと一品でも満足感が出ます。\n食感を残すのがコツで、忙しい日にも作りやすいです。`,
      keyIngredients: [veg, kojiShort],
      steps: [
        `${veg}はさっと下処理して水気を切る`,
        `${kojiShort}を絡めて味をなじませる`,
        `好みでごまやこしょうを足して完成`,
      ],
      timeMinutes: dishForSingle === 'マリネ' ? 10 : 7,
      caloriesKcal: baseCalories + calAdjust,
      saltG: dishForSingle === 'ナムル' ? 1.0 : dishForSingle === 'マリネ' ? 0.7 : 0.9,
    };
  }

  const ing1 = p ? `${p}と${v}` : v;
  const timeMinutes = category === '5分で簡単レシピ' ? 5 : category === '汁物' ? 15 : 12;
  
  // 調理法に応じたsummaryとstepsを生成
  const summaryByDish: Record<string, string> = {
    '和え': `${kojiShort}のやさしい味わいで、素材の甘みが引き立ちます。\nさっと和えるだけで、あっさり美味しい一品に。`,
    'ナムル': `${kojiShort}のコクでごま油香る本格派。\nシャキシャキ食感を残すのがポイントです。`,
    'サラダ': `${kojiShort}がドレッシング代わりに。\n野菜の甘みを引き出す、さっぱりヘルシーな一皿。`,
    'マリネ': `${kojiShort}の酸味と旨味でさっぱり仕上げ。\n作り置きにもぴったりです。`,
    '炒め': `${kojiShort}のコクで、素材の甘みとうま味が引き立つ一皿。\n火入れは手早く、食感を残すと飽きずに食べられます。`,
    'スープ': `${kojiShort}で出汁いらず、素材の旨味がじんわり溶け出す。\nほっと温まる優しい味わいです。`,
    'みそ汁': `${kojiShort}を加えることで、いつものみそ汁がワンランクアップ。\n旨味が増して、ほっとする味に。`,
    '鍋': `${kojiShort}がベースの旨味たっぷり鍋。\n野菜もお肉もたっぷり食べられます。`,
  };
  
  const stepsByDish: Record<string, string[]> = {
    '和え': [
      `${p ? `${p}と` : ''}${v}は食べやすく切る`,
      `さっと茹でるか電子レンジで加熱`,
      `${kojiShort}を絡めて和える`,
    ],
    'ナムル': [
      `${v}はさっと茹でて水気を切る`,
      `${kojiShort}とごま油を混ぜる`,
      `野菜と調味料を和えて完成`,
    ],
    'サラダ': [
      `${p ? `${p}と` : ''}${v}を食べやすく切る`,
      `${kojiShort}とオリーブオイルでドレッシングを作る`,
      `野菜に回しかけて完成`,
    ],
    'マリネ': [
      `${p ? `${p}と` : ''}${v}を薄切りにする`,
      `${kojiShort}と酢を混ぜてマリネ液を作る`,
      `30分ほど漬け込んで完成`,
    ],
    '炒め': [
      `${p ? `${p}と` : ''}${v}は食べやすく切る`,
      `フライパンで手早く火を通す`,
      `${kojiShort}で味をまとめて仕上げる`,
    ],
    'スープ': [
      `${p ? `${p}と` : ''}${v}を食べやすく切る`,
      `鍋に水と材料を入れて煮る`,
      `${kojiShort}で味を調えて完成`,
    ],
    'みそ汁': [
      `${v}を食べやすく切る`,
      `だし汁で具材を煮る`,
      `味噌と${kojiShort}を溶き入れて完成`,
    ],
    '鍋': [
      `${p ? `${p}と` : ''}${v}を食べやすく切る`,
      `鍋に水と${kojiShort}を入れてスープを作る`,
      `具材を入れて煮込む`,
    ],
  };

  // カロリー・塩分の推定値（調理法とタンパク質の有無で変動）
  const proteinCalories: Record<string, number> = {
    '鶏むね肉': 110, '鶏もも肉': 200, '豚バラ': 390, '豚こま': 220,
    '牛肉': 250, 'ひき肉': 220, 'ツナ': 70, '豆腐': 55, '卵': 75,
    'エビ': 80, 'イカ': 85, 'さば': 200, '鮭': 130,
  };
  const proteinCal = p ? (proteinCalories[p] || 150) : 0;
  
  const baseCalByDish: Record<string, number> = {
    '和え': 60, 'ナムル': 50, 'サラダ': 70, 'マリネ': 60,
    '炒め': 100, 'スープ': 80, 'みそ汁': 40, '鍋': 120,
  };
  const saltByDish: Record<string, number> = {
    '和え': 1.1, 'ナムル': 1.0, 'サラダ': 0.8, 'マリネ': 0.9,
    '炒め': 1.8, 'スープ': 1.5, 'みそ汁': 1.6, '鍋': 2.0,
  };
  
  // ランダムに±15%程度変動を加える（同じ調理法でも異なる値に）
  const variation = 0.85 + Math.random() * 0.3; // 0.85〜1.15
  const finalCalories = Math.round((proteinCal + (baseCalByDish[dishType] || 80)) * variation);
  const finalSalt = Math.round((saltByDish[dishType] || 1.5) * variation * 10) / 10;

  return {
    kojiType,
    title: `${ing1}の${kojiShort}${dishType}`,
    summary: summaryByDish[dishType] || summaryByDish['炒め'],
    keyIngredients: [p, v, kojiShort].filter(Boolean),
    steps: stepsByDish[dishType] || stepsByDish['炒め'],
    timeMinutes,
    caloriesKcal: finalCalories,
    saltG: finalSalt,
  };
}

async function generateThreeMenuIdeasForCategory(
  category: Category
): Promise<{ menuIdeas: MenuIdeaJson[] }> {
  const selected = pickUniqueCombosForCategory(category);

  const categoryDesc = categoryPrompts[category] || '';
  const items = KOJI_TYPES.map((kojiType) => ({
    kojiType,
    assigned: selected[kojiType],
  }));

  // RAGはカテゴリごとに1回だけ（遅延を抑える）
  let evidenceBlock = '';
  try {
    const ingredientWords = items
      .flatMap((x) => [x.assigned.protein, x.assigned.veggie])
      .filter(Boolean)
      .join(' ');
    const query = `${category} ${categoryDesc} ${ingredientWords} こうじ調味料`;
    const evidence = await searchEvidence({ query, topK: 6, sourceTypes: ['corpus', 'post'] });
    evidenceBlock = formatEvidenceForPrompt(evidence);
  } catch {
    evidenceBlock = '';
  }

  const schemaHint = `[
  {
    "kojiType": "旨塩風こうじ調味料",
    "title": "料理名（日本語）",
    "summary": "要約（2〜3文、改行OK。自然な日本語）",
    "keyIngredients": ["主要材料", "こうじ"],
    "steps": ["手順1", "手順2", "手順3"],
    "timeMinutes": 5,
    "caloriesKcal": 250,
    "saltG": 1.5
  }
]`;

  const prompt = `あなたは日本の家庭料理に強いプロの料理家です。
GOCHISOKOJIのこうじ調味料を使って、ユーザーが作りたくなるメニュー案を3件提案します。

【重要】出力はJSON配列のみ。説明文・前置き・見出し・コードフェンスは禁止。
英語は禁止（JSONのキー以外は日本語）。引用符はJSONのダブルクォート以外使わない。

【カテゴリ】${category}（${categoryDesc}）
${evidenceBlock ? `\n${evidenceBlock}\n` : ''}

【重要：3案の調理法は必ず分ける】
- 旨塩風こうじ → 和え物・ナムル・マリネ（あっさり系）
- 中華風こうじ → 炒め物・あんかけ（濃厚系）
- コンソメ風こうじ → スープ・煮込み・サラダ（洋風系）

【3件の指定】（それぞれ必須食材・調理法は変更不可）
${items
  .map((x, idx) => {
    const p = x.assigned.protein;
    const v = x.assigned.veggie;
    const dishType = getDishTypeForKoji(category as Category, x.kojiType);
    const must =
      category === '材料1つでできる'
        ? `必須食材: ${v}（これだけ。料理名に必ず含め、タイトルで「と」で繋がない）`
        : `必須食材: ${p ? `${p} と ${v}` : v}（料理名に必ず含める）`;
    return `${idx + 1}) kojiType: ${x.kojiType}\n- ${must}\n- 【調理法】必ず「${dishType}」にする（例: 〇〇の旨塩風こうじ${dishType}）\n- 料理名は「旨塩風こうじ/中華風こうじ/コンソメ風こうじ」の短縮名を必ず含める\n- summaryは2〜3文で自然に（最後を無理に「！」にしない）\n- stepsは3〜5個で簡潔に`;
  })
  .join('\n\n')}

【栄養情報】各メニューに以下を必ず含める（必須）：
- timeMinutes: 調理時間（分、5〜30程度）※材料の切り方や調理法で変動させる
- caloriesKcal: 1人前のカロリー目安（kcal）※材料ごとに異なる値にする
  - 野菜のみ: 50〜150kcal、肉入り: 200〜400kcal、炒め物: 250〜350kcal
- saltG: 1人前の塩分目安（g）※調理法で変動させる
  - 和え物: 0.8〜1.2g、炒め物: 1.5〜2.0g、スープ: 1.2〜1.8g
【重要】3件それぞれで栄養情報は異なる値にすること！同じ値にしない

【出力JSONの例（この形に厳密に合わせる）】
${schemaHint}

出力:`;

  const attempts: Array<{ temperature: number; extra: string }> = [
    { temperature: 0.6, extra: '' },
    {
      temperature: 0.35,
      extra:
        '\n【再確認】JSONのみ。3件すべてにkojiType/title/summary/keyIngredients/steps/timeMinutes/caloriesKcal/saltGを入れる。栄養情報は3件それぞれ異なる値にする。',
    },
  ];

  for (const a of attempts) {
    const raw = await generateText(`${prompt}${a.extra}`, {
      model: 'gemini-3-flash-preview',
      temperature: a.temperature,
      maxOutputTokens: 900,
    });

    const jsonText = extractJsonArray(raw);
    if (!jsonText) continue;

    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      continue;
    }

    if (!Array.isArray(parsed)) continue;

    const out: MenuIdeaJson[] = [];
    for (const item of items) {
      const found = parsed.find((x: any) => x?.kojiType === item.kojiType);
      const validated = validateMenuIdeaJson(category, found, item.assigned, item.kojiType);
      if (validated) out.push(validated);
    }

    if (out.length === 3) {
      return { menuIdeas: out };
    }
  }

  // 最後の砦：常に読めるJSONを返す（UX最優先）
  return {
    menuIdeas: KOJI_TYPES.map((kojiType) =>
      buildFallbackIdeaJson(category, kojiType, selected[kojiType])
    ),
  };
}

// 5カテゴリを並列で生成（高速化）
// 各カテゴリで3つの異なる「食材+最適な麹」の組み合わせでメニュー案を生成
async function generateAllMenuIdeasParallel(): Promise<Record<string, { menuIdeas: MenuIdeaJson[] }>> {
  const results: Record<string, { menuIdeas: MenuIdeaJson[] }> = {};
  const tasks = CATEGORIES.map(async (category) => {
    const res = await generateThreeMenuIdeasForCategory(category as Category);
    results[category] = res;
  });
  await Promise.all(tasks);
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RequestBody;

    // 全カテゴリ並列生成（5カテゴリ同時実行で高速化）
    if (body.allCategories) {
      const results = await generateAllMenuIdeasParallel();

      return NextResponse.json({
        success: true,
        results,
      }, { headers: corsHeaders });
    }

    // 単一カテゴリ生成
    const { promptCategory } = body;
    if (!promptCategory) {
      return NextResponse.json({ error: 'promptCategory または allCategories が必要です' }, { status: 400, headers: corsHeaders });
    }

    // 単一カテゴリでも3案（旨塩/中華/コンソメ）を返す
    const { menuIdeas } = await generateThreeMenuIdeasForCategory(promptCategory as Category);
    return NextResponse.json({ success: true, menuIdeas }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Error in /api/quick-menu-idea:', error);
    return NextResponse.json(
      {
        error: 'メニュー案の生成に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

