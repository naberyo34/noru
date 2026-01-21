/**
 * Simple WAV file generator for testing
 * Generates a test audio file with beeps at 120 BPM
 */

const fs = require('node:fs');
const path = require('node:path');

// WAV file parameters
const SAMPLE_RATE = 44100;
const DURATION = 20; // seconds
const NUM_CHANNELS = 2; // stereo
const BITS_PER_SAMPLE = 16;

// Generate audio buffer
function generateAudioBuffer() {
  const numSamples = SAMPLE_RATE * DURATION;
  const buffer = Buffer.alloc(numSamples * NUM_CHANNELS * (BITS_PER_SAMPLE / 8));

  const bpm = 120;
  const beatDuration = 60 / bpm; // seconds per beat

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;

    // Create a simple melody with rhythm
    let sample = 0;

    // Bass drum on every beat
    const beatPhase = (t % beatDuration) / beatDuration;
    if (beatPhase < 0.1) {
      sample += Math.sin(2 * Math.PI * 80 * t) * Math.exp(-beatPhase * 50) * 0.5;
    }

    // Hi-hat on every half beat
    const halfBeatPhase = (t % (beatDuration / 2)) / (beatDuration / 2);
    if (halfBeatPhase < 0.05) {
      // White noise for hi-hat
      sample += (Math.random() * 2 - 1) * Math.exp(-halfBeatPhase * 100) * 0.15;
    }

    // Melody (simple sine wave pattern)
    const _bar = Math.floor(t / (beatDuration * 4));
    const beatInBar = Math.floor((t % (beatDuration * 4)) / beatDuration);

    const notes = [262, 294, 330, 349, 392, 440, 494, 523]; // C major scale
    const noteFreq = notes[beatInBar % notes.length];

    // Add melody on certain beats
    if (t >= 2.0 && beatPhase < 0.3) {
      sample += Math.sin(2 * Math.PI * noteFreq * t) * 0.2;
    }

    // Clamp to [-1, 1]
    sample = Math.max(-1, Math.min(1, sample));

    // Convert to 16-bit PCM
    const pcmSample = Math.floor(sample * 32767);

    // Write to buffer (stereo)
    const offset = i * NUM_CHANNELS * (BITS_PER_SAMPLE / 8);
    buffer.writeInt16LE(pcmSample, offset); // Left channel
    buffer.writeInt16LE(pcmSample, offset + 2); // Right channel
  }

  return buffer;
}

// Create WAV header
function createWavHeader(dataSize) {
  const header = Buffer.alloc(44);

  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);

  // fmt chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(NUM_CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * NUM_CHANNELS * (BITS_PER_SAMPLE / 8), 28); // byte rate
  header.writeUInt16LE(NUM_CHANNELS * (BITS_PER_SAMPLE / 8), 32); // block align
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);

  // data chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return header;
}

// Generate and save WAV file
function generateWavFile(outputPath) {
  console.log('Generating test audio...');

  const audioBuffer = generateAudioBuffer();
  const header = createWavHeader(audioBuffer.length);
  const wavData = Buffer.concat([header, audioBuffer]);

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, wavData);
  console.log(`Test audio generated: ${outputPath}`);
  console.log(`Duration: ${DURATION}s, Sample Rate: ${SAMPLE_RATE}Hz, BPM: 120`);
}

// Run
const outputPath = path.join(__dirname, '../public/assets/audio/test-song.wav');
generateWavFile(outputPath);
