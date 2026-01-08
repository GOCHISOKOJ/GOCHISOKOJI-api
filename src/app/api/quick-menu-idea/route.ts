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
  promptCategory?: string; // 単一カテゴリ
  allCategories?: boolean; // 全カテゴリ一括生成
};

const KOJI_TYPES = ['旨塩風こうじ調味料', '中華風こうじ調味料', 'コンソメ風こうじ調味料'];
const CATEGORIES = ['5分で簡単レシピ', '材料1つでできる', '主菜（メイン）', '副菜（サブ）', '汁物'];

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
        // 「と」で複数食材を繋いでいないかチェック（「とろ〜」は除外）
        mustNotInclude: [/と[^ろ]/, /、.+、/, /と.+と/],
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
  // 1行、料理名。説明文 の形式
  if (!trimmed.includes('。')) return false;
  // 最後は「！」推奨（最低限の勢い）
  if (!trimmed.endsWith('！')) return false;

  const rule = getCategoryRule(category);

  // タイトル（料理名）部分を抽出
  const title = trimmed.split('。')[0] || '';

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

function normalizeOneLiner(s: string): string {
  let t = (s ?? '').trim().replace(/\n/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();

  // 【クリーンアップ】AIが出力しがちな不要なプレフィックスを除去
  t = t
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

function enforceCategoryConstraints(category: string, menuIdea: string, kojiShort: string, kojiType: string): string {
  let t = normalizeOneLiner(menuIdea);

  // タイトル（料理名）部分を抽出して調理法と麹名を補完
  let parts = t.split('。');
  let title = (parts[0] || '').trim() || 'こうじの簡単おかず';
  let desc = (parts[1] || '').trim() || `${kojiShort}のコクが決め手で、今日すぐ作りたくなる味！`;

  // タイトルに調理法/料理タイプと麹名がなければ補完
  title = fixTitleDishType(category, title, kojiType);
  t = normalizeOneLiner(`${title}。${desc}`);

  // 既にOKならそのまま
  if (validateMenuIdea(category, t)) return t;

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
  if (!validateMenuIdea(category, t)) {
    const safeByCategory: Record<string, string> = {
      '5分で簡単レシピ': `5分で完成！キャベツの${kojiName}炒め。${kojiShort}のコクがじゅわっと絡み、サッと作れて満足感たっぷり！`,
      '材料1つでできる': `もやしだけの${kojiName}和え。${kojiShort}で味が決まり、材料1つでも箸が止まらない！`,
      '汁物': `わかめと豆腐の${kojiName}みそ汁。${kojiShort}で出汁いらず、毎日飲みたいやさしい味！`,
      '副菜（サブ）': `ブロッコリーの${kojiName}サラダ。${kojiShort}のコクで野菜がぐっとおいしく、あと一品に！`,
      '主菜（メイン）': `豚バラとキャベツの${kojiName}炒め。${kojiShort}の香りとうま味で、ご飯が進む！`,
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
      const matchingSoups = SOUP_WITH_INGREDIENTS.filter(s => s.koji === specifiedKojiType);
      const soupSet = matchingSoups.length > 0 
        ? matchingSoups[Math.floor(Math.random() * matchingSoups.length)]
        : SOUP_WITH_INGREDIENTS[Math.floor(Math.random() * SOUP_WITH_INGREDIENTS.length)];
      soupIngredients = { protein: soupSet.protein, veggie: soupSet.veggie };
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

  // カテゴリの指示に従わせるため、検証 → NGなら温度を下げてリトライ
  const attempts: Array<{ temperature: number; extra: string }> = [
    { temperature: 0.75, extra: '' },
    {
      temperature: 0.35,
      extra:
        '\n【追加の絶対条件】\n- 上の「カテゴリの指示」を満たさない出力は不合格。必ず満たしてから出力する。\n- 出力は1回で決める（やり直しの前提で書かない）。\n',
    },
  ];

  let menuIdea = '';
  for (const a of attempts) {
    const raw = await generateText(`${promptBase}${a.extra}`, {
      model: 'gemini-3-flash-preview',
      temperature: a.temperature,
      maxOutputTokens: 500,
    });
    // タイトルが途中で切れないよう、上限を広げる（麹名+調理法で長くなるため）
    menuIdea = normalizeOneLiner(raw.trim().replace(/\n/g, ' ').slice(0, 300));
    if (validateMenuIdea(category, menuIdea, kojiType)) break;
  }

  // 形式の最低保証（タイトルだけ等の事故をここで潰す）
  const hasSeparator = menuIdea.includes('。');
  const tooShort = menuIdea.length < 40;
  const kojiName = getKojiShortName(kojiType);
  
  if (!hasSeparator || tooShort) {
    // 参考の先頭から"料理名っぽいもの"を拾えなければ、カテゴリに沿ったテンプレで補う
    const fallbackTitleByCategory: Record<string, string> = {
      '5分で簡単レシピ': `サッとキャベツの${kojiName}炒め`,
      '材料1つでできる': `もやしの${kojiName}和え`,
      '主菜（メイン）': `豚バラとキャベツの${kojiName}炒め`,
      '副菜（サブ）': `ブロッコリーの${kojiName}サラダ`,
      '汁物': `わかめと豆腐の${kojiName}みそ汁`,
    };
    const pickedTitle = candidateTitles[0] || '';
    let title = (pickedTitle || menuIdea.split('。')[0] || '').slice(0, 30);
    title = fixTitleDishType(category, title, kojiType);
    if (!title || title.length < 3 || !KOJI_TYPE_PATTERNS.some((r) => r.test(title))) {
      title = fallbackTitleByCategory[category] || `こうじの簡単おかず`;
    }
    const baseDescByCategory: Record<string, string> = {
      '5分で簡単レシピ': `${kojiShort}で味付け一発、5分でサッと仕上がって満足感たっぷり！`,
      '材料1つでできる': `${kojiShort}のうま味で味が決まり、材料1つでも箸が止まらない！`,
      '主菜（メイン）': `${kojiShort}のコクが効いて、ご飯が進むメインおかずに仕上がる！`,
      '副菜（サブ）': `${kojiShort}で野菜がぐっとおいしく、あと一品にぴったり！`,
      '汁物': `${kojiShort}のうま味が染みわたる、体が温まる一杯！`,
    };
    const desc = baseDescByCategory[category] || `${kojiShort}のコクが決め手で、今日すぐ作りたくなる味！`;
    menuIdea = `${title}。${desc}`;
  }

  // カテゴリ制約を最終的に満たすよう補正（チップ指示に必ず従う）
  // 汁物の種類はAIが食材を見て判断するため、強制的な種類変更は行わない
  menuIdea = enforceCategoryConstraints(category, menuIdea, kojiShort, kojiType);

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

// カテゴリごとに3つの異なる「食材+最適な麹」の組み合わせを定義
// 各料理に最適な麹タイプを事前にマッピング
type MenuCombo = { protein: string; veggie: string; kojiType: string };

const THREE_MENU_COMBOS_BY_CATEGORY: Record<string, MenuCombo[]> = {
  '5分で簡単レシピ': [
    { protein: '豚こま', veggie: 'キャベツ', kojiType: '中華風こうじ調味料' },      // 中華風炒めに最適
    { protein: 'ベーコン', veggie: 'ほうれん草', kojiType: 'コンソメ風こうじ調味料' }, // 洋風ソテーに最適
    { protein: '卵', veggie: 'もやし', kojiType: '旨塩風こうじ調味料' },            // シンプルな和風に最適
  ],
  '材料1つでできる': [
    { protein: '', veggie: 'もやし', kojiType: '中華風こうじ調味料' },    // もやしは中華風が合う
    { protein: '', veggie: 'ブロッコリー', kojiType: 'コンソメ風こうじ調味料' }, // ブロッコリーは洋風が合う
    { protein: '', veggie: 'にんじん', kojiType: '旨塩風こうじ調味料' },  // にんじんは旨塩で甘み引き立つ
  ],
  '主菜（メイン）': [
    { protein: '鶏もも肉', veggie: 'ピーマン', kojiType: '中華風こうじ調味料' },  // 青椒肉絲風
    { protein: '鮭', veggie: 'きのこ', kojiType: 'コンソメ風こうじ調味料' },     // 洋風ムニエル
    { protein: '豚バラ', veggie: '白菜', kojiType: '旨塩風こうじ調味料' },       // 和風の定番
  ],
  '副菜（サブ）': [
    { protein: '', veggie: 'ブロッコリー', kojiType: 'コンソメ風こうじ調味料' },  // 洋風サラダ
    { protein: 'ツナ', veggie: 'キャベツ', kojiType: '旨塩風こうじ調味料' },     // 和風サラダ
    { protein: '', veggie: '小松菜', kojiType: '中華風こうじ調味料' },          // 中華風ナムル
  ],
  '汁物': [
    { protein: 'ベーコン', veggie: 'キャベツ', kojiType: 'コンソメ風こうじ調味料' },  // ポトフ風
    { protein: '豚バラ', veggie: '白菜', kojiType: '中華風こうじ調味料' },           // 中華風スープ
    { protein: '豆腐', veggie: 'わかめ', kojiType: '旨塩風こうじ調味料' },           // 和風みそ汁
  ],
};

// カテゴリごとに3つの異なる食材組み合わせを取得
function getThreeMenuCombos(category: string): MenuCombo[] {
  return THREE_MENU_COMBOS_BY_CATEGORY[category] || THREE_MENU_COMBOS_BY_CATEGORY['主菜（メイン）'];
}

// 旧関数（後方互換性のために残す）
function assignUniqueIngredientsPerCategory(): Record<string, { protein: string; veggie: string }> {
  const assignments: Record<string, { protein: string; veggie: string }> = {};
  CATEGORIES.forEach((cat) => {
    const combos = THREE_MENU_COMBOS_BY_CATEGORY[cat];
    if (combos && combos.length > 0) {
      const selected = combos[Math.floor(Math.random() * combos.length)];
      assignments[cat] = { protein: selected.protein, veggie: selected.veggie };
    } else {
      assignments[cat] = { protein: '', veggie: '' };
    }
  });
  return assignments;
}

// 5カテゴリを並列で生成（高速化）
// 各カテゴリで3つの異なる「食材+最適な麹」の組み合わせでメニュー案を生成
async function generateAllMenuIdeasParallel(): Promise<Record<string, { menuIdeas: Array<{ menuIdea: string; kojiType: string }> }>> {
  // 5カテゴリ × 3つの異なる組み合わせ = 15の生成を並列実行
  const promises: Array<Promise<{ category: string; menuIdea: string; kojiType: string; index: number }>> = [];
  
  for (const category of CATEGORIES) {
    // 各カテゴリで3つの異なる「食材+最適な麹」の組み合わせを取得
    const menuCombos = getThreeMenuCombos(category);
    
    // 各組み合わせでメニュー案を生成（異なる食材 & 最適な麹）
    menuCombos.forEach((combo, index) => {
      const assigned = { protein: combo.protein, veggie: combo.veggie };
      promises.push(
        generateMenuIdea(category, undefined, assigned, combo.kojiType)
          .then(result => ({ category, index, ...result }))
      );
    });
  }

  const allResults = await Promise.all(promises);

  // カテゴリごとにグループ化
  const results: Record<string, { menuIdeas: Array<{ menuIdea: string; kojiType: string }> }> = {};
  for (const category of CATEGORIES) {
    const categoryResults = allResults.filter(r => r.category === category);
    // インデックス順で並べる（事前定義順）
    const orderedResults = categoryResults
      .sort((a, b) => a.index - b.index)
      .map(r => ({ menuIdea: r.menuIdea, kojiType: r.kojiType }));
    
    results[category] = {
      menuIdeas: orderedResults
    };
  }

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

    const { menuIdea, kojiType } = await generateMenuIdea(promptCategory);

    return NextResponse.json({
      success: true,
      menuIdea,
      kojiType,
    }, { headers: corsHeaders });
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

