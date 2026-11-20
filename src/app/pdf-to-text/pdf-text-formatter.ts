export interface PdfTextFragment {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontName: string;
}

export interface PdfTextLine {
  text: string;
  y: number;
  pageHeight: number;
  fragments: PdfTextFragment[];
}

export interface PdfTextPage {
  lines: PdfTextLine[];
}

export interface PdfTextBlock {
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'code';
  text?: string;
  level?: number;
  rows?: string[][];
}

interface TableCandidate {
  cells: string[];
  columns: number[];
}

export function formatPdfPages(pages: PdfTextPage[]): PdfTextBlock[] {
  const repeatedFurniture = findRepeatedFurniture(pages);
  const result: PdfTextBlock[] = [];

  pages.forEach(page => {
    const lines = page.lines.filter(line => {
      const signature = normalizeFurniture(line.text);
      const relativeY = line.y / line.pageHeight;
      const isPageBoundary = relativeY >= 0.92 || relativeY <= 0.08;
      return !(isPageBoundary && repeatedFurniture.has(signature));
    });
    const tableRows = findTableRows(lines);
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];
      const table = tableRows.get(index);
      if (table) {
        const rows: string[][] = [];
        let next = index;
        while (tableRows.has(next)) {
          rows.push(tableRows.get(next)!.cells);
          next++;
        }
        result.push({ type: 'table', rows });
        index = next;
        continue;
      }

      const text = line.text.trim();
      if (!text) {
        index++;
        continue;
      }

      const headingLevel = getHeadingLevel(line, lines);
      if (headingLevel) {
        result.push({ type: 'heading', level: headingLevel, text });
        index++;
        continue;
      }

      if (/^(?:[-*•▪◦]|\d+[.)])\s*/.test(text)) {
        result.push({ type: 'list', text: normalizeListMarker(text) });
        index++;
        continue;
      }

      if (isMonospaced(line)) {
        const codeLines: string[] = [];
        while (index < lines.length && isMonospaced(lines[index]) && lines[index].text.trim()) {
          codeLines.push(lines[index].text.trimEnd());
          index++;
        }
        result.push({ type: 'code', text: codeLines.join('\n') });
        continue;
      }

      const paragraphLines = [text];
      index++;
      while (
        index < lines.length &&
        !tableRows.has(index) &&
        !getHeadingLevel(lines[index], lines) &&
        !/^(?:[-*•▪◦]|\d+[.)])\s*/.test(lines[index].text.trim()) &&
        !isMonospaced(lines[index]) &&
        lines[index].text.trim()
      ) {
        paragraphLines.push(lines[index].text.trim());
        index++;
      }
      result.push({ type: 'paragraph', text: paragraphLines.join(' ') });
    }
  });

  return organizeTechnicalSections(mergeAdjacentBlocks(result));
}

export function toMarkdown(title: string, blocks: PdfTextBlock[]): string {
  const output = [`# ${title.trim() || 'Extracted PDF'}`, ''];
  const markdownBlocks = organizeTechnicalSections(blocks);

  markdownBlocks.forEach(block => {
    if (block.type === 'heading') {
      output.push(`${'#'.repeat(Math.min(Math.max(block.level || 2, 2), 6))} ${block.text}`);
      output.push('');
    } else if (block.type === 'paragraph') {
      output.push(block.text || '', '');
    } else if (block.type === 'list') {
      if (output[output.length - 1] !== '') output.push('');
      output.push(block.text || '');
    } else if (block.type === 'code') {
      output.push('```', block.text || '', '```', '');
    } else if (block.type === 'table' && block.rows?.length) {
      const columnCount = Math.max(...block.rows.map(row => row.length));
      const rows = block.rows.map(row =>
        Array.from({ length: columnCount }, (_, column) => escapeTableCell(row[column] || ''))
      );
      output.push(`| ${rows[0].join(' | ')} |`);
      output.push(`| ${rows[0].map(() => '---').join(' | ')} |`);
      rows.slice(1).forEach(row => output.push(`| ${row.join(' | ')} |`));
      output.push('');
    }
  });

  return output.join('\n').trimEnd();
}

