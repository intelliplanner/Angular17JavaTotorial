import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  JsonDraftImportResponse,
  JsonDraftRecord,
  JsonDatasetKind,
  JsonGenerationRequest,
  JsonGenerationResponse,
  JsonGeneratorService
} from './json-generator.service';

interface DatasetSetting {
  kind: JsonDatasetKind;
  label: string;
  selected: boolean;
  minimumRecords: number;
}

@Component({
  selector: 'app-json-generator',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './json-generator.component.html'
})
export class JsonGeneratorComponent {
  readonly maximumRecords = 10000;
  readonly datasets: DatasetSetting[] = [
    { kind: 'tutorials', label: 'Tutorials', selected: true, minimumRecords: 1000 },
    { kind: 'answers', label: 'Questions and answers', selected: true, minimumRecords: 1000 },
    { kind: 'quiz', label: 'Quiz questions', selected: true, minimumRecords: 1000 }
  ];
  running = false;
  errorMessage = '';
  validationIssues: string[] = [];
  truncatedIssueCount = 0;
  result: JsonGenerationResponse | null = null;
  reviewDataset: JsonDatasetKind = 'tutorials';
  reviewRecords: JsonDraftRecord[] = [];
  selectedDraftIds = new Set<string | number>();
  maximumImportRecords = 100;
  reviewLoading = false;
  reviewLoaded = false;
  importing = false;
  reviewError = '';
  reviewNotice = '';
  reviewPage = 0;
  readonly reviewPageSize = 25;

  constructor(private readonly generator: JsonGeneratorService) {}

  get hasSelection(): boolean {
    return this.datasets.some(dataset => dataset.selected);
  }

  get visibleReviewRecords(): JsonDraftRecord[] {
    const start = this.reviewPage * this.reviewPageSize;
    return this.reviewRecords.slice(start, start + this.reviewPageSize);
  }

  get reviewPageCount(): number {
    return Math.max(1, Math.ceil(this.reviewRecords.length / this.reviewPageSize));
  }

  get reviewDatasetLabel(): string {
    return this.datasets.find(dataset => dataset.kind === this.reviewDataset)?.label ?? this.reviewDataset;
  }

  generate(): void {
    const selected = this.datasets.filter(dataset => dataset.selected);
    if (!selected.length) return;
    const invalidSetting = selected.find(dataset =>
      !Number.isInteger(dataset.minimumRecords) ||
      dataset.minimumRecords < 1000 ||
      dataset.minimumRecords > this.maximumRecords
    );
    if (invalidSetting) {
      this.errorMessage = `${invalidSetting.label} must be between 1,000 and ${this.maximumRecords.toLocaleString()} records.`;
      this.result = null;
      return;
    }

    const minimumCounts: Partial<Record<JsonDatasetKind, number>> = {};
    for (const dataset of selected) {
      minimumCounts[dataset.kind] = dataset.minimumRecords;
    }
    const request: JsonGenerationRequest = {
      datasets: selected.map(dataset => dataset.kind),
      minimumCounts
    };

    this.running = true;
    this.errorMessage = '';
    this.validationIssues = [];
    this.truncatedIssueCount = 0;
    this.result = null;
    this.generator.generate(request).subscribe({
      next: result => {
        this.result = result;
        this.running = false;
      },
      error: error => {
        this.showError(error);
        this.running = false;
      }
    });
  }

  loadDrafts(): void {
    this.reviewLoading = true;
    this.reviewError = '';
    this.reviewNotice = '';
    this.selectedDraftIds.clear();
    this.reviewPage = 0;
    this.reviewLoaded = false;
    this.reviewRecords = [];
    this.generator.reviewDrafts(this.reviewDataset).subscribe({
      next: response => {
        this.reviewRecords = response.records;
        this.maximumImportRecords = response.maximumImportRecords;
        this.reviewLoaded = true;
        this.reviewLoading = false;
      },
      error: error => {
        this.reviewError = this.apiErrorMessage(error, 'Could not load generated drafts.');
        this.reviewLoading = false;
      }
    });
  }

