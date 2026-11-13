import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SafeResourceUrl, DomSanitizer } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { QuizCategory } from '../quiz/models/category';
import { QuestionService } from '../quiz/services/question.service';
import { QuizService } from '../quiz/services/quiz.service';

interface RouteMapping {
  routeMap: string;
  notesCategory: string;
  fileName: string;
}

interface LearningPath {
  name: string;
  icon: string;
  tone: string;
  topics: string[];
  route: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  readonly currentYear = new Date().getFullYear();
  categories: RouteMapping[] = [];
  uniqueCategories: { routeMap: string; notesCategory: string }[] = [];
  selectedFiles: string[] = [];
  selectedFile: string | null = null;
  currentUrl: SafeResourceUrl | null = null;
  isLoadingCategories = true;
  categoryLoadError = false;
  isLoadingQuestions = true;
  questionLoadError = false;
  questionCounts = new Map<string, number>();
  quizCategories: QuizCategory[] = [];

  readonly learningPaths: LearningPath[] = [
    { name: 'Java Full Stack', icon: 'fa-code', tone: 'amber', topics: ['Core Java', 'Collections', 'Multithreading', 'JVM', 'Spring Boot', 'Microservices'], route: '/interview' },
    { name: 'Database', icon: 'fa-database', tone: 'blue', topics: ['SQL', 'Oracle', 'MySQL', 'PostgreSQL'], route: '/categorizedNotes' },
    { name: 'Cloud & DevOps', icon: 'fa-cloud', tone: 'violet', topics: ['Docker', 'Kubernetes', 'AWS', 'GCP', 'Terraform'], route: '/quiz' },
    { name: 'Frontend Development', icon: 'fa-window-maximize', tone: 'mint', topics: ['Angular', 'React', 'TypeScript', 'JavaScript'], route: '/categorizedNotes' }
  ];

  constructor(
    private readonly sanitizer: DomSanitizer,
    private readonly questionService: QuestionService,
    readonly quizService: QuizService
  ) { }

  ngOnInit(): void {
    void this.loadQuestionData();
    void this.loadStudyLibrary();
  }

  getQuestionCount(category: string): number {
    return this.questionCounts.get(category.toLowerCase()) ?? 0;
  }

  get latestResult() {
    return this.quizService.results[0] ?? null;
  }

  get activeSession() {
    return this.quizService.activeSession;
  }

  get nextStepRoute(): string {
    return this.activeSession ? '/quiz/play' : this.latestResult ? '/quiz/review' : '/quiz';
  }

  get nextStepTitle(): string {
    if (this.activeSession) return 'Pick up your quiz';
    if (this.latestResult) return 'Review your last attempt';
    return 'Start your first practice';
  }

  get categoryCards(): { name: string; count: number; icon: string; route: string }[] {
    return [
      { name: 'Java', count: this.getQuestionCount('Java'), icon: 'fa-mug-hot', route: '/interview' },
      { name: 'Database', count: this.getQuestionCount('Database'), icon: 'fa-database', route: '/categorizedNotes' },
      { name: 'AWS', count: this.getQuestionCount('AWS'), icon: 'fa-cloud', route: '/quiz' },
      { name: 'Kubernetes', count: this.getQuestionCount('Kubernetes'), icon: 'fa-cubes', route: '/quiz' },
      { name: 'GCP', count: this.getQuestionCount('GCP'), icon: 'fa-cloud-arrow-up', route: '/quiz' },
      { name: 'Mock tests', count: this.quizService.results.length, icon: 'fa-stopwatch', route: '/quiz' }
    ];
  }

  showFiles(category: string): void {
    this.selectedFiles = this.categories
      .filter(item => item.routeMap === category)
      .map(item => item.fileName);

    if (this.selectedFiles.length) {
      this.selectedFile = this.selectedFiles[0];
      this.currentUrl = null;
    } else {
      this.selectedFile = null;
      this.currentUrl = null;
    }
  }

  onFileChange(): void {
    this.openSelected();
  }

  onStudyCategoryChange(event: Event): void {
    this.showFiles((event.target as HTMLSelectElement).value);
  }

  openSelected(): void {
    if (!this.selectedFile) return;
    const url = `assets/javaNotesPdf/${encodeURIComponent(this.selectedFile)}`;
    this.currentUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  private async loadQuestionData(): Promise<void> {
    try {
      await this.questionService.load();
      this.quizCategories = this.questionService.categories;
      this.questionCounts = this.questionService.questions.reduce((counts, question) => {
        const key = question.category.toLowerCase();
        counts.set(key, (counts.get(key) ?? 0) + 1);
        return counts;
      }, new Map<string, number>());
    } catch (error) {
      this.questionLoadError = true;
      console.error('Failed to load interview quiz data', error);
    } finally {
      this.isLoadingQuestions = false;
    }
  }

  private async loadStudyLibrary(): Promise<void> {
    try {
      const response = await fetch('assets/json_files/route_mapping.json');
      if (!response.ok) {
        throw new Error(`Study library request failed: ${response.status} ${response.statusText}`);
      }
      const data: unknown = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Study library manifest must be a JSON array.');
      }
      this.categories = data as RouteMapping[];
      const seen = new Set<string>();
      this.uniqueCategories = this.categories.filter(item => {
        if (seen.has(item.routeMap)) return false;
        seen.add(item.routeMap);
        return true;
      });
      if (this.uniqueCategories.length) this.showFiles(this.uniqueCategories[0].routeMap);
    } catch (error) {
      this.categoryLoadError = true;
      console.error('Failed to load study library', error);
    } finally {
      this.isLoadingCategories = false;
    }
  }
}
