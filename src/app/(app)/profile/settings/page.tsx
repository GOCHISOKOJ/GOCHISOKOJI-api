'use client';

import React from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, LogOut, Trash2, User } from 'lucide-react';
import { Button } from '@/components/Button';
import Link from 'next/link';

type FontSize = 'small' | 'medium' | 'large';

export default function ProfileSettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [displayName, setDisplayName] = React.useState('');
  const [bio, setBio] = React.useState('');
  const [fontSize, setFontSize] = React.useState<FontSize>('medium');
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 初期データ読み込み
  React.useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login?next=/profile/settings');
          return;
        }
        
        setUserId(user.id);
        
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
          
        if (profile) {
          setAvatarUrl(profile.avatar_url);
          setDisplayName(profile.display_name || '');
          setBio(profile.bio || '');
        }
        
        // localStorageから文字サイズ設定を読み込み
        const savedFontSize = localStorage.getItem('fontSize') as FontSize;
        if (savedFontSize && ['small', 'medium', 'large'].includes(savedFontSize)) {
          setFontSize(savedFontSize);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        setError('プロフィールの読み込みに失敗しました。');
      } finally {
        setIsLoading(false);
      }
    }
    
    loadProfile();
  }, [supabase, router]);

  // アバター画像アップロード
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    
    // ファイルサイズチェック (2MB以下)
    if (file.size > 2 * 1024 * 1024) {
      setError('画像は2MB以下にしてください。');
      return;
    }
    
    // ファイル形式チェック
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setError('JPEG、PNG、GIF、WebP形式の画像を選択してください。');
      return;
    }
    
    try {
      setIsSaving(true);
      setError('');
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/avatar.${fileExt}`;
      
      // 古い画像を削除
      await supabase.storage.from('avatars').remove([`${userId}/avatar.png`, `${userId}/avatar.jpg`, `${userId}/avatar.jpeg`, `${userId}/avatar.gif`, `${userId}/avatar.webp`]);
      
      // 新しい画像をアップロード
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });
        
      if (uploadError) throw uploadError;
      
      // 公開URLを取得
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);
        
      // プロフィールを更新
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);
        
      if (updateError) throw updateError;
      
      setAvatarUrl(publicUrl);
      setSuccess('アイコンを更新しました。');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setError('アイコンのアップロードに失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  // プロフィール保存
  const handleSaveProfile = async () => {
    if (!userId) return;
    
    try {
      setIsSaving(true);
      setError('');
      
      const { error } = await supabase
        .from('users')
        .update({
          display_name: displayName.trim() || null,
          bio: bio.trim() || null,
        })
        .eq('id', userId);
        
      if (error) throw error;
      
      setSuccess('プロフィールを更新しました。');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      setError('プロフィールの保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  // 文字サイズ変更
  const handleFontSizeChange = (size: FontSize) => {
    setFontSize(size);
    localStorage.setItem('fontSize', size);
    
    // ルート要素にクラスを適用
    document.documentElement.classList.remove('font-small', 'font-medium', 'font-large');
    document.documentElement.classList.add(`font-${size}`);
    
    setSuccess('文字サイズを変更しました。');
    setTimeout(() => setSuccess(''), 3000);
  };

  // ログアウト
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      setError('ログアウトに失敗しました。');
    }
  };

  // アカウント削除
  const handleDeleteAccount = async () => {
    if (!userId) return;
    
    try {
      setIsDeleting(true);
      
      // ユーザーの投稿を削除
      await supabase.from('posts').delete().eq('user_id', userId);
      
      // ユーザーのいいねを削除
      await supabase.from('likes').delete().eq('user_id', userId);
      
      // アバター画像を削除
      await supabase.storage.from('avatars').remove([`${userId}/avatar.png`, `${userId}/avatar.jpg`, `${userId}/avatar.jpeg`, `${userId}/avatar.gif`, `${userId}/avatar.webp`]);
      
      // ユーザープロフィールを削除
      await supabase.from('users').delete().eq('id', userId);
      
      // 認証ユーザーを削除（サインアウト）
      await supabase.auth.signOut();
      
      router.push('/login');
    } catch (error) {
      console.error('Error deleting account:', error);
      setError('アカウントの削除に失敗しました。');
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[375px] mx-auto relative min-h-screen flex flex-col">
        {/* ヘッダー */}
        <header className="sticky top-0 z-10 bg-background border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/profile" className="flex items-center gap-2 text-sm text-foreground hover:text-foreground/80">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-base font-semibold">設定</h1>
            <div className="w-5" /> {/* スペーサー */}
          </div>
        </header>

        <main className="flex-1 p-4 space-y-6 pb-20">
          {/* エラー・成功メッセージ */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-100 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {/* アバター */}
          <section className="space-y-2">
            <label className="text-xs font-medium text-foreground">プロフィール画像</label>
            <div className="flex items-center gap-4">
              <div 
                className="relative h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt="アバター"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="h-10 w-10 text-primary" />
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSaving}
                  className="text-sm text-primary hover:underline"
                >
                  画像を変更
                </button>
                <p className="text-xs text-muted-foreground mt-1">
                  JPEG、PNG、GIF、WebP（2MB以下）
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
          </section>

          {/* 表示名 */}
          <section className="space-y-2">
            <label className="text-xs font-medium text-foreground">表示名</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="表示名を入力"
              maxLength={50}
              className="w-full h-11 px-3 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </section>

          {/* 自己紹介 */}
          <section className="space-y-2">
            <label className="text-xs font-medium text-foreground">自己紹介</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="自己紹介を入力"
              maxLength={200}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{bio.length}/200</p>
          </section>

          {/* 文字の大きさ */}
          <section className="space-y-2">
            <label className="text-xs font-medium text-foreground">文字の大きさ</label>
            <div className="flex gap-2">
              {([
                { id: 'small', label: '小' },
                { id: 'medium', label: '中' },
                { id: 'large', label: '大' },
              ] as const).map((size) => (
                <button
                  key={size.id}
                  onClick={() => handleFontSizeChange(size.id)}
                  className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${
                    fontSize === size.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-surface text-foreground border-border hover:bg-muted'
                  }`}
                >
                  {size.label}
                </button>
              ))}
            </div>
          </section>

          {/* 保存ボタン */}
          <Button
            size="lg"
            tone="primary"
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="w-full"
          >
            {isSaving ? '保存中...' : '変更を保存'}
          </Button>

          <hr className="border-border" />

          {/* ログアウト */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-lg border border-border bg-surface text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="h-4 w-4" />
            ログアウト
          </button>

          {/* アカウント削除 */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            アカウントを削除
          </button>

          {/* フッター */}
          <div className="pt-8 pb-4 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              <a href="/terms" className="hover:text-foreground hover:underline transition-colors">
                利用規約
              </a>
              <span className="mx-3">|</span>
              <a href="/privacy" className="hover:text-foreground hover:underline transition-colors">
                プライバシーポリシー
              </a>
            </p>
            <p className="text-xs text-muted-foreground/60">
              © 2025 GOCHISOKOJI
            </p>
          </div>
        </main>

        {/* 削除確認モーダル */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-xl p-6 max-w-sm w-full space-y-4">
              <h2 className="text-lg font-semibold text-foreground">アカウントを削除しますか？</h2>
              <p className="text-sm text-muted-foreground">
                この操作は取り消せません。すべての投稿、保存したレシピ、プロフィール情報が削除されます。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 h-11 rounded-lg border border-border bg-surface text-foreground hover:bg-muted transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  className="flex-1 h-11 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                >
                  {isDeleting ? '削除中...' : '削除する'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


