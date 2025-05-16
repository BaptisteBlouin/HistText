declare module 'chinese-tokenizer' {
  export interface Token {
    text: string;
    traditional: string;
    simplified: string;
    position: {
      offset: number;
      line: number;
      column: number;
    };
    matches: Array<{
      pinyin: string;
      pinyinPretty: string;
      english: string;
    }>;
  }

  export interface Tokenizer {
    (text: string): Token[];
  }

  export function loadFile(dictPath: string): Tokenizer;
}
