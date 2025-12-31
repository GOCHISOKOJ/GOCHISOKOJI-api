# AIチャット例文（メニュー）をSupabaseで管理する

目的: `/compose` の「タップして例を見る」に出る **例文（メニュー）** を、コード変更なしで **Supabaseダッシュボードから差し替え**できるようにする。

---

## 1. テーブル作成（SQL）

Supabaseの「SQL Editor」で以下を実行してください。

⚠️ **注意**: SQL Editorには **SQLだけ**を貼ってください（`##` や ``` を貼るとエラーになります）

おすすめの手順:
- このリポジトリの `docs/sql/ai_examples_setup.sql` を開く
- **全文をコピー**して Supabase の **「SQL Editor」** に貼り、**「Run」** を押す

```sql
-- 例文（メニュー）管理テーブル
create table if not exists public.ai_examples (
  id uuid primary key default gen_random_uuid(),
  koji_type text not null,
  text text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at を自動更新
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_ai_examples_updated_at on public.ai_examples;
create trigger set_ai_examples_updated_at
before update on public.ai_examples
for each row execute procedure public.set_updated_at();

-- RLS
alter table public.ai_examples enable row level security;

-- 読み取りは全員OK（例文表示のため）
drop policy if exists "Anyone can read ai_examples" on public.ai_examples;
create policy "Anyone can read ai_examples"
on public.ai_examples
for select
to public
using (true);
```

---

## 2. 初期データ投入（例: 中華麹）

おすすめの手順:
- `docs/sql/ai_examples_seed_chuka.sql` を開く
- **全文をコピー**して Supabase の **「SQL Editor」** に貼り、**「Run」** を押す

```sql
insert into public.ai_examples (koji_type, text) values
('中華麹', '中華麹で作る、鶏むねのよだれ鶏。鶏むねをしっとり茹でて裂き、きゅうりと一緒に盛る。タレは中華麹＋酢＋ごま油＋ラー油＋にんにく＋白ごま。辛さはラー油で調整したい。'),
('中華麹', '中華麹でもやしナムル。もやしをさっと茹でて水気を切り、中華麹＋ごま油＋白ごま＋こしょうで和える。にらや人参を少し入れてもいい。作り置きできるように日持ちの目安も知りたい。'),
('中華麹', '中華麹の麻婆なす。なすをごま油で焼いて、ひき肉と豆板醤を炒め、中華麹で旨みを足してとろみをつける。辛さ控えめにして子どもも食べられる味にしたい。');
```

---

## 3. ローテーション仕様（週替わり）

- アプリ側は **週替わり**で例文を決めます（同じ週は同じ例が選ばれます）
- Supabase側の例文の **追加/削除/有効化切替** をすると、次のアクセスから反映されます

有効化/無効化:

```sql
update public.ai_examples set is_active = false where id = '...';
```

---

## 4. 動作確認（押すボタン名）

1. `http://localhost:3000/compose` を開く
2. 例カードの **「タップして例を見る」** をクリック
3. 入力欄に例文が入る（中華麹の内容になる）ことを確認

---

## 実装メモ（コード側）

- API: `src/app/api/ai-examples/route.ts`
  - `public.ai_examples` から `is_active=true` を取得
  - Supabaseが未設定/未作成のときは `src/config/ai-examples.json` にフォールバック


