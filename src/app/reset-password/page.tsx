'use client';

import React from 'react';
import { Button } from '@/components/Button';
import { Leaf, ArrowLeft, Check, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState(false);
  
  // パスワード更新モード（リセットリンクからのアクセス時）
  const [isUpdateMode, setIsUpdateMode] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [updateSuccess, setUpdateSuccess] = React.useState(false);
  
  const supabase = createClient();

  // URLにアクセストークンがある場合はパスワード更新モードに
  React.useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      // パスワードリセットのトークンがある場合
      if (session?.user && window.location.hash.includes('type=recovery')) {
        setIsUpdateMode(true);
      }
    };
    checkSession();
  }, [supabase]);

  const passwordChecks = {
    length: newPassword.length >= 8,
    hasNumber: /\d/.test(newPassword),
    hasLetter: /[a-zA-Z]/.test(newPassword),
  };
  const isPasswordValid = passwordChecks.length && passwordChecks.hasNumber && passwordChecks.hasLetter;

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('メールアドレスを入力してください。');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setError('メール送信に失敗しました。もう一度お試しください。');
        return;
      }

      setSuccess(true);
    } catch (error) {
      console.error('予期しないエラー:', error);
      setError('メール送信に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordValid) {
      setError('パスワードの要件を満たしていません。');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('パスワードが一致しません。');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setError('パスワードの更新に失敗しました。');
        return;
      }

      setUpdateSuccess(true);
    } catch (error) {
      console.error('予期しないエラー:', error);
      setError('パスワードの更新に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // パスワード更新成功
  if (updateSuccess) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="max-w-sm mx-auto min-h-screen flex flex-col">
          <main className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="w-full text-center space-y-6">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-semibold">パスワードを更新しました</h1>
                <p className="text-sm text-muted-foreground">
                  新しいパスワードでログインできます。
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

  // パスワード更新モード
  if (isUpdateMode) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="max-w-sm mx-auto min-h-screen flex flex-col">
          <main className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="flex flex-col items-center gap-3 mb-6">
              <div className="h-16 w-16 rounded-xl bg-primary flex items-center justify-center shadow-card">
                <Leaf className="h-8 w-8 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-semibold">新しいパスワードを設定</h1>
            </div>

            {error && (
              <div className="w-full mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive text-center">{error}</p>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="w-full space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  新しいパスワード
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
                {confirmPassword && newPassword !== confirmPassword && (
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
                    更新中...
                  </>
                ) : (
                  'パスワードを更新'
                )}
              </Button>
            </form>
          </main>
        </div>
      </div>
    );
  }

  // メール送信成功
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
                <h1 className="text-xl font-semibold">メールを送信しました</h1>
                <p className="text-sm text-muted-foreground">
                  {email} にパスワードリセット用のリンクを送信しました。
                  メールをご確認ください。
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

  // メール入力フォーム
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-sm mx-auto min-h-screen flex flex-col">
        <header className="p-4">
          <Link href="/login" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            ログインに戻る
          </Link>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="h-16 w-16 rounded-xl bg-primary flex items-center justify-center shadow-card">
              <Leaf className="h-8 w-8 text-primary-foreground" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-semibold">パスワードをリセット</h1>
              <p className="text-sm text-muted-foreground mt-1">
                登録したメールアドレスにリセット用のリンクを送信します
              </p>
            </div>
          </div>

          {error && (
            <div className="w-full mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive text-center">{error}</p>
            </div>
          )}

          <form onSubmit={handleSendResetEmail} className="w-full space-y-4">
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

            <Button
              type="submit"
              size="lg"
              tone="primary"
              disabled={isLoading || !email}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full" />
                  送信中...
                </>
              ) : (
                'リセットリンクを送信'
              )}
            </Button>
          </form>
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


