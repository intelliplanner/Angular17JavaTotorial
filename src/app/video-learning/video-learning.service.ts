import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { LearningCatalog, LearningCategory, LearningVideo } from './video-learning.models';

const ALLOWED_YOUTUBE_CHANNELS = new Set([
  'https://www.youtube.com/@Javatechie',
  'https://www.youtube.com/@ApnaCollegeOfficial'
]);

@Injectable({ providedIn: 'root' })
export class VideoLearningService {
  constructor(private readonly http: HttpClient) {}

  getCatalog(): Observable<LearningCatalog> {
    return forkJoin({
      categories: this.http.get<LearningCategory[]>('assets/data/learning-categories.json'),
      videos: this.http.get<LearningVideo[]>('assets/data/learning-videos.json')
    }).pipe(map(({ categories, videos }) => {
      if (!Array.isArray(categories) || !Array.isArray(videos)) {
        throw new Error('The learning catalog must contain category and video lists.');
      }

      const invalidCategory = categories.find(category =>
        !category || typeof category.name !== 'string' || !category.name.trim() ||
        typeof category.icon !== 'string' || typeof category.description !== 'string' ||
        typeof category.color !== 'string'
      );
      if (invalidCategory || new Set(categories.map(category => category.name)).size !== categories.length) {
        throw new Error('Learning categories must have unique names and complete display data.');
      }

      const categoryNames = new Set(categories.map(category => category.name));
      const invalidVideo = videos.find(video =>
        !video || typeof video.id !== 'string' || !video.id.trim() ||
        typeof video.title !== 'string' || !video.title.trim() ||
        typeof video.category !== 'string' || !categoryNames.has(video.category) ||
        typeof video.description !== 'string' || !video.description.trim() ||
        typeof video.channel !== 'string' || !video.channel.trim() ||
        typeof video.duration !== 'string' || !video.duration.trim() ||
        !['Beginner', 'Intermediate', 'Advanced'].includes(video.level) ||
        !Array.isArray(video.tags) || video.tags.some(tag => typeof tag !== 'string') ||
        !ALLOWED_YOUTUBE_CHANNELS.has(video.youtubeUrl)
      );
      if (invalidVideo) {
        throw new Error(`The learning video "${invalidVideo.id || 'unknown'}" has invalid or incomplete data.`);
      }
      if (new Set(videos.map(video => video.id)).size !== videos.length) {
        throw new Error('Learning video IDs must be unique.');
      }
      return { categories, videos };
    }));
  }
}
