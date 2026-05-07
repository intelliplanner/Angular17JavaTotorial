
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment.prod';

@Component({
  selector: 'app-interview-question-answer-categorywise',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './interview-question-answer-categorywise.component.html',
  styleUrl: './interview-question-answer-categorywise.component.css'
})
export class InterviewQuestionAnswerCategorywiseComponent implements OnInit {

  constructor(private http: HttpClient) { }

  // questions: any[] = [];
  // categories: string[] = [];
  // subCategories: string[] = [];

  // selectedCategory: string = '';
  // selectedSubCategory: string = '';
  // filteredQuestions: any[] = [];

  // ngOnInit(): void {
  //   this.http.get<any[]>(`${environment.apiUrl}/assets/json_files/interview_question_answer.json`)
  //     .subscribe(data => {
  //       this.questions = data;
  //       const cats = new Set<string>();
  //       data.forEach(q => {
  //         if (q.category) cats.add(this.normalize(q.category));
  //       });
  //       this.categories = Array.from(cats).sort();

  //       if (this.categories.length > 0) {
  //         this.showCategory(this.categories[0]);
  //       }
  //     });
  // }

  questions: any[] = [];
  categories: string[] = [];
  subCategories: string[] = [];

  selectedCategory: string = '';
  selectedSubCategory: string = '';
  filteredQuestions: any[] = [];

  ngOnInit(): void {
    this.http.get<any[]>('/assets/json_files/interview_question_answer.json')
      .subscribe(data => {
        this.questions = data;

        // Collect unique normalized categories
        const cats = new Set<string>();
        data.forEach(q => {
          if (q.category) cats.add(this.normalize(q.category));
        });
        this.categories = Array.from(cats).sort();

    
        if (this.categories.length > 0) {
          this.showCategory(this.categories[0]);
        }
      });
  }

  normalize(value: string): string {
    return value.trim().replace(/_/g, ' ').replace(/\s+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  showCategory(category: string): void {
    this.selectedCategory = category;

    // Collect subcategories for this category
    const subs = new Set<string>();
    this.questions.forEach(q => {
      if (this.normalize(q.category) === category && q.subCategory) {
        subs.add(this.normalize(q.subCategory));
      }
    });
    this.subCategories = Array.from(subs).sort();

    // Reset subcategory filter
    this.selectedSubCategory = '';
    this.filteredQuestions = this.questions.filter(
      q => this.normalize(q.category) === category
    );
  }

  filterBySubCategory(): void {
    if (this.selectedSubCategory) {
      this.filteredQuestions = this.questions.filter(
        q => this.normalize(q.category) === this.selectedCategory &&
          this.normalize(q.subCategory) === this.selectedSubCategory
      );
    } else {
      this.filteredQuestions = this.questions.filter(
        q => this.normalize(q.category) === this.selectedCategory
      );
    }
  }

  // normalize(value: string): string {
  //   return value.trim().replace(/_/g, ' ').replace(/\s+/g, ' ')
  //     .replace(/\b\w/g, c => c.toUpperCase());
  // }

  // showCategory(category: string): void {
  //   this.selectedCategory = category;

  //   // Collect subcategories for this category
  //   const subs = new Set<string>();
  //   this.questions.forEach(q => {
  //     if (this.normalize(q.category) === category && q.subCategory) {
  //       subs.add(this.normalize(q.subCategory));
  //     }
  //   });
  //   this.subCategories = Array.from(subs).sort();

  //   // Reset subcategory filter
  //   this.selectedSubCategory = '';
  //   this.filteredQuestions = this.questions.filter(
  //     q => this.normalize(q.category) === category
  //   );
  // }

  // filterBySubCategory(): void {
  //   if (this.selectedSubCategory) {
  //     this.filteredQuestions = this.questions.filter(
  //       q => this.normalize(q.category) === this.selectedCategory &&
  //         this.normalize(q.subCategory) === this.selectedSubCategory
  //     );
  //   } else {
  //     this.filteredQuestions = this.questions.filter(
  //       q => this.normalize(q.category) === this.selectedCategory
  //     );
  //   }
  // }

  trackByIndex(index: number): number {
    return index;
  }
  // constructor(private http: HttpClient) { }

  // questions: any[] = [];
  // categories: string[] = [];
  // subCategories: string[] = [];

  // selectedCategory: string = '';
  // selectedSubCategory: string = '';
  // filteredQuestions: any[] = [];

  // ngOnInit(): void {
  //   this.http.get<any[]>('/assets/json_files/interview_question_answer.json')
  //     .subscribe(data => {
  //       this.questions = data;

  //       // Collect unique normalized categories
  //       const cats = new Set<string>();
  //       data.forEach(q => {
  //         if (q.category) cats.add(this.normalize(q.category));
  //       });
  //       this.categories = Array.from(cats).sort();
  //     });
  // }

  // normalize(value: string): string {
  //   return value.trim().replace(/_/g, ' ').replace(/\s+/g, ' ')
  //     .replace(/\b\w/g, c => c.toUpperCase());
  // }

  // showCategory(category: string): void {
  //   this.selectedCategory = category;

  //   // Collect subcategories for this category
  //   const subs = new Set<string>();
  //   this.questions.forEach(q => {
  //     if (this.normalize(q.category) === category && q.subCategory) {
  //       subs.add(this.normalize(q.subCategory));
  //     }
  //   });
  //   this.subCategories = Array.from(subs).sort();

  //   // Reset subcategory filter
  //   this.selectedSubCategory = '';
  //   this.filteredQuestions = this.questions.filter(
  //     q => this.normalize(q.category) === category
  //   );
  // }

  // filterBySubCategory(): void {
  //   if (this.selectedSubCategory) {
  //     this.filteredQuestions = this.questions.filter(
  //       q => this.normalize(q.category) === this.selectedCategory &&
  //         this.normalize(q.subCategory) === this.selectedSubCategory
  //     );
  //   } else {
  //     this.filteredQuestions = this.questions.filter(
  //       q => this.normalize(q.category) === this.selectedCategory
  //     );
  //   }
  // }

  // trackByIndex(index: number): number {
  //   return index;
  // }
}