function organizeTechnicalSections(blocks: PdfTextBlock[]): PdfTextBlock[] {
  const sectionOrder = [
    'Overview',
    'Key Concepts',
    'Detailed Explanation',
    'Examples',
    'Advantages',
    'Disadvantages',
    'Best Practices',
    'Interview Questions & Answers',
    'Summary'
  ];
  const headings = new Map<string, string>([
    ['overview', 'Overview'],
    ['introduction', 'Overview'],
    ['background', 'Overview'],
    ['key concepts', 'Key Concepts'],
    ['concepts', 'Key Concepts'],
    ['detailed explanation', 'Detailed Explanation'],
    ['explanation', 'Detailed Explanation'],
    ['examples', 'Examples'],
    ['example', 'Examples'],
    ['advantages', 'Advantages'],
    ['advantage', 'Advantages'],
    ['benefits', 'Advantages'],
    ['disadvantages', 'Disadvantages'],
    ['disadvantage', 'Disadvantages'],
    ['limitations', 'Disadvantages'],
    ['best practices', 'Best Practices'],
    ['interview questions', 'Interview Questions & Answers'],
    ['interview questions and answers', 'Interview Questions & Answers'],
    ['interview questions & answers', 'Interview Questions & Answers'],
    ['summary', 'Summary'],
    ['conclusion', 'Summary']
  ]);
  const hasStandardHeading = blocks.some(block =>
    block.type === 'heading' && headings.has(normalizeHeading(block.text || ''))
  );
  if (!hasStandardHeading) return blocks;

  const sections = new Map<string, PdfTextBlock[]>();
  let currentSection = 'Overview';
  blocks.forEach(block => {
    if (block.type === 'heading') {
      const standardHeading = headings.get(normalizeHeading(block.text || ''));
      if (standardHeading) {
        currentSection = standardHeading;
        const section = sections.get(currentSection) || [];
        section.push({ ...block, level: 2, text: currentSection });
        sections.set(currentSection, section);
        return;
      }
    }

    const section = sections.get(currentSection) || [];
    section.push(block);
    sections.set(currentSection, section);
  });

  return sectionOrder.flatMap(title => {
    const section = sections.get(title);
    if (!section?.length) return [];
    const startsWithTitle = section[0].type === 'heading' && section[0].text === title;
    return startsWithTitle ? section : [{ type: 'heading', level: 2, text: title }, ...section];
  });
}

function normalizeHeading(text: string): string {
  return text.toLocaleLowerCase().replace(/^\s*\d+(?:\.\d+)*[.)]?\s*/, '').replace(/\s+/g, ' ').trim();
}

function findRepeatedFurniture(pages: PdfTextPage[]): Set<string> {
  if (pages.length < 2) return new Set<string>();

  const counts = new Map<string, number>();
  pages.forEach(page => {
    const boundaryLines = new Set(page.lines
      .filter(line => {
        const relativeY = line.y / line.pageHeight;
        return relativeY >= 0.92 || relativeY <= 0.08;
      })
      .map(line => normalizeFurniture(line.text))
      .filter(Boolean));
    boundaryLines.forEach(signature => counts.set(signature, (counts.get(signature) || 0) + 1));
  });

  const minimumPages = Math.max(2, Math.ceil(pages.length * 0.6));
  return new Set([...counts.entries()]
    .filter(([, count]) => count >= minimumPages)
    .map(([signature]) => signature));
}

function normalizeFurniture(text: string): string {
  return text.toLowerCase()
    .replace(/\bpage\s+\d+(?:\s+of\s+\d+)?\b/g, 'page #')
    .replace(/\b\d+\s*\/\s*\d+\b/g, '#/#')
    .replace(/\s+/g, ' ')
    .trim();
}

