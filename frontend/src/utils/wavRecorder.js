/**
 * wavRecorder.js
 * High-performance 16kHz mono PCM WAV recorder for Voice Biometrics & Hey Voxa wake engine.
 * Pure Web Audio API — zero external dependencies, works across modern browsers.
 */

export class WavAudioRecorder {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.scriptProcessor = null;
    this.sourceNode = null;
    this.recordedChunks = [];
    this.isRecording = false;
  }

  async start() {
    this.recordedChunks = [];
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('Web Audio API not supported in this browser');
    }

    this.audioContext = new AudioContextClass();
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    // Buffer size 4096 gives smooth latency / CPU balance
    this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.scriptProcessor.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const channelData = e.inputBuffer.getChannelData(0);
      this.recordedChunks.push(new Float32Array(channelData));
    };

    this.sourceNode.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext.destination);
    this.isRecording = true;
  }

  stop() {
    this.isRecording = false;

    if (this.scriptProcessor && this.sourceNode) {
      this.sourceNode.disconnect();
      this.scriptProcessor.disconnect();
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
    }

    const sampleRate = this.audioContext ? this.audioContext.sampleRate : 44100;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }

    // Merge recorded chunks
    let totalLength = 0;
    for (const chunk of this.recordedChunks) {
      totalLength += chunk.length;
    }

    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.recordedChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // Downsample to standard 16,000 Hz for voice biometrics
    const downsampled = downsampleBuffer(merged, sampleRate, 16000);
    const wavBuffer = encodeWAV(downsampled, 16000);
    const base64 = arrayBufferToBase64(wavBuffer);

    return {
      durationSeconds: downsampled.length / 16000,
      sampleRate: 16000,
      wavBuffer,
      base64,
    };
  }
}

/**
 * Downsamples float buffer to target sample rate via linear area averaging.
 */
function downsampleBuffer(buffer, sampleRate, outSampleRate = 16000) {
  if (outSampleRate === sampleRate) return buffer;
  if (outSampleRate > sampleRate) return buffer;

  const sampleRateRatio = sampleRate / outSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

/**
 * Encodes Float32 mono audio to 16-bit PCM RIFF WAV format.
 */
function encodeWAV(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat 1 = PCM
  view.setUint16(22, 1, true); // NumChannels 1 = Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // ByteRate = SampleRate * NumChannels * BitsPerSample/8
  view.setUint16(32, 2, true); // BlockAlign = NumChannels * BitsPerSample/8
  view.setUint16(34, 16, true); // BitsPerSample = 16

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // PCM 16-bit samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buffer;
}

/**
 * Converts ArrayBuffer to Base64 string.
 */
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// ── Synthesized Chimes (Dual Tone Web Audio) ───────────────────────────────────

export function playWakeChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // First bell: 540 Hz (warm acoustic harmonic)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(540, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second bell: 820 Hz (upward bright chime)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(820, now + 0.08);
    gain2.gain.setValueAtTime(0, now + 0.08);
    gain2.gain.linearRampToValueAtTime(0.24, now + 0.10);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.33);
  } catch (err) {
    console.debug('Wake chime notice:', err);
  }
}

export function playSuccessChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880.00, now + 0.10); // A5
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  } catch (err) {
    console.debug('Success chime notice:', err);
  }
}

export function playDeniedChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.setValueAtTime(180, now + 0.12);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  } catch (err) {
    console.debug('Denied chime notice:', err);
  }
}
