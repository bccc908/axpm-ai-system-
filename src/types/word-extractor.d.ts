declare module "word-extractor" {
  export default class WordExtractor {
    extract(source: string): Promise<{
      getBody(): string;
      getHeaders(options?: { includeFooters?: boolean }): string;
      getFootnotes(): string;
    }>;
  }
}
