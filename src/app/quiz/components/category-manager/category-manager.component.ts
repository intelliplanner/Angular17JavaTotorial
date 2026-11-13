import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QuizCategory } from '../../models/category';
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

  constructor(private readonly questionService: QuestionService) { }

  async ngOnInit(): Promise<void> {
    try {
      await this.questionService.load();
      this.refresh();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load categories.';
    }
  }

  addCategory(): void {
    const name = this.newCategory.trim();
    if (!name || this.categories.some(category => category.name.toLowerCase() === name.toLowerCase())) {
      this.error = 'Enter a category name that is not already in use.';
      return;
    }
    this.save([...this.categories, { name, subCategories: [] }], `Added ${name}.`);
    this.newCategory = '';
  }

  addSubCategory(category: QuizCategory): void {
    const subCategory = window.prompt(`New subcategory for ${category.name}:`)?.trim();
    if (!subCategory) return;
    if (category.subCategories.some(item => item.toLowerCase() === subCategory.toLowerCase())) {
      this.error = 'That subcategory already exists.';
      return;
    }
    this.save(this.categories.map(item => item.name === category.name
      ? { ...item, subCategories: [...item.subCategories, subCategory] }
      : item), `Added ${subCategory}.`);
  }

  editCategory(category: QuizCategory): void {
    const name = window.prompt('Edit category name:', category.name)?.trim();
    if (!name || name === category.name) return;
    if (this.categories.some(item => item.name !== category.name && item.name.toLowerCase() === name.toLowerCase())) {
      this.error = 'A category with that name already exists.';
      return;
    }
    try {
      this.questionService.renameCategory(category.name, { ...category, name });
      this.refresh();
      this.message = `Renamed category to ${name}.`;
      this.error = '';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not rename this category.';
    }
  }

  editSubCategory(category: QuizCategory, previous: string): void {
    const name = window.prompt('Edit subcategory name:', previous)?.trim();
    if (!name || name === previous) return;
    if (category.subCategories.some(item => item !== previous && item.toLowerCase() === name.toLowerCase())) {
      this.error = 'That subcategory already exists.';
      return;
    }
    const categories = this.categories.map(item => item.name === category.name
      ? { ...item, subCategories: item.subCategories.map(sub => sub === previous ? name : sub) }
      : item);
    try {
      const questions = this.questions.map(question =>
        question.category === category.name && question.subCategory === previous
          ? { ...question, subCategory: name }
          : question
      );
      this.questionService.importQuestions(questions);
      this.save(categories, `Renamed subcategory to ${name}.`);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not rename this subcategory.';
    }
  }

  deleteSubCategory(category: QuizCategory, subCategory: string): void {
    if (this.questions.some(question => question.category === category.name && question.subCategory === subCategory)) {
      this.error = 'This subcategory is used by questions. Move or delete those questions first.';
      return;
    }
    this.save(this.categories.map(item => item.name === category.name
      ? { ...item, subCategories: item.subCategories.filter(sub => sub !== subCategory) }
      : item), `Deleted ${subCategory}.`);
  }

  deleteCategory(category: QuizCategory): void {
    if (this.questions.some(question => question.category === category.name)) {
      this.error = 'This category is used by questions. Move or delete those questions first.';
      return;
    }
    if (!window.confirm(`Delete category "${category.name}" and its subcategories?`)) return;
    this.save(this.categories.filter(item => item.name !== category.name), `Deleted ${category.name}.`);
  }

  exportJson(): void {
    const url = URL.createObjectURL(new Blob([JSON.stringify(this.categories, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'categories.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  private save(categories: QuizCategory[], message: string): void {
    try {
      this.questionService.saveCategories(categories);
      this.refresh();
      this.message = message;
      this.error = '';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not save categories.';
    }
  }

  private refresh(): void {
    this.categories = this.questionService.categories.map(category => ({ ...category, subCategories: [...category.subCategories] }));
    this.questions = this.questionService.questions;
  }
}
