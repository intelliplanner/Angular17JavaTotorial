import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { LearningCategory, LearningVideo } from './video-learning.models';
import { VideoLearningService } from './video-learning.service';

describe('VideoLearningService', () => {
  let service: VideoLearningService;
  let http: HttpTestingController;

  const categories: LearningCategory[] = [{
    name: 'Java',
    subCategories: ['Core Java'],
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
    channel: 'JavaTechie',
    duration: 'CHANNEL',
    level: 'Beginner',
    youtubeUrl: 'https://www.youtube.com/@Javatechie',
    tags: ['Java']
  }];
  let originalProduction: boolean;
  let originalAuthApiUrl: string;

  beforeEach(() => {
    originalProduction = environment.production;
    originalAuthApiUrl = environment.authApiUrl;
    environment.production = true;
    environment.authApiUrl = '';
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(VideoLearningService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    environment.production = originalProduction;
    environment.authApiUrl = originalAuthApiUrl;
  });

  it('loads category and video catalogs from the JSON assets', () => {
    let result: LearningVideo[] = [];

    service.getCatalog().subscribe(catalog => result = catalog.videos);

    http.expectOne('assets/data/topic_categories.json').flush(categories);
    http.expectOne('assets/data/learning-videos.json').flush(videos);
    expect(result).toEqual(videos);
  });

  it('accepts a YouTube video URL for an approved channel', () => {
    let result: LearningVideo[] = [];

    service.getCatalog().subscribe(catalog => result = catalog.videos);

    http.expectOne('assets/data/topic_categories.json').flush(categories);
    http.expectOne('assets/data/learning-videos.json').flush([
      { ...videos[0], youtubeUrl: 'https://www.youtube.com/watch?v=FFfJeb8Ec6Y&t=156s' }
    ]);
    expect(result.length).toBe(1);
  });

  it('rejects YouTube links outside the configured channels and URL formats', () => {
    let error = '';

    service.getCatalog().subscribe({
      error: value => error = value.message
    });

    http.expectOne('assets/data/topic_categories.json').flush(categories);
    http.expectOne('assets/data/learning-videos.json').flush([
      { ...videos[0], youtubeUrl: 'https://youtube.example/watch?v=eIrMbAQSU34' }
    ]);
    expect(error).toContain('invalid or incomplete data');
  });

  it('rejects links whose video is not associated with a configured channel', () => {
    let error = '';

    service.getCatalog().subscribe({
      error: value => error = value.message
    });

    http.expectOne('assets/data/topic_categories.json').flush(categories);
    http.expectOne('assets/data/learning-videos.json').flush([
      { ...videos[0], channel: 'Unknown Channel' }
    ]);
    expect(error).toContain('invalid or incomplete data');
  });
});
