import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ContentService } from './content.service';
import { ContentHubComponent } from './content-hub.component';
import { InterviewQuestion, Tutorial } from './content.models';
import { CategoryService } from '../quiz/services/category.service';
import { DataService } from '../services/data.service';
{
          provide: CategoryService,
          useValue: {
            getCategories: () => of([{
              name: 'Java',
              subCategories: ['Basics', 'Collections']
            }])
          }
        },
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
    fixture.componentInstance.changeView('questions');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Q-1');
expect(fixture.nativeElement.textContent).not.toContain('tutorials.json');
    expect(fixture.componentInstance.categories).toEqual(['Java']);
    expect(fixture.componentInstance.questionSubCategories).toEqual(['Basics', 'Collections']);
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

  it('tracks saved questions and marks a question view once per browser', async () => {
const fixture = TestBed.createComponent(ContentHubComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    await component.toggleQuestionBookmark(questions[0].id);
    expect(component.isQuestionBookmarked(questions[0].id)).toBeTrue();
    await component.markQuestionViewed(questions[0]);
    await component.markQuestionViewed(questions[0]);
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
