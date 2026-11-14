export interface LearningCategory {
  name: string;
  icon: string;
  description: string;
  color: string;
}

export interface LearningVideo {
  id: string;
  title: string;
  category: string;
  subCategory: string;
  description: string;
  channel: string;
  duration: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  youtubeUrl: string;
  tags: string[];
}

export interface LearningCatalog {
  categories: LearningCategory[];
  videos: LearningVideo[];
}