  resetReviewState(): void {
    this.reviewRecords = [];
    this.selectedDraftIds.clear();
    this.reviewLoaded = false;
    this.reviewError = '';
    this.reviewNotice = '';
    this.reviewPage = 0;
  }

  toggleDraft(id: string | number): void {
    if (this.selectedDraftIds.has(id)) {
      this.selectedDraftIds.delete(id);
      return;
    }
    if (this.selectedDraftIds.size >= this.maximumImportRecords) {
      this.reviewError = `Import up to ${this.maximumImportRecords} records at a time.`;
      return;
    }
    this.selectedDraftIds.add(id);
    this.reviewError = '';
  }

  changeReviewPage(offset: number): void {
    this.reviewPage = Math.min(Math.max(0, this.reviewPage + offset), this.reviewPageCount - 1);
  }

  importSelectedDrafts(): void {
    const ids = [...this.selectedDraftIds];
    if (!ids.length || this.importing) return;
    const publicationNote = this.reviewDataset === 'tutorials'
      ? '\n\nSelected tutorials will be published immediately.'
      : '';
    if (!window.confirm(
      `Move ${ids.length} reviewed ${this.reviewDatasetLabel.toLowerCase()} record(s) into the application source data?` +
      '\nImported records will be removed from the generated draft file.' + publicationNote
    )) {
      return;
    }

    this.importing = true;
    this.reviewError = '';
    this.reviewNotice = '';
    this.generator.importDrafts(this.reviewDataset, ids).subscribe({
      next: result => {
        this.reviewRecords = this.reviewRecords.filter(record => !this.selectedDraftIds.has(record.id));
        this.selectedDraftIds.clear();
        this.reviewPage = Math.min(this.reviewPage, this.reviewPageCount - 1);
        this.reviewNotice = this.importSummary(result);
        this.importing = false;
      },
      error: error => {
        this.reviewError = this.apiErrorMessage(error, 'Could not import selected drafts.');
        this.importing = false;
      }
    });
  }

  private importSummary(result: JsonDraftImportResponse): string {
    const destinations = Object.entries(result.destinations)
      .map(([file, count]) => `${count} → ${file}`)
      .join(', ');
    const details = [
      `Imported ${result.imported} record(s) to ${destinations}.`,
      `${result.remaining} draft record(s) remain.`
    ];
    if (result.published) details.push(`${result.published} tutorial(s) published.`);
    if (result.addedSubcategories.length) {
      details.push(`Added subtopics: ${result.addedSubcategories.join(', ')}.`);
    }
    details.push(...result.warnings);
    return details.join(' ');
  }

  private apiErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return 'Cannot reach the Node.js API. Start node server.js and verify authApiUrl.';
      const payload = error.error && typeof error.error === 'object'
        ? error.error as Record<string, unknown>
        : null;
      if (payload && typeof payload['message'] === 'string') return payload['message'];
      return `${fallback} (HTTP ${error.status}).`;
    }
    return error instanceof Error ? error.message : fallback;
  }

  private showError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        this.errorMessage =
          'Cannot reach the Node.js API. Start node server.js and verify the configured authApiUrl and CORS origin.';
        return;
      }

      const payload = error.error && typeof error.error === 'object'
        ? error.error as Record<string, unknown>
        : null;
      this.errorMessage = payload && typeof payload['message'] === 'string'
        ? payload['message']
        : typeof error.error === 'string' && error.error.trim()
          ? error.error
          : `JSON generation failed (HTTP ${error.status}).`;
      this.validationIssues = payload && Array.isArray(payload['issues'])
        ? payload['issues'].filter((item): item is string => typeof item === 'string')
        : [];
      const truncated = payload?.['truncated'];
      this.truncatedIssueCount = typeof truncated === 'number' && Number.isInteger(truncated) ? truncated : 0;
      return;
    }
    this.errorMessage = error instanceof Error ? error.message : `JSON generation failed: ${String(error)}`;
  }
}
