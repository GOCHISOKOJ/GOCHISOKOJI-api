'use client';

import React, { Suspense } from 'react';
import { Button } from '@/components/Button';
import { Leaf, Sparkles, Shield, Thermometer, Mail, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isEmailLogin, setIsEmailLogin] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState('');
  const supabase = createClient();

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError('');
      const next = searchParams.get('next') ?? '/';
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (error) {
        console.error('ログインエラー:', error.message);
        setError('ログインに失敗しました。もう一度お試しください。');
      }
    } catch (error) {
      console.error('予期しないエラー:', error);
      setError('ログインに失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください。');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setError('メールアドレスまたはパスワードが正しくありません。');
        } else if (error.message.includes('Email not confirmed')) {
          setError('メールアドレスの確認が完了していません。メールをご確認ください。');
        } else {
          setError('ログインに失敗しました。もう一度お試しください。');
        }
        return;
      }

      const next = searchParams.get('next') ?? '/';
      router.push(next);
    } catch (error) {
      console.error('予期しないエラー:', error);
      setError('ログインに失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-sm mx-auto min-h-screen flex flex-col">
        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="flex-1" />
          
          {/* ブランディングセクション */}
          <div className="w-full space-y-6 mb-6">
            <div className="flex flex-col items-center gap-4">
              <div className="h-20 w-20 rounded-xl bg-primary flex items-center justify-center shadow-card">
                <Leaf className="h-10 w-10 text-primary-foreground" />
              </div>
              <div className="text-center space-y-2">
                <h1 className="text-2xl">GOCHISOKOJI</h1>
                <p className="text-lg text-muted-foreground">
                  麹レシピを、AIと。
                </p>
              </div>
            </div>

            {/* 特徴アイコン（コンパクト） */}
            {!isEmailLogin && (
              <div className="flex items-center justify-center gap-6 py-2">
                <div className="flex flex-col items-center gap-1">
                  <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center border border-primary/25">
                    <Leaf className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-[10px] font-medium text-foreground">発酵食品</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-[10px] font-medium text-foreground">AI制作</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="h-10 w-10 rounded-lg bg-primary/25 flex items-center justify-center border border-primary/35">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-[10px] font-medium text-foreground">安全管理</span>
                </div>
              </div>
            )}
          </div>

          {/* エラーメッセージ */}
          {error && (
            <div className="w-full mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive text-center">{error}</p>
            </div>
          )}

          {/* ログインフォーム */}
          <div className="w-full space-y-4">
            {isEmailLogin ? (
              // メールログインフォーム
              <form onSubmit={handleEmailLogin} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="w-full h-11 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    パスワード
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="パスワードを入力"
                      className="w-full h-11 px-3 pr-10 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <Link href="/reset-password" className="text-xs text-primary hover:underline">
                    パスワードを忘れた方
                  </Link>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  tone="primary"
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full" />
                      ログイン中...
                    </>
                  ) : (
                    'ログイン'
                  )}
                </Button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-surface px-2 text-muted-foreground">または</span>
                  </div>
                </div>

                <Button
                  type="button"
                  size="lg"
                  tone="secondary"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Googleで続ける
                </Button>

                <button
                  type="button"
                  onClick={() => setIsEmailLogin(false)}
                  className="w-full text-sm text-muted-foreground hover:text-foreground text-center py-2"
                >
                  ← 戻る
                </button>
              </form>
            ) : (
              // 初期表示：ログイン方法選択
              <>
                <Button
                  size="lg"
                  tone="primary"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full shadow-lg shadow-orange-200/50 hover:shadow-xl hover:shadow-orange-300/50 transition-all duration-200"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full" />
                      ログイン中...
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      Googleで続ける
                    </>
                  )}
                </Button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-surface px-2 text-muted-foreground">または</span>
                  </div>
                </div>

                <Button
                  size="lg"
                  tone="secondary"
                  onClick={() => setIsEmailLogin(true)}
                  className="w-full"
                >
                  <Mail className="h-5 w-5" />
                  メールアドレスでログイン
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  アカウントをお持ちでない方は
                  <Link href="/signup" className="text-primary hover:underline ml-1">
                    新規登録
                  </Link>
                </p>
              </>
            )}

            {/* 法的事項 */}
            <p className="text-xs text-center text-muted-foreground px-4 leading-relaxed">
              続けることで、
              <a href="#" className="text-primary hover:underline">利用規約</a>
              および
              <a href="#" className="text-primary hover:underline">プライバシーポリシー</a>
              に同意したものとみなされます。
            </p>
          </div>

          <div className="flex-1" />

          {/* 価値提案 */}
          {!isEmailLogin && (
            <div className="w-full mt-6 mb-4">
              <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Thermometer className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-foreground leading-relaxed">
                      AIは食品安全と温度管理のガイダンスも提供します
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        <footer className="p-6 text-center">
          <p className="text-xs text-foreground/60">
            © 2024 GOCHISOKOJI. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-muted-foreground">読み込み中...</div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}
