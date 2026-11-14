import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { QuizCategory } from '../../models/category';
import { CategoryService } from '../../services/category.service';
import { QuestionService } from '../../services/question.service';

@Component({
  selector: 'app-category-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './category-manager.component.html',
  styleUrl: './category-manager.component.css'
})
export class CategoryManagerComponent implements OnInit {
  categories: QuizCategory[] = [];
  questions: import('../../models/question').QuizQuestion[] = [];
  newCategory = '';
  message = '';
  error = '';

  constructor(
    private readonly questionService: QuestionService,
    private readonly categoryService: CategoryService
  ) { }

  async ngOnInit(): Promise<void> {
    try {
      await this.questionService.load();
      this.refresh();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load categories.';
    }
  }

  async addCategory(): Promise<void> {
    const name = this.newCategory.trim();
    if (!name || this.categories.some(category => category.name.toLowerCase() === name.toLowerCase())) {
      this.error = 'Enter a category name that is not already in use.';
      return;
    }
    const saved = await this.persist(
      this.categoryService.createCategory({ name, subCategories: [] }),
      `Added ${name}.`
    );
    if (saved) this.newCategory = '';
  }

  async addSubCategory(category: QuizCategory): Promise<void> {
    const subCategory = window.prompt(`New subcategory for ${category.name}:`)?.trim();
    if (!subCategory) return;
    if (category.subCategories.some(item => item.toLowerCase() === subCategory.toLowerCase())) {
      this.error = 'That subcategory already exists.';
      return;
    }
    const updated = { ...category, subCategories: [...category.subCategories, subCategory] };
    await this.persist(this.categoryService.updateCategory(category.name, updated), `Added ${subCategory}.`);
  }

  async editCategory(category: QuizCategory): Promise<void> {
    const name = window.prompt('Edit category name:', category.name)?.trim();
    if (!name || name === category.name) return;
    if (this.categories.some(item => item.name !== category.name && item.name.toLowerCase() === name.toLowerCase())) {
      this.error = 'A category with that name already exists.';
      return;
    }
    const updated = { ...category, name };
    await this.persist(
      this.categoryService.updateCategory(category.name, updated),
      `Renamed category to ${name}.`,
      () => this.questionService.renameCategory(category.name, updated)
    );
  }

  async editSubCategory(category: QuizCategory, previous: string): Promise<void> {
    const name = window.prompt('Edit subcategory name:', previous)?.trim();
    if (!name || name === previous) return;
    if (category.subCategories.some(item => item !== previous && item.toLowerCase() === name.toLowerCase())) {
      this.error = 'That subcategory already exists.';
      return;
    }
    const categories = this.categories.map(item => item.name === category.name
      ? { ...item, subCategories: item.subCategories.map(sub => sub === previous ? name : sub) }
      : item);
    const updated = categories.find(item => item.name === category.name);
    if (!updated) return;
    await this.persist(
      this.categoryService.updateCategory(category.name, updated),
      `Renamed subcategory to ${name}.`,
      () => {
        const questions = this.questions.map(question =>
          question.category === category.name && question.subCategory === previous
            ? { ...question, subCategory: name }
            : question
        );
        this.questionService.importQuestions(questions);
      }
    );
  }

  async deleteSubCategory(category: QuizCategory, subCategory: string): Promise<void> {
    if (this.questions.some(question => question.category === category.name && question.subCategory === subCategory)) {
      this.error = 'This subcategory is used by questions. Move or delete those questions first.';
      return;
    }
    const updated = {
      ...category,
      subCategories: category.subCategories.filter(sub => sub !== subCategory)
    };
    await this.persist(this.categoryService.updateCategory(category.name, updated), `Deleted ${subCategory}.`);
  }

  async deleteCategory(category: QuizCategory): Promise<void> {
    if (this.questions.some(question => question.category === category.name)) {
      this.error = 'This category is used by questions. Move or delete those questions first.';
      return;
    }
    if (!window.confirm(`Delete category "${category.name}" and its subcategories?`)) return;
    await this.persist(this.categoryService.deleteCategory(category.name), `Deleted ${category.name}.`);
  }

  exportJson(): void {
    const url = URL.createObjectURL(new Blob([JSON.stringify(this.categories, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'topic_categories.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  private async persist(
    request: Observable<QuizCategory[]>,
    message: string,
    updateLocalQuestions?: () => void
  ): Promise<boolean> {
    try {
      const categories = await request.toPromise();
      if (!Array.isArray(categories)) throw new Error('The category API returned an invalid response.');
      updateLocalQuestions?.();
      this.questionService.saveCategories(categories);
      this.refresh();
      this.message = message;
      this.error = '';
      return true;
    } catch (error) {
      this.error = error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
        ? error.error.message
        : error instanceof Error ? error.message : 'Could not save categories.';
      return false;
    }
  }

  private refresh(): void {
    this.categories = this.questionService.categories.map(category => ({ ...category, subCategories: [...category.subCategories] }));
    this.questions = this.questionService.questions;
  }
}
