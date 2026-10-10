import { DocumentChunk } from './chunker.js';

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
  highlight: string;
}

export class DocumentIndexer {
  private chunks: Map<string, DocumentChunk> = new Map();
  private docFrequencies: Map<string, number> = new Map();
  private totalDocs = 0;

  addChunks(chunks: DocumentChunk[]): void {
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);
      const uniqueTokens = new Set(this.tokenize(chunk.text));
      for (const tok of uniqueTokens) {
        this.docFrequencies.set(tok, (this.docFrequencies.get(tok) || 0) + 1);
      }
    }
    this.totalDocs = this.chunks.size;
  }

  removeDocument(docId: string): void {
    const toRemove: string[] = [];
    for (const [id, chunk] of this.chunks.entries()) {
      if (chunk.documentId === docId) {
        toRemove.push(id);
      }
    }
    for (const id of toRemove) {
      this.chunks.delete(id);
    }
    this.recalculateDocFrequencies();
  }

  private recalculateDocFrequencies(): void {
    this.docFrequencies.clear();
    for (const chunk of this.chunks.values()) {
      const uniqueTokens = new Set(this.tokenize(chunk.text));
      for (const tok of uniqueTokens) {
        this.docFrequencies.set(tok, (this.docFrequencies.get(tok) || 0) + 1);
      }
    }
    this.totalDocs = this.chunks.size;
  }

  tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9_\-\.]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2);
  }

  search(query: string, options: { topK?: number; docIdFilter?: string } = {}): SearchResult[] {
    const topK = options.topK || 5;
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0 || this.totalDocs === 0) return [];

    const scores: { chunk: DocumentChunk; score: number; highlight: string }[] = [];

    for (const chunk of this.chunks.values()) {
      if (options.docIdFilter && chunk.documentId !== options.docIdFilter) {
        continue;
      }

      const chunkTokens = this.tokenize(chunk.text);
      if (chunkTokens.length === 0) continue;

      const termCounts: Map<string, number> = new Map();
      for (const t of chunkTokens) {
        termCounts.set(t, (termCounts.get(t) || 0) + 1);
      }

      let tfIdfScore = 0;
      let matchedCount = 0;

      for (const qTok of queryTokens) {
        const tf = (termCounts.get(qTok) || 0) / chunkTokens.length;
        if (tf > 0) {
          matchedCount++;
          const df = this.docFrequencies.get(qTok) || 1;
          const idf = Math.log(1 + (this.totalDocs - df + 0.5) / (df + 0.5));
          tfIdfScore += tf * idf * 10;
        }
      }

      // Exact phrase bonus
      if (chunk.text.toLowerCase().includes(query.toLowerCase().trim())) {
        tfIdfScore += 5.0;
      }

      // If at least one query term matches or exact substring found
      if (tfIdfScore > 0) {
        // Find best highlight snippet
        const highlight = this.extractHighlight(chunk.text, queryTokens);
        scores.push({
          chunk,
          score: tfIdfScore + (matchedCount / queryTokens.length) * 2,
          highlight,
        });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }

  private extractHighlight(text: string, queryTokens: string[]): string {
    const lower = text.toLowerCase();
    let bestPos = -1;

    for (const tok of queryTokens) {
      const idx = lower.indexOf(tok);
      if (idx !== -1) {
        bestPos = idx;
        break;
      }
    }

    if (bestPos === -1) {
      return text.slice(0, 180) + (text.length > 180 ? '...' : '');
    }

    const start = Math.max(0, bestPos - 60);
    const end = Math.min(text.length, bestPos + 120);
    return (start > 0 ? '...' : '') + text.slice(start, end).trim() + (end < text.length ? '...' : '');
  }

  getChunkCount(): number {
    return this.chunks.size;
  }
}

export const globalIndexer = new DocumentIndexer();
