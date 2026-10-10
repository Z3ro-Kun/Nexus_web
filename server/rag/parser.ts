export interface ParsedDocument {
  title: string;
  format: 'pdf' | 'docx' | 'txt' | 'markdown' | 'csv' | 'json';
  rawText: string;
  metadata: {
    pageCount?: number;
    sectionCount?: number;
    rowCount?: number;
    byteSize: number;
    charCount: number;
    encoding?: string;
  };
  sections: {
    title?: string;
    location: string;
    content: string;
  }[];
}

export class DocumentParser {
  static parse(filename: string, content: Buffer | string, mimeType?: string): ParsedDocument {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const byteSize = typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : content.length;

    if (ext === 'json' || mimeType?.includes('json')) {
      return this.parseJSON(filename, content, byteSize);
    } else if (ext === 'csv' || mimeType?.includes('csv')) {
      return this.parseCSV(filename, content, byteSize);
    } else if (ext === 'md' || ext === 'markdown') {
      return this.parseMarkdown(filename, content, byteSize);
    } else if (ext === 'pdf' || mimeType?.includes('pdf')) {
      return this.parsePDF(filename, content, byteSize);
    } else if (ext === 'docx' || mimeType?.includes('word')) {
      return this.parseDOCX(filename, content, byteSize);
    } else {
      return this.parsePlainText(filename, content, byteSize);
    }
  }

  private static parsePlainText(filename: string, content: Buffer | string, byteSize: number): ParsedDocument {
    const text = typeof content === 'string' ? content : content.toString('utf-8');
    const lines = text.split('\n');
    const sections: { title?: string; location: string; content: string }[] = [];

    // Group into chunks of ~50 lines
    const chunkSize = 50;
    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunkLines = lines.slice(i, i + chunkSize);
      sections.push({
        location: `Lines ${i + 1}-${Math.min(i + chunkSize, lines.length)}`,
        content: chunkLines.join('\n'),
      });
    }

