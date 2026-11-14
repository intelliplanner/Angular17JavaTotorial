export type ContentDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface Tutorial {
  id: string;
  title: string;
  category: string;
  subCategory: string;
  description: string;
  content: string;
  difficulty: ContentDifficulty;
  tags: string[];
  author: string;
  createdAt: string;
  updatedAt: string;
  published: boolean;
}

export interface InterviewQuestion {
  id: string;
  category: string;
  subCategory: string;
  question: string;
  answer: string;
  difficulty: ContentDifficulty;
  tags: string[];
  createdAt: string;
  likeCount: number;
  dislikeCount: number;
  viewCount: number;
}
