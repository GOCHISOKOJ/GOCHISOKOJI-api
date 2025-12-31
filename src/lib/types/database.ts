// データベースの型定義

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: UserInsert;
        Update: UserUpdate;
      };
      posts: {
        Row: Post;
        Insert: PostInsert;
        Update: PostUpdate;
      };
      likes: {
        Row: Like;
        Insert: LikeInsert;
        Update: LikeUpdate;
      };
      views: {
        Row: View;
        Insert: ViewInsert;
        Update: ViewUpdate;
      };
    };
  };
}

// ユーザー型
export interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserInsert {
  id: string;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
}

export interface UserUpdate {
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
}

// レシピ投稿型
export interface Post {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  koji_type: string;
  fermentation_time: string | null;
  difficulty: string | null;
  ingredients: Ingredient[] | null;
  steps: Step[] | null;
  image_url: string | null;
  is_public: boolean;
  is_ai_generated: boolean;
  view_count: number;
  like_count: number;
  created_at: string;
  updated_at: string;
}

export interface PostInsert {
  user_id: string;
  title: string;
  description?: string | null;
  koji_type: string;
  fermentation_time?: string | null;
  difficulty?: string | null;
  ingredients?: Ingredient[] | null;
  steps?: Step[] | null;
  image_url?: string | null;
  is_public?: boolean;
  is_ai_generated?: boolean;
}

export interface PostUpdate {
  title?: string;
  description?: string | null;
  koji_type?: string;
  fermentation_time?: string | null;
  difficulty?: string | null;
  ingredients?: Ingredient[] | null;
  steps?: Step[] | null;
  image_url?: string | null;
  is_public?: boolean;
}

// 材料型
export interface Ingredient {
  name: string;
  amount: string;
}

// 手順型
export interface Step {
  order: number;
  description: string;
  image_url?: string | null;
}

// お気に入り型
export interface Like {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface LikeInsert {
  user_id: string;
  post_id: string;
}

export interface LikeUpdate {
  // likesテーブルは更新しない
}

// ビュー（PV）型
export interface View {
  id: string;
  post_id: string;
  user_id: string | null;
  session_id: string | null;
  created_at: string;
}

export interface ViewInsert {
  post_id: string;
  user_id?: string | null;
  session_id?: string | null;
}

export interface ViewUpdate {
  // viewsテーブルは更新しない
}

// 投稿 + ユーザー情報（結合クエリ用）
export interface PostWithUser extends Post {
  user: User;
}

// 投稿 + お気に入り状態
export interface PostWithLikeStatus extends Post {
  user: User;
  is_liked: boolean;
}







