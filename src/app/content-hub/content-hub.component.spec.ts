import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ContentService } from './content.service';
import { ContentHubComponent } from './content-hub.component';
import { InterviewQuestion, Tutorial } from './content.models';

describe('ContentHubComponent', () => {
  let contentService: jasmine.SpyObj<ContentService>;
  let tutorials: Tutorial[];
  let questions: InterviewQuestion[];
  let adminRoute = false;

  beforeEach(async () => {
    localStorage.clear();
    adminRoute = false;
    tutorials = [{
      id: 'java-collections', title: 'Java Collections', category: 'Java', subCategory: 'Collections',
      description: 'Learn lists and maps.', content: 'Collections content', difficulty: 'Beginner',
      tags: ['Java'], author: 'Hub', createdAt: '2026-01-01', updatedAt: '2026-01-01', published: true
    }];
    questions = [{
      id: 'equals-contract', category: 'Java', subCategory: 'Collections',
      question: 'Explain equals and hashCode.', answer: 'Equal objects have the same hash code.',
      difficulty: 'Intermediate', tags: ['Java'], createdAt: '2026-01-01',
      likeCount: 2, dislikeCount: 0, viewCount: 5
    }];
    contentService = jasmine.createSpyObj<ContentService>('ContentService', [
      'getTutorials', 'getQuestions', 'createTutorial', 'updateTutorial', 'deleteTutorial',
      'createQuestion', 'updateQuestion', 'deleteQuestion'
    ]);
    contentService.getTutorials.and.returnValue(of(tutorials));
    contentService.getQuestions.and.returnValue(of(questions));

    await TestBed.configureTestingModule({
      imports: [ContentHubComponent],
      providers: [
        provideRouter([]),
        { provide: ContentService, useValue: contentService },
        {
          provide: ActivatedRoute,
          useValue: {
            get snapshot() {
              return {
                routeConfig: { path: adminRoute ? 'admin-panel' : 'tutorials' },
                queryParamMap: convertToParamMap({})
              };
            },
            queryParamMap: of(convertToParamMap({}))
          }
        }
      ]
    }).compileComponents();
  });

  it('loads published tutorials and interview questions', () => {
    const fixture = TestBed.createComponent(ContentHubComponent);
    fixture.detectChanges();

    expect(contentService.getTutorials).toHaveBeenCalledWith(false);
    expect(fixture.nativeElement.textContent).toContain('Java Collections');
    expect(fixture.componentInstance.filteredQuestions.length).toBe(1);
    expect(fixture.nativeElement.textContent).not.toContain('tutorials.json');
  });

  it('filters tutorials by search text and difficulty', () => {
    const fixture = TestBed.createComponent(ContentHubComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.searchText = 'maps';
    expect(component.filteredTutorials.length).toBe(1);
    component.selectedDifficulty = 'Advanced';
    expect(component.filteredTutorials.length).toBe(0);
  });

  it('tracks saved questions and marks a question view once per browser', () => {
    const fixture = TestBed.createComponent(ContentHubComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.toggleQuestionBookmark(questions[0].id);
    expect(component.isQuestionBookmarked(questions[0].id)).toBeTrue();
    component.markQuestionViewed(questions[0]);
    component.markQuestionViewed(questions[0]);
    expect(questions[0].viewCount).toBe(6);
  });

  it('shows the tutorials.json count but not quiz file counts in the admin panel', async () => {
    adminRoute = true;
    const fixture = TestBed.createComponent(ContentHubComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.tutorialJsonCount).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('tutorials.json');
    expect(fixture.nativeElement.textContent).toContain('1 tutorials');
    expect(fixture.nativeElement.textContent).not.toContain('Quiz question counts by JSON file');
    expect(fixture.nativeElement.textContent).not.toContain('java.json');
  });
});
