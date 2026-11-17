import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InterviewQuestion, ContentDifficulty, Tutorial } from './content.models';
import { ContentService } from './content.service';
import { CategoryService } from '../quiz/services/category.service';
import { QuizCategory } from '../quiz/models/category';
import { DataRecord, DataService } from '../services/data.service';

type HubView = 'tutorials' | 'questions';
type Vote = 'like' | 'dislike';

interface TutorialDraft {
  title: string;
  category: string;
  subCategory: string;
  description: string;
  content: string;
  difficulty: ContentDifficulty;
  tags: string;
  published: boolean;
}

interface QuestionDraft {
  category: string;
  subCategory: string;
  question: string;
  answer: string;
  difficulty: ContentDifficulty;
  tags: string;
}

const emptyTutorial: TutorialDraft = {
  title: '', category: 'Java', subCategory: 'Basics', description: '', content: '',
  difficulty: 'Beginner', tags: '', published: false
};
const emptyQuestion: QuestionDraft = {
  category: 'Java', subCategory: 'Basics', question: '', answer: '',
  difficulty: 'Beginner', tags: ''
};

@Component({
  selector: 'app-content-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './content-hub.component.html'
})
export class ContentHubComponent implements OnInit {
  categories: string[] = [];
  categoryTopics: Record<string, string[]> = {};
  readonly difficulties: ContentDifficulty[] = ['Beginner', 'Intermediate', 'Advanced'];
  readonly isAdminPanel: boolean;
  view: HubView = 'tutorials';
  tutorials: Tutorial[] = [];
  questions: InterviewQuestion[] = [];
  selectedTutorial: Tutorial | null = null;
  searchText = '';
  selectedCategory = '';
  selectedSubCategory = '';
  selectedDifficulty = '';
  showAnswer: Record<string, boolean> = {};
  bookmarkedTutorials = this.readStringSet('hub-tutorial-bookmarks');
  bookmarkedQuestions = this.readStringSet('hub-question-bookmarks');
  readTutorials = this.readStringSet('hub-read-tutorials');
  votes = this.readVotes();
  notification = '';
  loading = true;
  tutorialDraft: TutorialDraft = { ...emptyTutorial };
  questionDraft: QuestionDraft = { ...emptyQuestion };
  editingTutorialId: string | null = null;
  editingQuestionId: string | null = null;
  tutorialSearch = '';
  questionSearch = '';
  tutorialCategoryFilter = '';
  questionCategoryFilter = '';

  constructor(
    private readonly contentService: ContentService,
    private readonly categoryService: CategoryService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly dataService: DataService
  ) {
    this.isAdminPanel = this.route.snapshot.routeConfig?.path === 'admin-panel';
    this.route.queryParamMap.subscribe(params => {
      this.view = params.get('view') === 'questions' ? 'questions' : 'tutorials';
      this.applyDeepLink(params.get('tutorial'), params.get('question'));
    });
  }

  async ngOnInit(): Promise<void> {
    if (this.dataService.isFirebaseEnabled()) {
      try {
        await this.loadFirebaseSettings();
      } catch (error) {
        this.loading = false;
        this.handleError('Could not load user settings from Firebase', error);
        return;
      }
    }
    this.categoryService.getCategories().subscribe({
      next: categories => {
        this.setCategories(categories);
        this.loadContent();
      },
      error: error => {
        this.loading = false;
        this.handleError('Could not load topic categories', error);
      }
    });
  }

  get subCategories(): string[] {
    return this.categoryTopics[this.selectedCategory] ?? [];
  }

  get tutorialSubCategories(): string[] {
    return this.selectedTutorial ? this.categoryTopics[this.selectedTutorial.category] ?? [] : [];
  }

  get questionSubCategories(): string[] {
    return this.categoryTopics[this.questionDraft.category] ?? [];
  }

