# 環境変数の設定

## 必要な環境変数

プロジェクトルートに `.env.local` ファイルを作成し、以下の内容を記述してください：

```env
# Supabase接続情報
NEXT_PUBLIC_SUPABASE_URL=your-project-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Supabase（サーバー専用・RAGインデックス更新で使用）
# NOTE: 絶対にクライアントに露出させない（NEXT_PUBLIC_を付けない）
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Gemini API（AI機能で使用）
GEMINI_API_KEY=your-gemini-api-key-here

# Gemini Embeddings（RAGで使用）
# このプロジェクトのDBは vector(768) を前提（text-embedding-004）
GEMINI_EMBEDDING_MODEL=text-embedding-004
```

## 取得方法

### Supabase
1. Supabaseダッシュボードにログイン（https://supabase.com/dashboard）
2. プロジェクトを選択
3. Settings → API
4. **Project URL**と**anon public key**をコピー
5. 同じ画面で **service_role key** をコピー（RAGのインデックス更新に必要）

### Gemini API
1. Google AI Studioにアクセス（https://aistudio.google.com/app/apikey）
2. 「Create API Key」をクリック
3. 既存のGoogle Cloudプロジェクトを選択するか、新規作成
4. 生成されたAPIキーをコピー

**注意**: レシピ生成は `GEMINI_MODEL`（未設定時は内部のデフォルト）で動きます。RAGのEmbeddingは `text-embedding-004`（768次元）を前提にしています。

## 環境変数の設定例

```env
# 開発環境の例
NEXT_PUBLIC_SUPABASE_URL=https://cykogheprysvhimwlndm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
GEMINI_API_KEY=AIzaSyD...
GEMINI_EMBEDDING_MODEL=text-embedding-004
```

## 本番環境への設定

### Vercelでの設定方法
1. Vercelダッシュボードでプロジェクトを選択
2. Settings → Environment Variables
3. 上記の3つの環境変数を追加
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `GEMINI_EMBEDDING_MODEL`
4. すべての環境（Production, Preview, Development）にチェック
5. Save

## 注意事項
- `.env.local`ファイルは`.gitignore`に含まれているため、Gitにコミットされません
- `NEXT_PUBLIC_`プレフィックスが付いた変数はクライアントサイドでも使用可能です
- `GEMINI_API_KEY`はサーバーサイドのみで使用されます（クライアントに公開されません）
- APIキーは絶対に公開リポジトリにコミットしないでください


