import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { marked } from 'marked';

@Component({
  selector: 'app-documentation',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './documentation.component.html',
  styleUrl: './documentation.component.css'
})
export class DocumentationComponent implements OnInit {
  contentHtml = '';
  loading = true;
  errorMessage = '';

  async ngOnInit(): Promise<void> {
    try {
      const readmeUrl = new URL('assets/docs/README.md', document.baseURI);
      const response = await fetch(readmeUrl);
      if (!response.ok) {
        throw new Error(`Could not load the application guide (${response.status}).`);
      }

      this.contentHtml = await marked.parse(await response.text());
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? error.message
        : `Could not load the application guide: ${String(error)}`;
    } finally {
      this.loading = false;
    }
  }
}