  get filteredTutorials(): Tutorial[] {
    const search = this.searchText.trim().toLowerCase();
    return this.tutorials.filter(tutorial =>
      tutorial.published &&
      (!this.selectedCategory || tutorial.category === this.selectedCategory) &&
      (!this.selectedSubCategory || tutorial.subCategory === this.selectedSubCategory) &&
      (!this.selectedDifficulty || tutorial.difficulty === this.selectedDifficulty) &&
      (!search || `${tutorial.title} ${tutorial.description} ${tutorial.category} ${tutorial.subCategory} ${tutorial.tags.join(' ')}`.toLowerCase().includes(search))
    );
  }

  get filteredQuestions(): InterviewQuestion[] {
    const search = this.searchText.trim().toLowerCase();
    return this.questions.filter(question =>
      (!this.selectedCategory || question.category === this.selectedCategory) &&
      (!this.selectedSubCategory || question.subCategory === this.selectedSubCategory) &&
      (!this.selectedDifficulty || question.difficulty === this.selectedDifficulty) &&
      (!search || `${question.question} ${question.answer} ${question.category} ${question.subCategory} ${question.tags.join(' ')}`.toLowerCase().includes(search))
    );
  }

  get adminTutorials(): Tutorial[] {
    const search = this.tutorialSearch.trim().toLowerCase();
    return this.tutorials.filter(item =>
      (!this.tutorialCategoryFilter || item.category === this.tutorialCategoryFilter) &&
      (!search || `${item.title} ${item.subCategory} ${item.tags.join(' ')}`.toLowerCase().includes(search))
    );
  }

  get adminQuestions(): InterviewQuestion[] {
    const search = this.questionSearch.trim().toLowerCase();
    return this.questions.filter(item =>
      (!this.questionCategoryFilter || item.category === this.questionCategoryFilter) &&
      (!search || `${item.question} ${item.subCategory} ${item.tags.join(' ')}`.toLowerCase().includes(search))
    );
  }

  get relatedTutorials(): Tutorial[] {
    if (!this.selectedTutorial) return [];
    return this.tutorials.filter(item => item.published &&
      item.category === this.selectedTutorial?.category && item.id !== this.selectedTutorial?.id).slice(0, 3);
  }

  get selectedTutorialIndex(): number {
    return this.filteredTutorials.findIndex(item => item.id === this.selectedTutorial?.id);
  }

  get completedTutorialCount(): number {
    return this.tutorials.filter(item => item.published && this.readTutorials.has(item.id)).length;
  }

  get publishedTutorialCount(): number {
    return this.tutorials.filter(item => item.published).length;
  }

  get tutorialJsonCount(): number {
    return this.tutorials.length;
  }

