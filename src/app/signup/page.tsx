'use client';

import React from 'react';
import { Button } from '@/components/Button';
import { Leaf, Eye, EyeOff, ArrowLeft, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState(false);
  const supabase = createClient();

  // パスワード強度チェック
  const passwordChecks = {
    length: password.length >= 8,
    hasNumber: /\d/.test(password),
    hasLetter: /[a-zA-Z]/.test(password),
  };
  const isPasswordValid = passwordChecks.length && passwordChecks.hasNumber && passwordChecks.hasLetter;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !confirmPassword) {
      setError('すべての項目を入力してください。');
      return;
    }

    if (!isPasswordValid) {
      setError('パスワードの要件を満たしていません。');
      return;
    }

    if (password !== confirmPassword) {
      setError('パスワードが一致しません。');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          setError('このメールアドレスは既に登録されています。');
        } else {
          setError('登録に失敗しました。もう一度お試しください。');
        }
        return;
      }

      // メール確認がOFFの場合、セッションが即座に作成される
      if (data.session) {
        // 登録完了 → ホームへリダイレクト
        router.push('/');
      } else {
        // メール確認が必要な場合（確認メール送信画面を表示）
        setSuccess(true);
      }
    } catch (error) {
      console.error('予期しないエラー:', error);
      setError('登録に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      setIsLoading(true);
      setError('');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError('Googleでの登録に失敗しました。');
      }
    } catch (error) {
      setError('登録に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="max-w-sm mx-auto min-h-screen flex flex-col">
          <main className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="w-full text-center space-y-6">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-semibold">確認メールを送信しました</h1>
                <p className="text-sm text-muted-foreground">
                  {email} に確認メールを送信しました。
                  メール内のリンクをクリックして登録を完了してください。
                </p>
              </div>
              <Button
                size="lg"
                tone="primary"
                onClick={() => router.push('/login')}
                className="w-full"
              >
                ログイン画面へ
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-sm mx-auto min-h-screen flex flex-col">
        {/* ヘッダー */}
        <header className="p-4">
          <Link href="/login" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            ログインに戻る
          </Link>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-6">
          {/* ロゴ */}
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="h-16 w-16 rounded-xl bg-primary flex items-center justify-center shadow-card">
              <Leaf className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-semibold">新規登録</h1>
          </div>

          {/* エラーメッセージ */}
          {error && (
            <div className="w-full mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive text-center">{error}</p>
            </div>
          )}

          {/* 登録フォーム */}
          <form onSubmit={handleSignup} className="w-full space-y-4">
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
                  placeholder="8文字以上"
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
              {/* パスワード要件 */}
              <div className="mt-2 space-y-1">
                <div className={`flex items-center gap-2 text-xs ${passwordChecks.length ? 'text-green-600' : 'text-muted-foreground'}`}>
                  <Check className={`h-3 w-3 ${passwordChecks.length ? 'opacity-100' : 'opacity-30'}`} />
                  8文字以上
                </div>
                <div className={`flex items-center gap-2 text-xs ${passwordChecks.hasLetter ? 'text-green-600' : 'text-muted-foreground'}`}>
                  <Check className={`h-3 w-3 ${passwordChecks.hasLetter ? 'opacity-100' : 'opacity-30'}`} />
                  英字を含む
                </div>
                <div className={`flex items-center gap-2 text-xs ${passwordChecks.hasNumber ? 'text-green-600' : 'text-muted-foreground'}`}>
                  <Check className={`h-3 w-3 ${passwordChecks.hasNumber ? 'opacity-100' : 'opacity-30'}`} />
                  数字を含む
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                パスワード（確認）
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="パスワードを再入力"
                className="w-full h-11 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                disabled={isLoading}
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-destructive">パスワードが一致しません</p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              tone="primary"
              disabled={isLoading || !isPasswordValid}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full" />
                  登録中...
                </>
              ) : (
                '登録する'
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
              onClick={handleGoogleSignup}
              disabled={isLoading}
              className="w-full"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Googleで登録
            </Button>
          </form>

          {/* 法的事項 */}
          <p className="mt-4 text-xs text-center text-muted-foreground px-4 leading-relaxed">
            登録することで、
            <a href="#" className="text-primary hover:underline">利用規約</a>
            および
            <a href="#" className="text-primary hover:underline">プライバシーポリシー</a>
            に同意したものとみなされます。
          </p>
        </main>

        <footer className="p-6 text-center">
          <p className="text-xs text-foreground/60">
            © 2024 YUTAKA. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}


