import { Component, OnInit } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';   // <-- add this
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, HttpClientModule, CommonModule, FormsModule], // <-- include FormsModule
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  categories: { routeMap: string; notesCategory: string; fileName: string }[] = [];
  uniqueCategories: { routeMap: string; notesCategory: string }[] = [];
  selectedFiles: string[] = [];
  selectedFile: string | null = null;
  currentUrl: SafeResourceUrl | null = null;

  constructor(private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    fetch('/assets/json_files/route_mapping.json')
      .then(res => res.json())
      .then((data: any[]) => {
        this.categories = data;

        const seen = new Set<string>();
        this.uniqueCategories = data.filter(item => {
          if (seen.has(item.routeMap)) return false;
          seen.add(item.routeMap);
          return true;
        });
      })
      .catch(err => console.error('Failed to load route mapping', err));
  }

  // showFiles(category: string): void {
  //   this.selectedFiles = this.categories
  //     .filter(item => item.routeMap === category)
  //     .map(item => item.fileName);
  //   this.selectedFile = null;
  //   this.currentUrl = null;
  // }

showFiles(category: string): void {
  this.selectedFiles = this.categories
    .filter(item => item.routeMap === category)
    .map(item => item.fileName);

  if (this.selectedFiles.length) {
    // Default to first file
    this.selectedFile = this.selectedFiles[0];

    // Auto-open the first file
    const url = `/assets/javaNotesPdf/${this.selectedFile}`;
    this.currentUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  } else {
    this.selectedFile = null;
    this.currentUrl = null;
  }
}

// Auto-open whenever dropdown changes
onFileChange(): void {
  if (this.selectedFile) {
    const url = `/assets/javaNotesPdf/${this.selectedFile}`;
    this.currentUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
  openSelected(): void {
    if (!this.selectedFile) return;
    const url = `/assets/javaNotesPdf/${this.selectedFile}`;
    this.currentUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
