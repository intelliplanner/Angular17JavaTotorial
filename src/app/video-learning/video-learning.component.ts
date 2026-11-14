import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LearningCategory, LearningVideo } from './video-learning.models';
import { VideoLearningService } from './video-learning.service';

const BOOKMARKS_KEY = 'learning-video-bookmarks.v1';
const COMPLETED_KEY = 'learning-video-completed.v1';

@Component({
  selector: 'app-video-learning',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './video-learning.component.html'
})
export class VideoLearningComponent implements OnInit {
  categories: LearningCategory[] = [];
  videos: LearningVideo[] = [];
  selectedVideo: LearningVideo | null = null;
  selectedCategory = 'All';
  searchText = '';
  loading = true;
  errorMessage = '';
  private readonly bookmarks = this.readSet(BOOKMARKS_KEY);
  private readonly completed = this.readSet(COMPLETED_KEY);

  constructor(
    private readonly videoLearningService: VideoLearningService
  ) {}

  ngOnInit(): void {
    this.videoLearningService.getCatalog().subscribe({
      next: catalog => {
        this.categories = catalog.categories;
        this.videos = catalog.videos;
        this.selectedVideo = this.videos[0] ?? null;
        this.loading = false;
      },
      error: error => {
        this.errorMessage = error instanceof Error ? error.message : 'Could not load learning videos.';
        this.loading = false;
      }
    });
  }

  get filteredVideos(): LearningVideo[] {
    const search = this.searchText.trim().toLowerCase();
    return this.videos.filter(video =>
      (this.selectedCategory === 'All' || video.category === this.selectedCategory) &&
      (!search || [
        video.title, video.category, video.subCategory, video.description,
        video.channel, ...video.tags
      ].join(' ').toLowerCase().includes(search))
    );
  }

  get completedCount(): number {
    return this.videos.filter(video => this.completed.has(video.id)).length;
  }

  get bookmarkedCount(): number {
    return this.videos.filter(video => this.bookmarks.has(video.id)).length;
  }

  get progressPercent(): number {
    return this.videos.length ? Math.round(this.completedCount / this.videos.length * 100) : 0;
  }

  get selectedCategoryInfo(): LearningCategory | undefined {
    return this.categories.find(category => category.name === this.selectedCategory);
  }

  selectCategory(category: string): void {
    this.selectedCategory = category;
    const first = this.filteredVideos[0];
    if (first) this.selectedVideo = first;
  }

  categoryCount(category: string): number {
    return this.videos.filter(video => video.category === category).length;
  }

  categoryColor(category: string): string {
    return this.categories.find(item => item.name === category)?.color ?? '#263f50';
  }

  selectVideo(video: LearningVideo): void {
    this.selectedVideo = video;
  }

  selectNextVideo(): void {
    const playlist = this.filteredVideos;
    if (!playlist.length) return;
    const currentIndex = playlist.findIndex(video => video.id === this.selectedVideo?.id);
    this.selectedVideo = playlist[(currentIndex + 1 + playlist.length) % playlist.length];
  }

  toggleBookmark(video: LearningVideo): void {
    this.toggleSet(this.bookmarks, BOOKMARKS_KEY, video.id);
  }

  isBookmarked(video: LearningVideo): boolean {
    return this.bookmarks.has(video.id);
  }

  toggleCompleted(video: LearningVideo): void {
    this.toggleSet(this.completed, COMPLETED_KEY, video.id);
  }

  isCompleted(video: LearningVideo): boolean {
    return this.completed.has(video.id);
  }

  private readSet(key: string): Set<string> {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
      return Array.isArray(value) && value.every(item => typeof item === 'string')
        ? new Set(value)
        : new Set<string>();
    } catch (error) {
      console.error(`Could not read learning progress from ${key}:`, error);
      return new Set<string>();
    }
  }

  private toggleSet(set: Set<string>, key: string, value: string): void {
    if (set.has(value)) set.delete(value);
    else set.add(value);
    localStorage.setItem(key, JSON.stringify([...set]));
  }
}