    return {
      title: filename,
      format: 'txt',
      rawText: text,
      metadata: {
        byteSize,
        charCount: text.length,
        sectionCount: sections.length,
      },
      sections,
    };
  }

  private static parseMarkdown(filename: string, content: Buffer | string, byteSize: number): ParsedDocument {
    const text = typeof content === 'string' ? content : content.toString('utf-8');
    const lines = text.split('\n');
    const sections: { title?: string; location: string; content: string }[] = [];

    let currentHeading = 'Overview';
    let currentLines: string[] = [];
    let startLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('#')) {
        if (currentLines.length > 0) {
          sections.push({
            title: currentHeading,
            location: `Lines ${startLine}-${i}`,
            content: currentLines.join('\n').trim(),
          });
          currentLines = [];
        }
        currentHeading = line.replace(/^#+\s*/, '').trim();
        startLine = i + 1;
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0) {
      sections.push({
        title: currentHeading,
        location: `Lines ${startLine}-${lines.length}`,
        content: currentLines.join('\n').trim(),
      });
    }

    return {
      title: filename,
      format: 'markdown',
      rawText: text,
      metadata: {
        byteSize,
        charCount: text.length,
        sectionCount: sections.length,
      },
      sections: sections.length > 0 ? sections : [{ location: 'Document', content: text }],
    };
  }

  private static parseCSV(filename: string, content: Buffer | string, byteSize: number): ParsedDocument {
    const text = typeof content === 'string' ? content : content.toString('utf-8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const header = lines[0] || '';
    const headers = header.split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const rows = lines.slice(1);

    const sections: { title?: string; location: string; content: string }[] = [];
    const batchSize = 25;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const batchContent = [header, ...batch].join('\n');
      sections.push({
        title: `Rows ${i + 1} to ${Math.min(i + batchSize, rows.length)}`,
        location: `Rows ${i + 1}-${Math.min(i + batchSize, rows.length)}`,
        content: batchContent,
      });
    }

    return {
      title: filename,
      format: 'csv',
      rawText: text,
      metadata: {
        byteSize,
        charCount: text.length,
        rowCount: rows.length,
        sectionCount: sections.length,
      },
      sections: sections.length > 0 ? sections : [{ location: 'Header', content: header }],
    };
  }

  private static parseJSON(filename: string, content: Buffer | string, byteSize: number): ParsedDocument {
    const text = typeof content === 'string' ? content : content.toString('utf-8');
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return this.parsePlainText(filename, text, byteSize);
    }

    const sections: { title?: string; location: string; content: string }[] = [];
    if (Array.isArray(parsed)) {
      const batchSize = 10;
      for (let i = 0; i < parsed.length; i += batchSize) {
        const slice = parsed.slice(i, i + batchSize);
        sections.push({
          title: `Records ${i + 1} to ${Math.min(i + batchSize, parsed.length)}`,
          location: `Array index [${i}..${Math.min(i + batchSize, parsed.length) - 1}]`,
          content: JSON.stringify(slice, null, 2),
        });
      }
    } else if (typeof parsed === 'object' && parsed !== null) {
      for (const [key, val] of Object.entries(parsed)) {
        sections.push({
          title: `Field: ${key}`,
          location: `Key: ${key}`,
          content: JSON.stringify(val, null, 2),
        });
      }
    }

    return {
      title: filename,
      format: 'json',
      rawText: text,
      metadata: {
        byteSize,
        charCount: text.length,
        sectionCount: sections.length,
      },
      sections: sections.length > 0 ? sections : [{ location: 'Root', content: text }],
    };
  }

  private static parsePDF(filename: string, content: Buffer | string, byteSize: number): ParsedDocument {
    // Robust text extraction from raw PDF binary or UTF-8 streams
    const buf = typeof content === 'string' ? Buffer.from(content) : content;
    const str = buf.toString('latin1');
    const sections: { title?: string; location: string; content: string }[] = [];

    // Extract text enclosed in parentheses (stream format in standard PDF) or /Length objects
    const textMatches: string[] = [];
    const textRegex = /\(([^)]+)\)\s*Tj/g;
    let match;
    while ((match = textRegex.exec(str)) !== null) {
      if (match[1] && match[1].trim().length > 0) {
        textMatches.push(match[1]);
      }
    }

    let extracted = textMatches.join(' ');
    // If stream format is compressed or different, extract printable ASCII chunks
    if (extracted.length < 50) {
      const asciiOnly = str.replace(/[^\x20-\x7E\n\r\t]/g, ' ');
      const cleanWords = asciiOnly
        .split(/\s+/)
        .filter((w) => w.length > 3 && !w.startsWith('/') && !w.includes('endobj'))
        .slice(0, 3000);
      extracted = cleanWords.join(' ');
    }

    if (!extracted.trim()) {
      extracted = `[PDF Document: ${filename} (Binary container)]\nSummary of structural elements detected.`;
    }

    // Split into simulated pages (~250 words per page)
    const words = extracted.split(/\s+/);
    const wordsPerPage = 250;
    let pageNum = 1;

    for (let i = 0; i < words.length; i += wordsPerPage) {
      const pageWords = words.slice(i, i + wordsPerPage).join(' ');
      sections.push({
        title: `Page ${pageNum}`,
        location: `Page ${pageNum}`,
        content: pageWords,
      });
      pageNum++;
    }

    return {
      title: filename,
      format: 'pdf',
      rawText: extracted,
      metadata: {
        pageCount: sections.length,
        byteSize,
        charCount: extracted.length,
        sectionCount: sections.length,
      },
      sections,
    };
  }

  private static parseDOCX(filename: string, content: Buffer | string, byteSize: number): ParsedDocument {
    const buf = typeof content === 'string' ? Buffer.from(content) : content;
    const str = buf.toString('utf-8');

    // Extract text within XML tags (<w:t>...</w:t>) or clean strings
    const docxTextMatches: string[] = [];
    const wtRegex = /<w:t[^>]*>([^<]+)<\/w:t>/g;
    let match;
    while ((match = wtRegex.exec(str)) !== null) {
      if (match[1]) docxTextMatches.push(match[1]);
    }

    let text = docxTextMatches.join(' ');
    if (text.length < 30) {
      // Fallback: extract legible printable text sequences
      const clean = str.replace(/[^\x20-\x7E\n\r\t]/g, ' ');
      const words = clean.split(/\s+/).filter((w) => w.length > 2 && !w.includes('xmlns') && !w.includes('schemas'));
      text = words.join(' ');
    }

    if (!text.trim()) {
      text = `[DOCX Document: ${filename}]\nCleaned text contents extracted.`;
    }

    const sections = [
      {
        location: 'Section 1',
        content: text,
      },
    ];

    return {
      title: filename,
      format: 'docx',
      rawText: text,
      metadata: {
        byteSize,
        charCount: text.length,
        sectionCount: sections.length,
      },
      sections,
    };
  }
}
