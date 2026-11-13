import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

interface RouteMapping {
  routeMap: string;
  notesCategory: string;
  fileName: string;
}

@Component({
  selector: 'app-interior-sample',
  standalone: true,
  imports: [InteriorSampleComponent, RouterModule, CommonModule, FormsModule],
   templateUrl: './interior-sample.component.html',
  styleUrl: './interior-sample.component.css'
})
export class InteriorSampleComponent implements OnInit {
  categories: RouteMapping[] = [];
  uniqueCategories: { routeMap: string; notesCategory: string }[] = [];
  selectedFiles: string[] = [];
  selectedFile: string | null = null;
  currentUrl: SafeResourceUrl | null = null;

  constructor(private sanitizer: DomSanitizer) { }

  ngOnInit(): void {
    fetch('assets/json_files/route_mapping.json')
      .then(res => {
        if (!res.ok) {
          throw new Error(`Route mapping request failed: ${res.status} ${res.statusText}`);
        }
        return res.json() as Promise<RouteMapping[]>;
      })
      .then(data => {
        if (!Array.isArray(data)) {
          throw new Error('Route mapping manifest must be a JSON array');
        }
        this.categories = data;

        const seen = new Set<string>();
        this.uniqueCategories = data.filter(item => {
          if (seen.has(item.routeMap)) return false;
          seen.add(item.routeMap);
          return true;
        });

        if (this.uniqueCategories.length > 0) {
          this.showFiles(this.uniqueCategories[0].routeMap);
        }
      })
      .catch(err => console.error('Failed to load route mapping', err));
  }

showFiles(category: string): void {
  this.selectedFiles = this.categories
    .filter(item => item.routeMap === category)
    .map(item => item.fileName);

  if (this.selectedFiles.length) {
    // Default to first file
    this.selectedFile = this.selectedFiles[0];

    // Auto-open the first file
    const url = `assets/javaNotesPdf/${encodeURIComponent(this.selectedFile)}`;
    this.currentUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  } else {
    this.selectedFile = null;
    this.currentUrl = null;
  }
}

// Auto-open whenever dropdown changes
onFileChange(): void {
  if (this.selectedFile) {
    const url = `assets/javaNotesPdf/${encodeURIComponent(this.selectedFile)}`;
    this.currentUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
  openSelected(): void {
    if (!this.selectedFile) return;
    const url = `assets/javaNotesPdf/${encodeURIComponent(this.selectedFile)}`;
    this.currentUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}

