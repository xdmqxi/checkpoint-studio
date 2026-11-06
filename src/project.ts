import type { LiveText } from "./compositor";
export type Take = {
  id: string;
  video: string;
  name?: string;
  mic?: string;
  system?: string;
  duration: number;
  textEvents?: { time: number; text: LiveText }[];
};
export type Clip = {
  id: string;
  takeId: string;
  in: number;
  out: number;
  volume?: number;
  muted?: boolean;
};
export type AudioTrack = {
  id: string;
  path: string;
  name: string;
  start: number;
  in: number;
  out: number;
  duration?: number;
  volume: number;
  lane?: number;
  muted?: boolean;
  fadeIn?: number;
  fadeOut?: number;
  peaks?: number[];
  assetId?: string;
};
export type Project = {
  version: number;
  name: string;
  takes: Take[];
  clips: Clip[];
  audioTracks?: AudioTrack[];
  audioLibrary?: AudioTrack[];
  checkpoints: {
    id: string;
    name: string;
    time: number;
    takeId?: string;
    sourceTime?: number;
    clipId?: string;
  }[];
  volume: { mic: number; system: number };
};
