import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-categorized-notes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './categorized-notes.component.html',
  styleUrl: './categorized-notes.component.css'
})
export class CategorizedNotesComponent implements OnInit {
  selectedFile?: File;
  files: string[] = [];
  selected?: string;
  currentUrl?: SafeResourceUrl;
  recentFiles: string[] = [];
  jsonFilePath: string = environment.apiUrl;
  private RECENT_KEY = 'javaNotesRecentFiles';
  // private basePath: string = environment.production ? '/Angular17JavaTotorial' : '';
  selectedFileUrl?: SafeResourceUrl;
  showDialog = false;
  selectedCategory: string = '';   // dropdown selection
  newCategory: string = '';        // manual entry

  constructor(private sanitizer: DomSanitizer, private http: HttpClient) { }
  categories: string[] = [];
  filesByCategory: { [key: string]: string[] } = {};

  ngOnInit(): void {
    this.loadCategorizedFiles();
  }

  private loadCategorizedFiles(): void {
    this.http.get<{ [key: string]: string[] }>(
      'assets/json_files/categorized_topic.json'
    ).subscribe({
      next: (data) => {
        this.categories = Object.keys(data)
          .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        this.filesByCategory = {};
        this.categories.forEach(category => {
          this.filesByCategory[category] = [...data[category]]
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        });
        this.files = this.categories.flatMap(category => this.filesByCategory[category]);
        this.loadRecent();

        if (!this.selected && this.categories.length > 0) {
          this.selected = this.filesByCategory[this.categories[0]][0];
          const url = this.downloadUrl;
          if (url) {
            this.currentUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
            this.updateRecent(this.selected);
          }
        }
      },
      error: (err) => console.error('Failed to load categorized files manifest', err)
    });
  }

  openCategoryDialog() { this.showDialog = true; }
  closeDialog() {
    this.showDialog = false;
    this.newCategory = '';
    this.selectedCategory = '';
  }

  get downloadUrl(): string | null {
    if (!this.selected) return null;
    return `assets/javaNotesPdf/${encodeURIComponent(this.selected)}`;
  }

  private loadRecent(): void {
    try {
      const raw = localStorage.getItem(this.RECENT_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        this.recentFiles = (arr || []).filter(f => this.files.includes(f)).slice(0, 5);
      }
    } catch (e) {
      this.recentFiles = [];
    }
  }

  private updateRecent(file?: string): void {
    if (!file) return;
    this.recentFiles = this.recentFiles.filter(f => f !== file);
    this.recentFiles.unshift(file);
    this.recentFiles = this.recentFiles.slice(0, 5);
    try {
      localStorage.setItem(this.RECENT_KEY, JSON.stringify(this.recentFiles));
    } catch (e) {
      // ignore
    }
  }

  get otherFiles(): string[] {
    return this.files.filter(f => !this.recentFiles.includes(f));
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.type !== 'application/pdf') {
        alert('Only PDF files are allowed!');
        return;
      }
      this.selectedFile = file;

      // Create a preview URL for the selected file
      const url = URL.createObjectURL(file);
      this.currentUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);

    }
  }

  openSelected(): void {
    if (!this.selected) return;
    const url = this.downloadUrl || '';
    this.currentUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    this.updateRecent(this.selected);

  }

  savePdf(): void {
    if (!this.selectedFile) return;

    const formData = new FormData();
    formData.append('pdfFile', this.selectedFile);

    let category = this.selectedCategory || this.newCategory.trim();
    
    if (category) {
      category = category.replace(/\s+/g, '_');
      formData.append('category', category);
    }

    
    this.http.post(`${environment.apiUrl}/uploadPdf`, formData).subscribe({
      next: () => {
        alert('PDF saved and categorized successfully!');
        this.closeDialog();
        // Refresh categories
        this.loadCategorizedFiles();
      },
      error: (err) => {
        console.error('Upload failed:', err);
        alert('Upload failed: ' + (err.message || JSON.stringify(err)));
      }
    });
  }

}
