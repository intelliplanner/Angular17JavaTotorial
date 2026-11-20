import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { formatPdfPages, PdfTextBlock, PdfTextFragment, PdfTextLine, toMarkdown } from './pdf-text-formatter';

@Component({
  selector: 'app-pdf-to-text',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pdf-to-text.component.html',
  styleUrl: './pdf-to-text.component.css'
})
export class PdfToTextComponent implements OnInit {
  categories: { name: string; files: string[] }[] = [];
  selectedFile = '';
  blocks: PdfTextBlock[] = [];
  loading = false;
  errorMessage = '';
  warningMessage = '';
  searchText = '';
  pageCount = 0;
  viewMode: 'formatted' | 'markdown' = 'formatted';
  private readRequestId = 0;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<{ [key: string]: string[] }>('assets/json_files/categorized_topic.json').subscribe({
      next: (manifest) => {
        this.categories = Object.keys(manifest)
          .sort((a, b) => a.localeCompare(b))
          .map(name => ({
            name,
            files: [...manifest[name]].sort((a, b) => a.localeCompare(b))
          }));

        const firstFile = this.categories.find(category => category.files.length)?.files[0];
        if (firstFile) {
          this.selectedFile = firstFile;
          void this.readSelectedPdf();
        }
      },
      error: () => {
        this.errorMessage = 'Could not load the PDF list.';
      }
    });
  }

  async readSelectedPdf(): Promise<void> {
    if (!this.selectedFile) return;

    const requestId = ++this.readRequestId;
    this.loading = true;
    this.errorMessage = '';
    this.warningMessage = '';
    this.blocks = [];
    this.pageCount = 0;
    this.searchText = '';

    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = 'assets/pdfjs/pdf.worker.min.mjs';

      const url = `assets/javaNotesPdf/${encodeURIComponent(this.selectedFile)}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`PDF could not be loaded (${response.status}).`);
      }

      const pdf = await pdfjs.getDocument({
        data: new Uint8Array(await response.arrayBuffer())
      }).promise;

      const pages = [];
      const pagesWithoutText: number[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const fragments = content.items
          .filter((item): item is TextItem => 'str' in item)
          .filter(item => item.str.trim().length > 0)
          .map(item => {
            const fontFamily = content.styles[item.fontName]?.fontFamily || '';
            return this.toFragment(item, `${item.fontName} ${fontFamily}`);
          });
        if (!fragments.length) pagesWithoutText.push(pageNumber);
        pages.push({
          lines: this.groupItemsIntoLines(fragments, page.getViewport({ scale: 1 }).height)
        });
      }

      if (requestId !== this.readRequestId) return;
      const extractedBlocks = formatPdfPages(pages);
      if (!extractedBlocks.length) {
        throw new Error('No selectable text was found. This PDF may contain scanned pages; OCR is not available in this reader.');
      }
      this.blocks = extractedBlocks;
      this.pageCount = pdf.numPages;
      if (pagesWithoutText.length) {
        this.warningMessage = `Pages ${pagesWithoutText.join(', ')} contain no selectable text and may be scanned pages. Their content was not extracted because OCR is not available in this reader.`;
      }
    } catch (error) {
      if (requestId === this.readRequestId) {
        this.errorMessage = error instanceof Error
          ? error.message
          : 'The selected PDF could not be read.';
      }
    } finally {
      if (requestId === this.readRequestId) {
        this.loading = false;
      }
    }
  }

  private toFragment(item: TextItem, fontName: string): PdfTextFragment {
    const [a, b] = item.transform;
    return {
      text: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      fontSize: Math.hypot(a, b) || item.height,
      fontName
    };
  }

  private groupItemsIntoLines(fragments: PdfTextFragment[], pageHeight: number): PdfTextLine[] {
    const pageLeft = fragments.reduce((left, fragment) => Math.min(left, fragment.x), Infinity);
    const positioned = fragments.map(fragment => ({
      ...fragment,
      y: fragment.y
    })).sort((a, b) => b.y - a.y || a.x - b.x);

    const lines: { y: number; fragments: typeof positioned }[] = [];
    for (const fragment of positioned) {
      const tolerance = Math.max(2, fragment.fontSize * 0.22);
      const line = lines.find(candidate => Math.abs(candidate.y - fragment.y) <= tolerance);
      if (line) {
        line.fragments.push(fragment);
      } else {
        lines.push({ y: fragment.y, fragments: [fragment] });
      }
    }

    return lines
      .sort((a, b) => b.y - a.y)
      .map(line => {
        const sortedFragments = line.fragments.sort((a, b) => a.x - b.x);
        const isCode = sortedFragments.length > 0 && sortedFragments.every(fragment =>
          /mono|courier|consolas|code/i.test(fragment.fontName)
        );
        const joinedText = this.joinFragments(sortedFragments, isCode, pageLeft);
        return {
          y: line.y,
          pageHeight,
          fragments: sortedFragments.map(({ text, x, y, width, fontSize, fontName }) => ({
            text, x, y, width, fontSize, fontName
          })),
          text: isCode ? joinedText.trimEnd() : joinedText.replace(/\s+/g, ' ').trim()
        };
      });
  }

  private joinFragments(fragments: (PdfTextFragment & { y: number })[], isCode: boolean, pageLeft: number): string {
    return fragments.reduce((text, fragment, index) => {
      if (index === 0) {
        if (!isCode || !Number.isFinite(pageLeft)) return fragment.text;
        const characterWidth = fragment.width / Math.max(fragment.text.length, 1);
        const indent = Math.max(0, Math.round((fragment.x - pageLeft) / Math.max(characterWidth, 1)));
        return `${' '.repeat(Math.min(indent, 40))}${fragment.text}`;
      }
      const previous = fragments[index - 1];
      const gap = fragment.x - (previous.x + previous.width);
      const spaceWidth = Math.max(1, Math.min(previous.fontSize, fragment.fontSize) * 0.16);
      let separator = '';
      if (!/\s$/.test(text) && !/^\s/.test(fragment.text) && gap > spaceWidth) {
        if (isCode) {
          const characterWidth = previous.width / Math.max(previous.text.length, 1);
          const spaces = Math.max(1, Math.round(gap / Math.max(characterWidth, 1)));
          separator = ' '.repeat(Math.min(spaces, 40));
        } else {
          separator = ' ';
        }
      }
      return `${text}${separator}${fragment.text}`;
    }, '');
  }

  get markdownContent(): string {
    return toMarkdown(this.getFileTitle(), this.blocks);
  }

  getVisibleBlocks(): PdfTextBlock[] {
    const search = this.searchText.trim().toLocaleLowerCase();
    if (!search) return this.blocks;

    return this.blocks.reduce<PdfTextBlock[]>((visible, block) => {
      if (block.text?.toLocaleLowerCase().includes(search)) {
        visible.push(block);
      } else if (block.rows) {
        const matchingRows = block.rows.filter(row =>
          row.some(cell => cell.toLocaleLowerCase().includes(search))
        );
        if (matchingRows.length) {
          const header = block.rows[0];
          visible.push({
            ...block,
            rows: matchingRows.includes(header) ? matchingRows : [header, ...matchingRows]
          });
        }
      }
      return visible;
    }, []);
  }

  async copyMarkdown(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.markdownContent);
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? `Could not copy Markdown: ${error.message}`
        : 'Could not copy Markdown.';
    }
  }

  downloadMarkdown(): void {
    const blob = new Blob([this.markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.getFileTitle() || 'extracted-pdf'}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  clearSearch(): void {
    this.searchText = '';
  }

  getFileTitle(): string {
    return this.selectedFile.replace(/\.pdf$/i, '');
  }
}

