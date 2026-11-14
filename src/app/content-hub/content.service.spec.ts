import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { ContentService } from './content.service';
import { InterviewQuestion, Tutorial } from './content.models';

describe('ContentService', () => {
  let service: ContentService;
  let http: HttpTestingController;
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
    service = TestBed.inject(ContentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    environment.production = originalProduction;
    environment.authApiUrl = originalAuthApiUrl;
  });

  it('loads published tutorials from bundled JSON when no backend is configured', () => {
    const tutorials: Tutorial[] = [
      { id: 'published', title: 'Published', published: true } as Tutorial,
      { id: 'draft', title: 'Draft', published: false } as Tutorial
    ];
    let result: Tutorial[] = [];

    service.getTutorials().subscribe(items => result = items);

    const request = http.expectOne('assets/data/tutorials.json');
    request.flush(tutorials);
    expect(result.map(item => item.id)).toEqual(['published']);
  });

  it('loads bundled interview questions when no backend is configured', () => {
    const questions: InterviewQuestion[] = [];

    service.getQuestions().subscribe(items => questions.push(...items));

    const request = http.expectOne('assets/data/questions-and-answers.json');
    request.flush([]);
    expect(questions).toEqual([]);
  });
});
