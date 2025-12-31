# Supabaseセットアップ手順

このドキュメントでは、麹レシピWebアプリ用のSupabaseプロジェクトを作成・設定する手順を説明します。

## 📋 前提条件

- Googleアカウント（Supabase登録用）
- メールアドレス（確認用）

---

## 🚀 Step 1: Supabaseアカウント作成

1. **Supabase公式サイトにアクセス**
   - https://supabase.com/

2. **「Start your project」をクリック**

3. **GitHubアカウントでサインアップ**（推奨）
   - または、メールアドレスで登録

4. **メール確認**
   - 登録したメールアドレスに確認メールが届く
   - リンクをクリックして認証

---

## 🏗️ Step 2: 新規プロジェクト作成

1. **ダッシュボードで「New project」をクリック**

2. **プロジェクト情報を入力**
   - **Organization**: 既存のものを選択、または新規作成
   - **Name**: `koji-recipe-app`（任意の名前）
   - **Database Password**: 強力なパスワードを生成（メモしておく）
   - **Region**: `Northeast Asia (Tokyo)` を選択（日本からのアクセスが最速）
   - **Pricing Plan**: `Free` を選択

3. **「Create new project」をクリック**
   - プロジェクトの作成には1-2分かかります

---

## 🔑 Step 3: API認証情報の取得

プロジェクトが作成されたら、認証情報を取得します。

1. **左サイドバーの「Settings」をクリック**

2. **「API」タブを選択**

3. **以下の情報をコピー**
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon (public) key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

4. **環境変数ファイルに保存**
   - プロジェクトルートに `.env.local` を作成
   - 以下を記述：

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🗄️ Step 4: データベーステーブルの作成

1. **左サイドバーの「Table Editor」をクリック**

2. **「Create a new table」をクリック**

3. **以下のテーブルを順番に作成**

### 📝 テーブル構成

#### `recipes` テーブル
| カラム名 | 型 | 設定 |
|---------|-----|------|
| id | uuid | Primary Key, Default: gen_random_uuid() |
| user_id | uuid | Foreign Key → auth.users(id) |
| title | text | NOT NULL |
| caption | text | |
| ingredients | jsonb | NOT NULL, Default: '[]' |
| steps | jsonb | NOT NULL, Default: '[]' |
| serving_size | int4 | |
| prep_time | int4 | |
| koji_type | text[] | |
| image_url | text | |
| created_at | timestamp | Default: now() |
| updated_at | timestamp | Default: now() |

#### `posts` テーブル
| カラム名 | 型 | 設定 |
|---------|-----|------|
| id | uuid | Primary Key, Default: gen_random_uuid() |
| recipe_id | uuid | Foreign Key → recipes(id) |
| user_id | uuid | Foreign Key → auth.users(id) |
| view_count | int4 | Default: 0 |
| created_at | timestamp | Default: now() |

#### `favorites` テーブル
| カラム名 | 型 | 設定 |
|---------|-----|------|
| user_id | uuid | Foreign Key → auth.users(id) |
| post_id | uuid | Foreign Key → posts(id) |
| created_at | timestamp | Default: now() |
| PRIMARY KEY | (user_id, post_id) | |

---

## 🔒 Step 5: RLS（Row Level Security）の設定

### RLSを有効化
各テーブルで「Enable RLS」をクリック

### ポリシーの作成

#### `recipes` テーブル
```sql
-- 全員が読める
CREATE POLICY "Anyone can read recipes"
ON recipes FOR SELECT
TO public
USING (true);

-- 作成者のみ作成・更新・削除可能
CREATE POLICY "Users can insert their own recipes"
ON recipes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recipes"
ON recipes FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recipes"
ON recipes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
```

#### `posts` テーブル
```sql
-- 全員が読める
CREATE POLICY "Anyone can read posts"
ON posts FOR SELECT
TO public
USING (true);

-- 作成者のみ作成可能
CREATE POLICY "Users can insert their own posts"
ON posts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 作成者のみ削除可能
CREATE POLICY "Users can delete their own posts"
ON posts FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 全員がview_countを更新可能（PV計測用）
CREATE POLICY "Anyone can update view count"
ON posts FOR UPDATE
TO public
USING (true)
WITH CHECK (true);
```

#### `favorites` テーブル
```sql
-- 本人のみ自分のお気に入りを読める
CREATE POLICY "Users can read their own favorites"
ON favorites FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 本人のみお気に入りを追加できる
CREATE POLICY "Users can insert their own favorites"
ON favorites FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 本人のみお気に入りを削除できる
CREATE POLICY "Users can delete their own favorites"
ON favorites FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
```

---

## 🔐 Step 6: Google OAuth設定

1. **左サイドバーの「Authentication」→「Providers」をクリック**

2. **「Google」を選択**

3. **「Enable Google provider」をオンにする**

4. **Google Cloud Consoleでプロジェクトを作成**
   - https://console.cloud.google.com/
   - 新規プロジェクトを作成

5. **OAuth同意画面を設定**
   - 「APIs & Services」→「OAuth consent screen」
   - User Type: External
   - App name: `麹レシピアプリ`
   - Developer contact: あなたのメールアドレス

6. **OAuth 2.0認証情報を作成**
   - 「Credentials」→「Create Credentials」→「OAuth client ID」
   - Application type: Web application
   - Name: `koji-recipe-supabase`
   - Authorized redirect URIs: 
     - `https://xxxxx.supabase.co/auth/v1/callback`
     （SupabaseのURL + `/auth/v1/callback`）

7. **Client IDとClient SecretをSupabaseに設定**
   - SupabaseのGoogle Provider設定画面に戻る
   - Client IDとClient Secretを入力
   - 「Save」をクリック

---

## ✅ 完了

セットアップが完了しました！

### 確認事項
- ✅ Supabaseプロジェクトが作成されている
- ✅ `.env.local`にAPI認証情報が設定されている
- ✅ テーブルが作成されている
- ✅ RLSが有効化され、ポリシーが設定されている
- ✅ Google OAuthが設定されている

次は、アプリケーション側でSupabaseクライアントを設定します。







