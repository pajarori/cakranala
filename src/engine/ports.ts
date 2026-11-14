export interface Embedder {
  embed(texts: string[]): Promise<Float32Array[]>;
}

export interface Reasoner {
  complete(prompt: string, opts?: { system?: string; json?: boolean; images?: string[] }): Promise<string>;
}
