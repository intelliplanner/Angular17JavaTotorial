import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { getAuthApiUrl } from '../auth-api-url';

export type JsonDatasetKind = 'tutorials' | 'answers' | 'quiz';

export interface JsonGenerationRequest {
  datasets: JsonDatasetKind[];
  minimumCounts: Partial<Record<JsonDatasetKind, number>>;
}

export interface JsonGenerationResponse {
  generated: Record<JsonDatasetKind, number>;
  totals: Record<JsonDatasetKind, number>;
}

export interface JsonDraftRecord {
  id: string | number;
  title?: string;
  question?: string;
  category?: string;
  subCategory?: string;
  difficulty?: string;
  description?: string;
  content?: string;
  answer?: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  published?: boolean;
  importable: boolean;
  importIssue: string;
}

export interface JsonDraftListResponse {
  dataset: JsonDatasetKind;
  records: JsonDraftRecord[];
  maximumImportRecords: number;
}

export interface JsonDraftImportResponse {
  dataset: JsonDatasetKind;
  imported: number;
  remaining: number;
  destinations: Record<string, number>;
  published: number;
  addedSubcategories: string[];
  warnings: string[];
}

@Injectable({ providedIn: 'root' })
export class JsonGeneratorService {
  private readonly apiUrl = getAuthApiUrl();

  constructor(private readonly http: HttpClient) {}

  generate(request: JsonGenerationRequest): Observable<JsonGenerationResponse> {
    if (!this.apiUrl) {
      return throwError(new Error('JSON generation requires a configured Node.js API URL.'));
    }
    return this.http.post<JsonGenerationResponse>(
      `${this.apiUrl}/api/admin/generate-json`,
      request,
      { withCredentials: true }
    );
  }

  reviewDrafts(dataset: JsonDatasetKind): Observable<JsonDraftListResponse> {
    if (!this.apiUrl) {
      return throwError(new Error('Draft review requires a configured Node.js API URL.'));
    }
    return this.http.get<JsonDraftListResponse>(
      `${this.apiUrl}/api/admin/generated-json`,
      { params: { dataset }, withCredentials: true }
    );
  }

  importDrafts(dataset: JsonDatasetKind, ids: Array<string | number>): Observable<JsonDraftImportResponse> {
    if (!this.apiUrl) {
      return throwError(new Error('Draft import requires a configured Node.js API URL.'));
    }
    return this.http.post<JsonDraftImportResponse>(
      `${this.apiUrl}/api/admin/generated-json/import`,
      { dataset, ids },
      { withCredentials: true }
    );
  }
}
