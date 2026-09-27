let context: AudioContext | undefined;
let ambience: AudioBufferSourceNode | undefined;
let volume: GainNode | undefined;
export const startAudio = () => {
  try {
    context ??= new AudioContext();
    void context.resume();
    if (ambience) return;
    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const channel = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < channel.length; i++) { previous = (previous + (Math.random() * 2 - 1) * 0.025) / 1.025; channel[i] = previous * 2; }
    ambience = context.createBufferSource(); ambience.buffer = buffer; ambience.loop = true;
    const filter = context.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 550;
    volume = context.createGain(); volume.gain.value = 0.045;
    ambience.connect(filter).connect(volume).connect(context.destination); ambience.start();
  } catch { /* Audio is optional on browsers without Web Audio. */ }
};
export const muteAudio = (muted: boolean) => { if (volume && context) volume.gain.setTargetAtTime(muted ? 0 : 0.045, context.currentTime, 0.2); };
export const playSound = (kind: "gather" | "build" | "beacon") => {
  if (!context || context.state !== "running") return;
  const notes = kind === "beacon" ? [261.6, 329.6, 392, 523.2] : kind === "build" ? [160, 240] : [660, 880];
  notes.forEach((frequency, index) => {
    if (!context) return;
    const at = context.currentTime + index * 0.1;
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = kind === "build" ? "triangle" : "sine"; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(0.075, at + 0.015); gain.gain.exponentialRampToValueAtTime(0.001, at + 0.65);
    oscillator.connect(gain).connect(context.destination); oscillator.start(at); oscillator.stop(at + 0.7);
  });
};
export const stopAudio = () => { ambience?.stop(); ambience = undefined; if (context) void context.close(); context = undefined; volume = undefined; };
