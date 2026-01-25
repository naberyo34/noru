import { describe, expect, it, vi } from 'vitest';
import { AudioSyncEngine } from '../AudioSyncEngine';

class FakeBufferSource {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  startArgs: { when: number; offset: number } | null = null;
  stopped = false;

  connect() {}

  disconnect() {}

  start(when: number, offset: number) {
    this.startArgs = { when, offset };
  }

  stop() {
    this.stopped = true;
    this.onended?.();
  }
}

class FakeAudioContext {
  currentTime = 0;
  state: AudioContextState = 'running';
  destination = {} as AudioDestinationNode;
  createdSources: FakeBufferSource[] = [];
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  close = vi.fn(async () => {});
  decodeAudioData = vi.fn(async (_buffer: ArrayBuffer) => ({ duration: 2 }) as AudioBuffer);

  createBufferSource() {
    const source = new FakeBufferSource();
    this.createdSources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }
}

const createFetch = () =>
  vi.fn(async () => ({
    arrayBuffer: async () => new ArrayBuffer(8),
  })) as unknown as (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

describe('AudioSyncEngine', () => {
  it('suspendedのときにinitializeでresumeされる', async () => {
    const audioContext = new FakeAudioContext();
    audioContext.state = 'suspended';

    const engine = new AudioSyncEngine({
      audioContextFactory: () => audioContext as unknown as AudioContext,
      fetchFn: createFetch(),
    });

    await engine.initialize();

    expect(audioContext.resume).toHaveBeenCalledOnce();
  });

  it('リードインとオフセットを加味した現在時刻を計算する', async () => {
    const audioContext = new FakeAudioContext();
    const fetchFn = createFetch();
    const engine = new AudioSyncEngine({
      audioContextFactory: () => audioContext as unknown as AudioContext,
      fetchFn,
    });

    await engine.initialize();
    await engine.loadAudio('test.wav');
    engine.setLeadInTime(500);
    engine.setOffset(50);

    audioContext.currentTime = 10;
    engine.play();

    audioContext.currentTime = 10.2; // +200ms
    expect(engine.getCurrentTime()).toBeCloseTo(-250, 6);

    audioContext.currentTime = 10.7; // +700ms
    expect(engine.getCurrentTime()).toBeCloseTo(250, 6);
  });

  it('再生中にplayすると前のソースを停止する', async () => {
    const audioContext = new FakeAudioContext();
    const fetchFn = createFetch();
    const engine = new AudioSyncEngine({
      audioContextFactory: () => audioContext as unknown as AudioContext,
      fetchFn,
    });

    await engine.initialize();
    await engine.loadAudio('test.wav');
    engine.play();
    engine.play();

    expect(audioContext.createdSources.length).toBe(2);
    expect(audioContext.createdSources[0].stopped).toBe(true);
  });

  it('未ロード時のdurationは0になる', async () => {
    const audioContext = new FakeAudioContext();
    const engine = new AudioSyncEngine({
      audioContextFactory: () => audioContext as unknown as AudioContext,
      fetchFn: createFetch(),
    });

    await engine.initialize();
    expect(engine.getDuration()).toBe(0);
  });

  it('負のリードインは0にクランプされる', async () => {
    const audioContext = new FakeAudioContext();
    const engine = new AudioSyncEngine({
      audioContextFactory: () => audioContext as unknown as AudioContext,
      fetchFn: createFetch(),
    });

    await engine.initialize();
    await engine.loadAudio('test.wav');
    engine.setLeadInTime(-100);
    audioContext.currentTime = 5;
    engine.play();

    audioContext.currentTime = 5.2;
    expect(engine.getCurrentTime()).toBeCloseTo(200, 6);
  });

  it('停止後のgetCurrentTimeは0を返す', async () => {
    const audioContext = new FakeAudioContext();
    const engine = new AudioSyncEngine({
      audioContextFactory: () => audioContext as unknown as AudioContext,
      fetchFn: createFetch(),
    });

    await engine.initialize();
    await engine.loadAudio('test.wav');
    audioContext.currentTime = 10;
    engine.play();

    audioContext.currentTime = 10.5;
    expect(engine.getCurrentTime()).toBeCloseTo(500, 6);

    engine.stop();
    expect(engine.getCurrentTime()).toBe(0);
  });

  it('dispose後に再度initializeできる', async () => {
    const audioContext1 = new FakeAudioContext();
    const audioContext2 = new FakeAudioContext();
    let callCount = 0;
    const engine = new AudioSyncEngine({
      audioContextFactory: () => {
        callCount++;
        return (callCount === 1 ? audioContext1 : audioContext2) as unknown as AudioContext;
      },
      fetchFn: createFetch(),
    });

    await engine.initialize();
    await engine.loadAudio('test.wav');
    engine.dispose();

    await engine.initialize();
    await engine.loadAudio('test2.wav');
    audioContext2.currentTime = 5;
    engine.play();

    audioContext2.currentTime = 5.1;
    expect(engine.getCurrentTime()).toBeCloseTo(100, 6);
  });
});
