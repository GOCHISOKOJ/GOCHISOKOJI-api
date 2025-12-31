'use client';

import React from 'react';
import { Button } from '@/components/Button';
import { Plus, X } from 'lucide-react';
import type { Ingredient, Step } from '@/lib/types/database';

interface PostFormProps {
  onSubmit: (data: PostFormData) => Promise<void>;
  onSaveDraft?: (data: PostFormData) => Promise<void>;
  initialData?: Partial<PostFormData>;
  isSubmitting?: boolean;
  isSavingDraft?: boolean;
  submitLabel?: string;
  submittingLabel?: string;
}

export interface PostFormData {
  title: string;
  description: string;
  koji_type: string;
  difficulty: string;
  ingredients: Ingredient[];
  steps: Step[];
  image_url?: string | null;
  imageFile?: File | null;
}

export function PostForm({
  onSubmit,
  onSaveDraft,
  initialData,
  isSubmitting = false,
  isSavingDraft = false,
  submitLabel = '投稿する',
  submittingLabel = '投稿中...',
}: PostFormProps) {
  const [formData, setFormData] = React.useState<PostFormData>({
    title: initialData?.title || '',
    description: initialData?.description || '',
    koji_type: initialData?.koji_type || '中華麹',
    difficulty: initialData?.difficulty || 'かんたん',
    ingredients: initialData?.ingredients || [{ name: '', amount: '' }],
    steps: initialData?.steps || [{ order: 1, description: '' }],
    image_url: initialData?.image_url ?? null,
    imageFile: null,
  });

  const [imagePreviewUrl, setImagePreviewUrl] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const buildCleanData = (): PostFormData => {
    const validIngredients = formData.ingredients.filter((i) => i.name.trim() && i.amount.trim());
    const validSteps = formData.steps
      .filter((s) => s.description.trim())
      .map((s, index) => ({ ...s, order: index + 1 }));

    return {
      ...formData,
      ingredients: validIngredients,
      steps: validSteps,
      imageFile: formData.imageFile ?? null,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('タイトルを入力してください');
      return;
    }

    await onSubmit(buildCleanData());
  };

  const handleSaveDraft = async () => {
    if (!onSaveDraft) return;
    if (!formData.title.trim()) {
      alert('下書きを保存するにはタイトルを入力してください');
      return;
    }
    await onSaveDraft(buildCleanData());
  };

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (file: File | null) => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);

    if (!file) {
      setImagePreviewUrl(null);
      setFormData((prev) => ({ ...prev, imageFile: null }));
      return;
    }

    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
    setFormData((prev) => ({ ...prev, imageFile: file }));
  };

  const handleRemoveImage = () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    setFormData((prev) => ({ ...prev, imageFile: null, image_url: null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addIngredient = () => {
    setFormData(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { name: '', amount: '' }],
    }));
  };

  const removeIngredient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  };

  const updateIngredient = (index: number, field: 'name' | 'amount', value: string) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) =>
        i === index ? { ...ing, [field]: value } : ing
      ),
    }));
  };

  const addStep = () => {
    setFormData(prev => ({
      ...prev,
      steps: [...prev.steps, { order: prev.steps.length + 1, description: '' }],
    }));
  };

  const removeStep = (index: number) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 })),
    }));
  };

  const updateStep = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.map((step, i) =>
        i === index ? { ...step, description: value } : step
      ),
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-4">
      {/* 写真（任意） */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">写真（任意）</label>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="aspect-video bg-muted flex items-center justify-center">
            {imagePreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagePreviewUrl} alt="プレビュー" className="h-full w-full object-cover" />
            ) : formData.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={formData.image_url} alt="写真" className="h-full w-full object-cover" />
            ) : (
              <div className="text-sm text-muted-foreground">写真を追加すると見栄えが良くなります</div>
            )}
          </div>
          <div className="p-3 flex items-center justify-between gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
            />
            <Button type="button" tone="secondary" onClick={handlePickImage} className="flex-1">
              写真を選択
            </Button>
            <Button
              type="button"
              tone="secondary"
              onClick={handleRemoveImage}
              disabled={!imagePreviewUrl && !formData.image_url}
              className="shrink-0"
            >
              削除
            </Button>
          </div>
        </div>
      </div>

      {/* タイトル */}
      <div>
        <label className="block text-sm font-medium mb-2">
          タイトル <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="例: 基本の塩麹"
          className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          required
        />
      </div>

      {/* 説明 */}
      <div>
        <label className="block text-sm font-medium mb-2">説明</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="このレシピについて説明してください"
          rows={3}
          className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>

      {/* 麹の種類 */}
      <div>
        <label className="block text-sm font-medium mb-2">
          麹の種類 <span className="text-destructive">*</span>
        </label>
        <select
          value={formData.koji_type}
          onChange={(e) => setFormData(prev => ({ ...prev, koji_type: e.target.value }))}
          className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="中華麹">中華風こうじ調味料</option>
          <option value="コンソメ麹">コンソメ風こうじ調味料</option>
          <option value="たまねぎ麹">旨塩風こうじ調味料</option>
        </select>
      </div>

      {/* 難易度 */}
      <div>
        <label className="block text-sm font-medium mb-2">難易度</label>
        <select
          value={formData.difficulty}
          onChange={(e) => setFormData(prev => ({ ...prev, difficulty: e.target.value }))}
          className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="かんたん">かんたん</option>
          <option value="ふつう">ふつう</option>
          <option value="むずかしい">むずかしい</option>
        </select>
      </div>

      {/* 材料 */}
      <div>
        <label className="block text-sm font-medium mb-2">材料</label>
        <div className="space-y-2">
          {formData.ingredients.map((ingredient, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={ingredient.name}
                onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                placeholder="材料名"
                className="flex-1 px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="text"
                value={ingredient.amount}
                onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
                placeholder="分量"
                className="w-24 px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {formData.ingredients.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeIngredient(index)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  aria-label="削除"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addIngredient}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Plus className="h-4 w-4" />
            材料を追加
          </button>
        </div>
      </div>

      {/* 手順 */}
      <div>
        <label className="block text-sm font-medium mb-2">作り方</label>
        <div className="space-y-3">
          {formData.steps.map((step, index) => (
            <div key={index} className="flex gap-2">
              <span className="flex-shrink-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium mt-1">
                {index + 1}
              </span>
              <textarea
                value={step.description}
                onChange={(e) => updateStep(index, e.target.value)}
                placeholder={`手順${index + 1}`}
                rows={2}
                className="flex-1 px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
              {formData.steps.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeStep(index)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors self-start"
                  aria-label="削除"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addStep}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Plus className="h-4 w-4" />
            手順を追加
          </button>
        </div>
      </div>

      {/* アクション */}
      <div className="pt-4">
        {onSaveDraft ? (
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              size="lg"
              tone="secondary"
              disabled={isSubmitting || isSavingDraft}
              className="w-full"
              onClick={handleSaveDraft}
            >
              {isSavingDraft ? '保存中...' : '下書き保存'}
            </Button>
            <Button
              type="submit"
              size="lg"
              tone="primary"
              disabled={isSubmitting || isSavingDraft}
              className="w-full"
            >
              {isSubmitting ? submittingLabel : submitLabel}
            </Button>
          </div>
        ) : (
          <Button
            type="submit"
            size="lg"
            tone="primary"
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? submittingLabel : submitLabel}
          </Button>
        )}
      </div>
    </form>
  );
}


