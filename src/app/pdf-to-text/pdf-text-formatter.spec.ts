import { formatPdfPages, PdfTextFragment, PdfTextLine, toMarkdown } from './pdf-text-formatter';

function line(text: string, y: number, x = 40, fontName = 'Arial'): PdfTextLine {
  const fragment: PdfTextFragment = {
    text,
    x,
    y,
    width: text.length * 5,
    fontSize: 10,
    fontName
  };
  return { text, y, pageHeight: 800, fragments: [fragment] };
}

function tableLine(cells: string[], y: number): PdfTextLine {
  const fragments = cells.map((text, index) => ({
    text,
    x: index === 0 ? 40 : 200,
    y,
    width: text.length * 5,
    fontSize: 10,
    fontName: 'Arial'
  }));
  return { text: cells.join(' '), y, pageHeight: 800, fragments };
}

describe('PDF text formatter', () => {
  it('removes repeated page furniture and joins paragraphs across pages', () => {
    const blocks = formatPdfPages([
      { lines: [line('Company Handbook', 760), line('Opening paragraph', 600), line('Page 1', 20)] },
      { lines: [line('Company Handbook', 760), line('continues on this page.', 700), line('Page 2', 20)] }
    ]);

    expect(blocks).toEqual([
      { type: 'paragraph', text: 'Opening paragraph continues on this page.' }
    ]);
  });

  it('preserves aligned table cells and emits Markdown tables and code fences', () => {
    const blocks = formatPdfPages([{
      lines: [
        tableLine(['Name', 'Description'], 600),
        tableLine(['API', 'Calls endpoint'], 580),
        line('curl -X GET /users', 500, 40, 'Courier')
      ]
    }]);

    expect(blocks[0]).toEqual({
      type: 'table',
      rows: [['Name', 'Description'], ['API', 'Calls endpoint']]
    });
    expect(toMarkdown('API Guide', blocks)).toContain('| Name | Description |\n| --- | --- |\n| API | Calls endpoint |');
    expect(toMarkdown('API Guide', blocks)).toContain('```\ncurl -X GET /users\n```');
  });

  it('merges table continuations without repeating their header row', () => {
    const blocks = formatPdfPages([
      { lines: [tableLine(['Name', 'Description'], 600), tableLine(['API', 'Calls endpoint'], 580)] },
      { lines: [tableLine(['Name', 'Description'], 600), tableLine(['UI', 'Renders page'], 580)] }
    ]);

    expect(blocks).toEqual([{
      type: 'table',
      rows: [
        ['Name', 'Description'],
        ['API', 'Calls endpoint'],
        ['UI', 'Renders page']
      ]
    }]);
  });

  it('orders recognized technical sections without dropping their content', () => {
    const markdown = toMarkdown('Technical Guide', [
      { type: 'paragraph', text: 'Introductory detail.' },
      { type: 'heading', level: 2, text: 'Advantages' },
      { type: 'paragraph', text: 'It is efficient.' },
      { type: 'heading', level: 2, text: 'Examples' },
      { type: 'code', text: 'run-example' }
    ]);

    expect(markdown.indexOf('## Overview')).toBeLessThan(markdown.indexOf('## Examples'));
    expect(markdown.indexOf('## Examples')).toBeLessThan(markdown.indexOf('## Advantages'));
    expect(markdown).toContain('Introductory detail.');
    expect(markdown).toContain('It is efficient.');
    expect(markdown).toContain('run-example');
  });
});
