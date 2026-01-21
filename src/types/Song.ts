/**
 * 楽曲データの型定義
 */

export interface Difficulty {
  level: string;
  stars: number;
  chartFile: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  audioFile: string;
  difficulties: Difficulty[];
}
