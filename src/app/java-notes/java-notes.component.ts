import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-java-notes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="interview-round">
      <div class="java-notes">
  <div class="controls">
    <label for="notesSelect">Choose Java Notes: </label>
    <select id="notesSelect" [(ngModel)]="selected">
      <option *ngIf="!selected" value="" disabled>Select a file</option>
      <optgroup *ngIf="recentFiles.length" label="Recent">
        <option *ngFor="let f of recentFiles" [value]="f">{{f}}</option>
      </optgroup>
      <optgroup label="All Files">
        <option *ngFor="let f of otherFiles" [value]="f">{{f}}</option>
      </optgroup>
    </select>

    <button (click)="openSelected()" [disabled]="!selected">Open</button>
 

  <div id="pdfViewer" class="pdf-viewer" *ngIf="currentUrl"></div>
 </div>
</div>
      <!-- <iframe
        src="/assets/javaNotesPdf/Interview_Round.pdf"
        width="100%"
        height="600px"
        frameborder="0"
        allowfullscreen>
      </iframe> -->
    </section>
  `,
  styles: [`
    .interview-round { max-width: 100%; margin: 2rem auto; padding: 1rem; }
    iframe { width: 100%; height: 600px; border: none; }
  `]
})
export class JavaNotesComponent implements OnInit {

  files: string[] = [];
  selected?: string;
  currentUrl?: SafeResourceUrl;
  recentFiles: string[] = [];
  jsonFilePath: string = environment.apiUrl;
  private RECENT_KEY = 'javaNotesRecentFiles';
  private basePath: string = environment.production ? '/Angular17JavaTutorial' : '';

  constructor(private sanitizer: DomSanitizer) { }

  ngOnInit(): void {
    fetch(this.jsonFilePath + "/assets/javaNotesPdf/files.json")
      .then(res => res.json())
      .then((data: string[]) => {
        this.files = data;
        if (data && data.length > 0) {
          this.selected = data[0];
          const url = this.downloadUrl || '';
          this.currentUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
          this.loadRecent();
          this.updateRecent(this.selected);
        }
      })
      .catch(err => console.error('Failed to load files manifest', err));
  }

  get downloadUrl(): string | null {
    if (!this.selected) return null;
    
    // In production, use full URL from apiUrl; in development, use relative path
    if (environment.production ) {
      return `${this.basePath}/Angular17JavaTotorial/assets/javaNotesPdf/${this.selected}`;
    } else {
      return `${this.basePath}/Angular17JavaTotorial/assets/javaNotesPdf/${this.selected}`;
    }
  }

  openSelected(): void {
    if (!this.selected) return;
    const url = this.downloadUrl || '';
    this.currentUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    this.updateRecent(this.selected);
    // render directly via iframe
    this.renderIframe(url);
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

}
