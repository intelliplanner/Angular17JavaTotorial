import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-java-notes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './java-notes.component.html',
  styleUrls: ['./java-notes.component.css']
})
export class JavaNotesComponent implements OnInit {
  selectedFile?: File;
  files: string[] = [];
  selected?: string;
  currentUrl?: SafeResourceUrl;
  recentFiles: string[] = [];
  jsonFilePath: string = environment.apiUrl;
  private RECENT_KEY = 'javaNotesRecentFiles';
  private basePath: string = environment.production ? '/Angular17JavaTotorial' : '';
  selectedFileUrl?: SafeResourceUrl;

  constructor(private sanitizer: DomSanitizer, private http: HttpClient) { }

  ngOnInit(): void {
    // Load flat files list
    this.http.get<string[]>(`${environment.apiUrl}/assets/json_files/files.json`)
      .subscribe({
        next: (data) => {
          this.files = data;
          if (data && data.length > 0) {
            this.selected = data[0];
            const url = this.downloadUrl || '';
            this.currentUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
            this.loadRecent();
            this.updateRecent(this.selected);
          }
        },
        error: (err) => console.error('Failed to load files manifest', err)
      });


    // Load categories.json
    this.http.get<{ [key: string]: string[] }>(
      `${environment.apiUrl}/assets/json_files/categorized_topic.json`
    ).subscribe({
      next: (data) => {
        this.categories = Object.keys(data);
      },
      error: (err) => console.error('Failed to load categories manifest', err)
    });
  }


  // Category management
  showDialog = false;
  categories: string[] = [];       // loaded from category_topic.json
  selectedCategory: string = '';   // dropdown selection
  newCategory: string = '';        // manual entry

  openCategoryDialog() { this.showDialog = true; }
  closeDialog() {
    this.showDialog = false;
    this.newCategory = '';
    this.selectedCategory = '';
  }

  get downloadUrl(): string | null {
    if (!this.selected) return null;

    // In production, use full URL from apiUrl; in development, use relative path
    if (environment.production) {
      return `${environment.apiUrl}/assets/javaNotesPdf/${this.selected}`;
    } else {
      return `${environment.apiUrl}/assets/javaNotesPdf/${this.selected}`;
    }
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

  private renderIframe(url: string): void {
    const viewer = document.getElementById('pdfViewer');
    if (!viewer) return;
    viewer.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.width = '100%';
    iframe.height = '700px';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'auto');
    iframe.style.overflow = 'auto';
    viewer.appendChild(iframe);
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

      // Render in the same pdfViewer
      this.renderIframe(url);
    }
  }

  openSelected(): void {
    if (!this.selected) return;
    const url = this.downloadUrl || '';
    this.currentUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    this.updateRecent(this.selected);

    // Render in the same pdfViewer
    this.renderIframe(url);
  }

  savePdf(): void {
  if (!this.selectedFile) return;

  const formData = new FormData();
  formData.append('pdfFile', this.selectedFile);

  const category = this.selectedCategory || this.newCategory.trim();
  if (category) {
    formData.append('category', category);
  }

  this.http.post(`${environment.apiUrl}/uploadPdf`, formData).subscribe({
    next: () => {
      alert('PDF saved and categorized successfully!');
      this.closeDialog();
      // Refresh categories
      this.http.get<{ [key: string]: string[] }>(
        `${environment.apiUrl}/assets/json_files/categorized_topic.json`
      ).subscribe(data => {
        this.categories = Object.keys(data);
      });
    },
    error: (err) => {
      console.error('Upload failed:', err);
      alert('Upload failed: ' + (err.message || JSON.stringify(err)));
    }
  });
}


}
