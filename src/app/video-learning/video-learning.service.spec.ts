import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LearningCategory, LearningVideo } from './video-learning.models';
import { VideoLearningService } from './video-learning.service';

describe('VideoLearningService', () => {
  let service: VideoLearningService;
  let http: HttpTestingController;

  const categories: LearningCategory[] = [{
    name: 'Java',
    icon: 'fa-brands fa-java',
    description: 'Java lessons',
    color: '#e76f00'
  }];
  const videos: LearningVideo[] = [{
    id: 'java-course',
    title: 'Java Course',
    category: 'Java',
    subCategory: 'Core Java',
    description: 'Learn Java.',
    channel: 'Example Channel',
    duration: 'CHANNEL',
    level: 'Beginner',
    youtubeUrl: 'https://www.youtube.com/@Javatechie',
    tags: ['Java']
  }];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(VideoLearningService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads category and video catalogs from the JSON assets', () => {
    let result: LearningVideo[] = [];

    service.getCatalog().subscribe(catalog => result = catalog.videos);

    http.expectOne('assets/data/learning-categories.json').flush(categories);
    http.expectOne('assets/data/learning-videos.json').flush(videos);
    expect(result).toEqual(videos);
  });

  it('rejects YouTube links outside the configured channels', () => {
    let error = '';

    service.getCatalog().subscribe({
      error: value => error = value.message
    });

    http.expectOne('assets/data/learning-categories.json').flush(categories);
    http.expectOne('assets/data/learning-videos.json').flush([
      { ...videos[0], youtubeUrl: 'https://www.youtube.com/watch?v=otherVideo1' }
    ]);
    expect(error).toContain('invalid or incomplete data');
  });
});