  changeView(view: HubView): void {
    this.view = view;
    this.selectedTutorial = null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        view: view === 'questions' ? 'questions' : null,
        tutorial: null,
        question: null
      },
      queryParamsHandling: 'merge'
    });
  }

  selectCategory(category: string): void {
    this.selectedCategory = category;
    this.selectedSubCategory = '';
  }

  openTutorial(tutorial: Tutorial): void {
    this.selectedTutorial = tutorial;
    this.searchText = '';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: null, tutorial: tutorial.id, question: null },
      queryParamsHandling: 'merge'
    });
  }

  backToTutorials(): void {
    this.selectedTutorial = null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tutorial: null },
      queryParamsHandling: 'merge'
    });
  }

  goToTutorial(offset: number): void {
    const target = this.filteredTutorials[this.selectedTutorialIndex + offset];
    if (target) this.openTutorial(target);
  }

  async markTutorialRead(tutorial: Tutorial): Promise<void> {
    await this.toggleSet(this.readTutorials, tutorial.id, 'hub-read-tutorials');
  }

  isTutorialRead(id: string): boolean {
    return this.readTutorials.has(id);
  }

  isTutorialBookmarked(id: string): boolean {
    return this.bookmarkedTutorials.has(id);
  }

  isQuestionBookmarked(id: string): boolean {
    return this.bookmarkedQuestions.has(id);
  }

  async toggleTutorialBookmark(id: string): Promise<void> {
    await this.toggleSet(this.bookmarkedTutorials, id, 'hub-tutorial-bookmarks');
  }

  async toggleQuestionBookmark(id: string): Promise<void> {
    await this.toggleSet(this.bookmarkedQuestions, id, 'hub-question-bookmarks');
  }

  async vote(question: InterviewQuestion, vote: Vote): Promise<void> {
    const current = this.votes[question.id];
    const updated = { ...this.votes, [question.id]: current === vote ? null : vote };
    try {
      await this.persist('hub-question-votes', updated);
    } catch {
      return;
    }
    this.votes = updated;
  }

  voteCount(question: InterviewQuestion, vote: Vote): number {
    const selected = this.votes[question.id];
    const count = vote === 'like' ? question.likeCount : question.dislikeCount;
    return count + (selected === vote ? 1 : 0);
  }

  async markQuestionViewed(question: InterviewQuestion): Promise<void> {
    if (!this.showAnswer[question.id]) {
      const viewed = this.readStringSet('hub-viewed-questions');
      if (!viewed.has(question.id)) {
        viewed.add(question.id);
        try {
          await this.persist('hub-viewed-questions', [...viewed]);
        } catch {
          this.showAnswer[question.id] = !this.showAnswer[question.id];
          return;
        }
        question.viewCount += 1;
      }
    }
    this.showAnswer[question.id] = !this.showAnswer[question.id];
  }

  copyQuestion(question: InterviewQuestion): void {
    if (!navigator.clipboard?.writeText) {
      this.notify('Clipboard access is unavailable in this browser.', true);
      return;
    }
    navigator.clipboard.writeText(question.question).then(
      () => this.notify('Question copied to clipboard.'),
      error => {
        console.error('Could not copy question:', error);
        this.notify('Could not copy the question. Check browser clipboard permissions.', true);
      }
    );
  }

  shareTutorial(tutorial: Tutorial): void {
    this.shareUrl(this.sharePath('/tutorials', { tutorial: tutorial.id }), tutorial.title);
  }

  shareQuestion(question: InterviewQuestion): void {
    this.shareUrl(this.sharePath('/tutorials', { view: 'questions', question: question.id }), question.question);
  }

  private shareUrl(url: string, title: string): void {
    if (navigator.share) {
      navigator.share({ title, url }).catch(error => {
        if (error?.name !== 'AbortError') {
          console.error('Could not share content:', error);
          this.notify('Sharing is unavailable. Try copying the page URL.', true);
        }
      });
      return;
    }
    if (!navigator.clipboard?.writeText) {
      this.notify('Sharing and clipboard access are unavailable in this browser.', true);
      return;
    }
    navigator.clipboard.writeText(url).then(
      () => this.notify('Link copied to clipboard.'),
      error => {
        console.error('Could not copy share link:', error);
        this.notify('Could not copy the link. Check browser clipboard permissions.', true);
      }
    );
  }

  private sharePath(path: string, queryParams: Record<string, string>): string {
    const appUrl = this.router.serializeUrl(this.router.createUrlTree([path], { queryParams }));
    return `${window.location.origin}${window.location.pathname}#${appUrl}`;
  }

  editTutorial(tutorial: Tutorial): void {
    this.editingTutorialId = tutorial.id;
    this.tutorialDraft = { ...tutorial, tags: tutorial.tags.join(', ') };
  }

  resetTutorialForm(): void {
    this.editingTutorialId = null;
    this.tutorialDraft = { ...emptyTutorial };
  }

  saveTutorial(): void {
    const draft = this.tutorialPayload();
    const request = this.editingTutorialId
      ? this.contentService.updateTutorial(this.editingTutorialId, draft)
      : this.contentService.createTutorial(draft);
    request.subscribe({
      next: saved => {
        this.upsertTutorial(saved);
        this.notify(this.editingTutorialId ? 'Tutorial updated.' : 'Tutorial created.');
        this.resetTutorialForm();
      },
      error: error => this.handleError('Could not save the tutorial', error)
    });
  }

  deleteTutorial(tutorial: Tutorial): void {
    if (!window.confirm(`Delete "${tutorial.title}"? This cannot be undone.`)) return;
    this.contentService.deleteTutorial(tutorial.id).subscribe({
      next: () => {
        this.tutorials = this.tutorials.filter(item => item.id !== tutorial.id);
        this.notify('Tutorial deleted.');
      },
      error: error => this.handleError('Could not delete the tutorial', error)
    });
  }

  togglePublished(tutorial: Tutorial): void {
    this.contentService.updateTutorial(tutorial.id, { published: !tutorial.published }).subscribe({
      next: saved => {
        this.upsertTutorial(saved);
        this.notify(saved.published ? 'Tutorial published.' : 'Tutorial moved to draft.');
      },
      error: error => this.handleError('Could not update publish status', error)
    });
  }

  editQuestion(question: InterviewQuestion): void {
    this.editingQuestionId = question.id;
    this.questionDraft = { ...question, tags: question.tags.join(', ') };
  }

  resetQuestionForm(): void {
    this.editingQuestionId = null;
    this.questionDraft = { ...emptyQuestion };
  }

  saveQuestion(): void {
    const draft = this.questionPayload();
    const request = this.editingQuestionId
      ? this.contentService.updateQuestion(this.editingQuestionId, draft)
      : this.contentService.createQuestion(draft);
    request.subscribe({
      next: saved => {
        this.upsertQuestion(saved);
        this.notify(this.editingQuestionId ? 'Question updated.' : 'Question created.');
        this.resetQuestionForm();
      },
      error: error => this.handleError('Could not save the question', error)
    });
  }

  deleteQuestion(question: InterviewQuestion): void {
    if (!window.confirm('Delete this question? This cannot be undone.')) return;
    this.contentService.deleteQuestion(question.id).subscribe({
      next: () => {
        this.questions = this.questions.filter(item => item.id !== question.id);
        this.notify('Question deleted.');
      },
      error: error => this.handleError('Could not delete the question', error)
    });
  }

  private loadContent(): void {
    this.loading = true;
    this.contentService.getTutorials(this.isAdminPanel).subscribe({
      next: tutorials => {
        this.tutorials = tutorials;
        this.contentService.getQuestions().subscribe({
          next: questions => {
            this.questions = questions;
            this.loading = false;
            const params = this.route.snapshot.queryParamMap;
            this.applyDeepLink(params.get('tutorial'), params.get('question'));
          },
          error: error => {
            this.loading = false;
            this.handleError('Could not load interview questions', error);
          }
        });
      },
      error: error => {
        this.loading = false;
        this.handleError('Could not load tutorials', error);
      }
    });
  }

  private setCategories(categories: QuizCategory[]): void {
    this.categories = categories.map(category => category.name);
    this.categoryTopics = Object.fromEntries(
      categories.map(category => [category.name, category.subCategories])
    );
    if (!this.categoryTopics[this.tutorialDraft.category]) {
      this.tutorialDraft = { ...this.tutorialDraft, category: this.categories[0] ?? '', subCategory: '' };
    }
    if (!this.categoryTopics[this.questionDraft.category]) {
      this.questionDraft = { ...this.questionDraft, category: this.categories[0] ?? '', subCategory: '' };
    }
  }

  private tutorialPayload(): Partial<Tutorial> {
    return {
      ...this.tutorialDraft,
      tags: this.parseTags(this.tutorialDraft.tags),
      ...(this.editingTutorialId ? {} : { author: 'Tech Interview Hub' })
    };
  }

  private questionPayload(): Partial<InterviewQuestion> {
    return { ...this.questionDraft, tags: this.parseTags(this.questionDraft.tags) };
  }

  private parseTags(tags: string): string[] {
    return tags.split(',').map(tag => tag.trim()).filter(Boolean);
  }

  private upsertTutorial(tutorial: Tutorial): void {
    const index = this.tutorials.findIndex(item => item.id === tutorial.id);
    this.tutorials = index < 0
      ? [tutorial, ...this.tutorials]
      : this.tutorials.map(item => item.id === tutorial.id ? tutorial : item);
    if (this.selectedTutorial?.id === tutorial.id) this.selectedTutorial = tutorial;
  }

  private upsertQuestion(question: InterviewQuestion): void {
    const index = this.questions.findIndex(item => item.id === question.id);
    this.questions = index < 0
      ? [question, ...this.questions]
      : this.questions.map(item => item.id === question.id ? question : item);
  }

  private async toggleSet(set: Set<string>, id: string, key: string): Promise<void> {
    const updated = new Set(set);
    if (updated.has(id)) updated.delete(id);
    else updated.add(id);
    try {
      await this.persist(key, [...updated]);
    } catch {
      return;
    }
    set.clear();
    updated.forEach(item => set.add(item));
  }

  private readStringSet(key: string): Set<string> {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
      return new Set(Array.isArray(value) ? value.filter(item => typeof item === 'string') : []);
    } catch (error) {
      console.warn(`Could not read saved ${key} preferences:`, error);
      return new Set();
    }
  }

  private readVotes(): Record<string, Vote | null> {
    try {
      const value: unknown = JSON.parse(localStorage.getItem('hub-question-votes') ?? '{}');
      return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, Vote | null>
        : {};
    } catch (error) {
      console.warn('Could not read saved question votes:', error);
      return {};
    }
  }

  private async persist(key: string, value: unknown): Promise<void> {
    try {
      const serialized = JSON.stringify(value instanceof Set ? [...value] : value);
      if (this.dataService.isFirebaseEnabled()) {
        await this.dataService.importJsonRecord('userSettings', { id: key, value: serialized }).toPromise();
      } else {
        localStorage.setItem(key, serialized);
      }
    } catch (error) {
      console.error(`Could not save user setting "${key}":`, error);
      this.notify('Your change could not be saved.', true);
      throw error;
    }
  }

  private async loadFirebaseSettings(): Promise<void> {
    const settings = await this.dataService.list<DataRecord>('userSettings').toPromise() ?? [];
    const getValue = (key: string): unknown => {
      const value = settings.find(item => item.id === key)?.['value'];
      if (typeof value !== 'string') return value;
      try {
        return JSON.parse(value) as unknown;
      } catch (error) {
        throw new Error(`Saved setting "${key}" contains invalid JSON: ${String(error)}`);
      }
    };
    const readSet = (key: string): Set<string> => {
      const value = getValue(key);
      return new Set(Array.isArray(value) ? value.filter(item => typeof item === 'string') : []);
    };
    this.bookmarkedTutorials = readSet('hub-tutorial-bookmarks');
    this.bookmarkedQuestions = readSet('hub-question-bookmarks');
    this.readTutorials = readSet('hub-read-tutorials');
    const votes = getValue('hub-question-votes');
    if (votes && typeof votes === 'object' && !Array.isArray(votes)) {
      this.votes = votes as Record<string, Vote | null>;
    }
  }

  private handleError(message: string, error: unknown): void {
    const detail = error instanceof HttpErrorResponse
      ? error.status === 401 ? 'Please sign in again.' :
        error.status === 403 ? 'Only administrators can change this content.' :
          error.error?.message || error.message
      : 'An unexpected error occurred.';
    console.error(`${message}:`, error);
    this.notify(`${message}. ${detail}`, true);
  }

  private notify(message: string, isError = false): void {
    this.notification = `${isError ? 'Error: ' : ''}${message}`;
    window.setTimeout(() => {
      if (this.notification === `${isError ? 'Error: ' : ''}${message}`) this.notification = '';
    }, 5000);
  }

  private applyDeepLink(tutorialId: string | null, questionId: string | null): void {
    if (tutorialId) {
      this.selectedTutorial = this.tutorials.find(item => item.id === tutorialId) ?? null;
    }
    if (questionId && this.questions.some(item => item.id === questionId)) {
      this.view = 'questions';
      this.showAnswer[questionId] = true;
    }
  }
}
