# 🍚 YUTAKA - 麹レシピWebアプリ

**AIと一緒に作る、麹を使った発酵食品レシピ共有プラットフォーム**

Next.js 15（App Router）+ Supabase + Gemini API で構築された、モバイルファーストなWebアプリケーションです。

---

## 📱 主要機能

| 画面 | 機能 | 説明 |
|------|------|------|
| **ログイン** (`/login`) | Google OAuth認証 | Googleアカウントで簡単ログイン |
| **ホーム** (`/`) | レシピ一覧 | 投稿されたレシピをカード形式で閲覧 |
| **AI制作** (`/compose`) | AIチャット & レシピ生成 | Gemini APIで対話しながらレシピを作成 |
| **プロフィール** (`/profile`) | ユーザー情報 | 自分の投稿・お気に入り管理 |

---

## 🚀 技術スタック

- **フレームワーク**: [Next.js 15](https://nextjs.org/) (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **認証・DB**: [Supabase](https://supabase.com/)
- **AI**: [Google Gemini API](https://ai.google.dev/) (gemini-2.0-flash-exp)
- **アイコン**: [Lucide React](https://lucide.dev/)
- **デプロイ**: Vercel（推奨）

---

## 📦 起動手順（開発環境）

### 1. リポジトリのクローン

```bash
git clone https://github.com/your-username/koji-recipe-app.git
cd koji-recipe-app
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

プロジェクトルートに `.env.local` ファイルを作成し、以下を記述：

```env
# Supabase接続情報
NEXT_PUBLIC_SUPABASE_URL=https://cykogheprysvhimwlndm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5a29naGVwcnlzdmhpbXdsbmRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MzAzMDksImV4cCI6MjA4MTIwNjMwOX0.XVEK-jFe003kGwV_kQ3CJz0Ocr0cV46vZexYONbTatU

# Gemini API（AI機能で使用）
GEMINI_API_KEY=AIzaSyCmkqFpn8myIu8BaXgc10RMNVHQ2qBzkYM
```

**取得方法の詳細**: [📄 環境変数設定ガイド](./docs/environment-variables.md)

### 4. Supabaseのセットアップ

データベース・認証・ストレージの初期設定が必要です。

**詳細手順**: [📄 Supabaseセットアップガイド](./docs/supabase-setup.md)

### 5. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

---

## 🗂️ 画面構成

### `/login` - ログイン画面
- ボタン **「Googleで続ける」** でOAuth認証
- ログイン後、元のページに自動で戻ります（`?next=` パラメータ対応）

### `/` - ホーム画面
- 投稿されたレシピをカード形式で表示
- タブで「新着」「人気」を切り替え
- ボトムナビで他画面へ移動

### `/compose` - AI制作モード
- AIチャットで材料・目的を相談
- AIがレシピを自動生成
- 画像アップロード・編集機能

### `/profile` - プロフィール画面
- 自分の投稿一覧
- お気に入りレシピ
- ログアウト機能

### 共通UI
- **ボトムナビ**（ホーム・AI・プロフィール）は全画面共通（`/login` 除く）
- 375px幅のモバイル最適化デザイン

---

## 📚 ドキュメント

プロジェクトの詳細情報は `docs/` フォルダにまとめています。

| ドキュメント | 内容 |
|------------|------|
| [📄 進捗・残タスク](./docs/progress.md) | 開発状況とチェックリスト |
| [📄 Supabaseセットアップ](./docs/supabase-setup.md) | DB・認証・RLS・Storageの設定手順 |
| [📄 環境変数設定](./docs/environment-variables.md) | `.env.local` の設定方法 |
| [📄 本番環境移行（開発者向け）](./docs/migration-guide-developer.md) | 本番デプロイ手順 |
| [📄 本番環境セットアップ（お客様向け）](./docs/production-setup.md) | お客様環境の構築手順 |
| [📄 AIチャット例文管理](./docs/ai-examples.md) | Supabaseで例文を管理する方法 |

---

## 🛠️ トラブルシューティング

### ❌ `middleware` の警告が出る
```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```
**原因**: Next.js 16で `middleware.ts` の命名規則が変更されました  
**対処**: 現状は警告のみで動作に影響ありません（将来的に `proxy.ts` へ移行予定）

### ❌ ログインできない
**確認項目**:
1. Supabase Dashboard → Authentication → Providers → **Google が有効**になっているか
2. Google Cloud Console で **Redirect URI** が正しく設定されているか  
   - `https://your-project.supabase.co/auth/v1/callback`
3. `.env.local` に正しい `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` が設定されているか

### ❌ 画像アップロードできない
**確認項目**:
1. Supabase Dashboard → Storage → バケット **`post-images`** が存在するか
2. Storage RLS ポリシーが設定されているか（[詳細](./docs/supabase-setup.md)）

### ❌ AI機能が動かない
**確認項目**:
1. `.env.local` に `GEMINI_API_KEY` が設定されているか
2. Gemini APIの利用制限に達していないか（[AI Studio](https://aistudio.google.com/) で確認）

---

## 🎨 デザインシステム

### カラートークン（Tailwind CSS変数）

```css
/* globals.css で定義 */
--primary: オレンジ系（麹のイメージ）
--surface: 背景色
--ink: テキスト色
--border: ボーダー色
--muted-foreground: 補助テキスト色
```

### 余白ルール
- 基本単位: **8px**（8/16/24/32/40...）
- コンポーネント間の余白は `space-y-4` / `gap-4` などで統一

### コンポーネント
- `src/components/` に再利用可能なコンポーネントを配置
- 例: `Button.tsx`, `TabBar.tsx`, `BottomNav.tsx`, `CardPost.tsx`

---

## 📁 ディレクトリ構造

```
01-koji-project/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (app)/             # 共通レイアウト（ボトムナビあり）
│   │   │   ├── page.tsx       # ホーム
│   │   │   ├── compose/       # AI制作モード
│   │   │   └── profile/       # プロフィール
│   │   ├── login/             # ログイン（ボトムナビなし）
│   │   ├── auth/callback/     # OAuth コールバック
│   │   └── api/               # APIルート
│   ├── components/            # 再利用可能コンポーネント
│   ├── lib/                   # ユーティリティ・API
│   │   ├── supabase/          # Supabase クライアント
│   │   └── gemini/            # Gemini API クライアント
│   └── middleware.ts          # 認証ガード
├── docs/                      # ドキュメント
├── public/                    # 静的ファイル
└── .env.local                 # 環境変数（Git管理外）
```

---

## 🚢 本番デプロイ

### Vercelへのデプロイ（推奨）

1. GitHubリポジトリを作成してコードをプッシュ
2. [Vercel](https://vercel.com/) にログイン
3. 「New Project」→ GitHubリポジトリを選択
4. 環境変数を設定（`NEXT_PUBLIC_SUPABASE_URL` など）
5. 「Deploy」をクリック

**詳細手順**: [📄 本番環境移行ガイド](./docs/migration-guide-developer.md)

---

## 📝 ライセンス

このプロジェクトは非公開のお客様向けアプリケーションです。

---

## 🙋 サポート

質問・不具合報告は、リポジトリのIssuesまたは開発者へ直接ご連絡ください。

---

**© 2024 YUTAKA. All rights reserved.**