function findTableRows(lines: PdfTextLine[]): Map<number, TableCandidate> {
  const candidates = new Map<number, TableCandidate>();
  lines.forEach((line, index) => {
    const fragments = line.fragments
      .map(fragment => ({ ...fragment }))
      .filter(fragment => fragment.text.trim())
      .sort((a, b) => a.x - b.x);
    if (fragments.length < 2) return;

    const columns = [fragments[0].x];
    for (let i = 1; i < fragments.length; i++) {
      const previous = fragments[i - 1];
      const gap = fragments[i].x - (previous.x + previous.width);
      if (gap >= Math.max(12, previous.fontSize * 1.5)) {
        columns.push(fragments[i].x);
      } else {
        fragments[i - 1].text = `${fragments[i - 1].text} ${fragments[i].text}`.trim();
        fragments[i - 1].width = fragments[i].x + fragments[i].width - fragments[i - 1].x;
        fragments.splice(i, 1);
        i--;
      }
    }

    if (columns.length >= 2 && fragments.length === columns.length) {
      candidates.set(index, {
        columns,
        cells: fragments.map(fragment => fragment.text.trim())
      });
    }
  });

  const accepted = new Map<number, TableCandidate>();
  [...candidates.entries()].forEach(([index, candidate]) => {
    const hasAlignedNeighbor = [index - 1, index + 1].some(neighborIndex => {
      const neighbor = candidates.get(neighborIndex);
      return Boolean(neighbor && alignedColumns(candidate.columns, neighbor.columns));
    });
    if (hasAlignedNeighbor) accepted.set(index, candidate);
  });
  return accepted;
}

function alignedColumns(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((x, index) => Math.abs(x - right[index]) <= 12);
}

function getHeadingLevel(line: PdfTextLine, lines: PdfTextLine[]): number | null {
  const fontSize = largestFontSize(line);
  const bodySizes = lines
    .filter(candidate => !isMonospaced(candidate))
    .map(largestFontSize)
    .filter(size => size > 0)
    .sort((a, b) => a - b);
  if (!fontSize || !bodySizes.length) return null;

  const medianBodySize = bodySizes[Math.floor((bodySizes.length - 1) / 2)];
  const bold = line.fragments.some(fragment => /bold|heavy|black/i.test(fragment.fontName));
  if (fontSize >= medianBodySize * 1.45) return 2;
  if (fontSize >= medianBodySize * 1.18 && bold) return 3;
  if (/^[A-Z][A-Z0-9 _&/()-]{5,}$/.test(line.text.trim())) return 3;
  return null;
}

function largestFontSize(line: PdfTextLine): number {
  return line.fragments.reduce((largest, fragment) => Math.max(largest, fragment.fontSize), 0);
}

function isMonospaced(line: PdfTextLine): boolean {
  return line.fragments.length > 0 && line.fragments.every(fragment =>
    /mono|courier|consolas|code/i.test(fragment.fontName)
  );
}

function normalizeListMarker(text: string): string {
  const numbered = text.match(/^(\d+[.)])\s*(.*)$/);
  if (numbered) return `${numbered[1]} ${numbered[2]}`;
  return `- ${text.replace(/^[-*•▪◦]\s*/, '')}`;
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>').trim();
}

function mergeAdjacentBlocks(blocks: PdfTextBlock[]): PdfTextBlock[] {
  const merged: PdfTextBlock[] = [];
  blocks.forEach(block => {
    const previous = merged[merged.length - 1];
    if (block.type === 'table' && previous?.type === 'table' && previous.rows && block.rows) {
      const repeatedHeader = JSON.stringify(previous.rows[0]) === JSON.stringify(block.rows[0]);
      previous.rows.push(...block.rows.slice(repeatedHeader ? 1 : 0));
    } else if (block.type === 'paragraph' && previous?.type === 'paragraph') {
      previous.text = `${previous.text} ${block.text}`.trim();
    } else if (block.type === 'code' && previous?.type === 'code') {
      previous.text = `${previous.text}\n${block.text}`;
    } else {
      merged.push(block);
    }
  });
  return merged;
}
