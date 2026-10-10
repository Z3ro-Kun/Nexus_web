import { ParsedDocument } from './parser.js';

export interface DocumentChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  location: string;
  text: string;
  charCount: number;
  tokenCount: number;
  metadata: Record<string, any>;
}

export interface ChunkerOptions {
  maxChunkChars?: number;
  chunkOverlapChars?: number;
}

export class DocumentChunker {
  static chunk(docId: string, parsed: ParsedDocument, options: ChunkerOptions = {}): DocumentChunk[] {
    const maxChars = options.maxChunkChars || 800;
    const overlap = options.chunkOverlapChars || 120;
    const chunks: DocumentChunk[] = [];
    let chunkCounter = 0;

    for (const sec of parsed.sections) {
      const text = sec.content.trim();
      if (!text) continue;

      if (text.length <= maxChars) {
        chunkCounter++;
        chunks.push({
          id: `${docId}_chk_${chunkCounter}`,
          documentId: docId,
          documentTitle: parsed.title,
          location: sec.location + (sec.title ? ` (${sec.title})` : ''),
          text,
          charCount: text.length,
          tokenCount: Math.ceil(text.length / 4),
          metadata: {
            format: parsed.format,
            sectionTitle: sec.title,
          },
        });
      } else {
        // Sliding window with overlap
        let start = 0;
        while (start < text.length) {
          let end = Math.min(start + maxChars, text.length);
          // Try to break at newline or punctuation boundary
          if (end < text.length) {
            const boundary = text.lastIndexOf('\n', end);
            if (boundary > start + maxChars * 0.5) {
              end = boundary;
            } else {
              const period = text.lastIndexOf('. ', end);
              if (period > start + maxChars * 0.5) {
                end = period + 1;
              }
            }
          }

          const chunkText = text.substring(start, end).trim();
          if (chunkText.length > 0) {
            chunkCounter++;
            chunks.push({
              id: `${docId}_chk_${chunkCounter}`,
              documentId: docId,
              documentTitle: parsed.title,
              location: `${sec.location} [offset ${start}..${end}]`,
              text: chunkText,
              charCount: chunkText.length,
              tokenCount: Math.ceil(chunkText.length / 4),
              metadata: {
                format: parsed.format,
                sectionTitle: sec.title,
              },
            });
          }

          if (end >= text.length) break;
          start = Math.max(start + 1, end - overlap);
        }
      }
    }

    return chunks;
  }
}
