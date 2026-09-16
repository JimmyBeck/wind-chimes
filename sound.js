/**
 * sound.js - 金鱼梦 声景与物理风铃交互音频系统
 * 1. 原生高品质夏日风铃音轨播放器 (wind_chime.m4a / wind_chime.wav)
 * 2. Web Audio API 物理五声音阶琉璃金属谐波风铃合成器 (支持拂过发声、空间立体声混音)
 */

class ChimeAudioSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = false;
    this.volume = 0.75;
    this.bgAudio = null;
    this.bgPlaying = false;
    this.interactiveEnabled = true;

    // 中国经典清幽五声音阶 (宫商角徵羽 高八度清脆风铃频段)
    // C6, D6, E6, G6, A6, C7, D7, E7, G7, A7
    this.pentatonicFrequencies = [
      1046.50, // 宫 (C6)
      1174.66, // 商 (D6)
      1318.51, // 角 (E6)
      1567.98, // 徵 (G6)
      1760.00, // 羽 (A6)
      2093.00, // 宫 (C7)
      2349.32, // 商 (D7)
      2637.02, // 角 (E7)
      3135.96, // 徵 (G7)
      3520.00  // 羽 (A7)
    ];

    this.lastPlayTime = 0;
    this.initBgAudio();
  }

  initContext() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  initBgAudio() {
    try {
      this.bgAudio = new Audio();
      this.bgAudio.src = "wind_chime.m4a";
      this.bgAudio.loop = true;
      this.bgAudio.volume = this.volume;
      this.bgAudio.crossOrigin = "anonymous";
      this.bgAudio.onerror = () => {
        // 若 m4a 加载失败尝试 wav
        if (this.bgAudio.src.endsWith("wind_chime.m4a")) {
          this.bgAudio.src = "wind_chime.wav";
        }
      };
    } catch (e) {
      console.warn("Background audio not supported:", e);
    }
  }

  startAmbientLoop() {
    this.stopAmbientLoop();
    const triggerNext = () => {
      if (!this.bgPlaying) return;
      const strandIdx = Math.floor(Math.random() * 26);
      const vel = 0.35 + Math.random() * 0.45;
      const pan = (Math.random() - 0.5) * 1.6;
      this.playChime(strandIdx, vel, pan);
      const nextDelay = 800 + Math.random() * 2000;
      this.ambientTimer = setTimeout(triggerNext, nextDelay);
    };
    triggerNext();
  }

  stopAmbientLoop() {
    if (this.ambientTimer) {
      clearTimeout(this.ambientTimer);
      this.ambientTimer = null;
    }
  }

  toggleBgAudio(forceState) {
    this.initContext();
    const target = forceState !== undefined ? forceState : !this.bgPlaying;
    if (target) {
      this.bgPlaying = true;
      if (this.bgAudio) {
        this.bgAudio.play().catch(() => {
          this.startAmbientLoop();
        });
      } else {
        this.startAmbientLoop();
      }
    } else {
      if (this.bgAudio) {
        try { this.bgAudio.pause(); } catch(e) {}
      }
      this.stopAmbientLoop();
      this.bgPlaying = false;
    }
    return this.bgPlaying;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
    if (this.bgAudio) {
      this.bgAudio.volume = this.isMuted ? 0 : this.volume;
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.setVolume(this.volume);
    return this.isMuted;
  }

  /**
   * 触发单次清脆琉璃/金属风铃击鸣
   * @param {number} strandIndex 弦号 (决定音高)
   * @param {number} velocity 拨动力度 0~1
   * @param {number} panX 空间立体声相位 -1(左) ~ 1(右)
   */
  playChime(strandIndex = 0, velocity = 0.6, panX = 0) {
    if (!this.interactiveEnabled || this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    // 防止同帧声音堆叠爆音
    const now = this.ctx.currentTime;
    if (now - this.lastPlayTime < 0.045) return;
    this.lastPlayTime = now;

    const noteIdx = Math.abs(strandIndex) % this.pentatonicFrequencies.length;
    const baseFreq = this.pentatonicFrequencies[noteIdx];

    // 风铃的非谐波金属/玻璃分音参数 (Inharmonic partials)
    const partials = [
      { ratio: 1.00, amp: 1.00, decay: 1.6 },
      { ratio: 2.76, amp: 0.55, decay: 1.1 },
      { ratio: 5.40, amp: 0.30, decay: 0.7 },
      { ratio: 8.93, amp: 0.15, decay: 0.4 }
    ];

    // 空间立体声 Panner
    let outNode = this.masterGain;
    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, panX)), now);
      panner.connect(this.masterGain);
      outNode = panner;
    }

    const vel = Math.max(0.15, Math.min(1.0, velocity));

    // 逐个生成分音振荡器
    partials.forEach(p => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // 正弦与微量三角波混合出金属与玻璃质感
      osc.type = "sine";
      osc.frequency.setValueAtTime(baseFreq * p.ratio, now);

      // 极轻微音高下弯微颤，模拟金属撞击张力变化
      osc.frequency.exponentialRampToValueAtTime(baseFreq * p.ratio * 0.996, now + p.decay);

      // 包络线：瞬态敲击 (Attack 1.5ms) + 指数平滑释音 (Exponential Decay)
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(vel * p.amp * 0.22, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.00001, now + p.decay);

      osc.connect(gain);
      gain.connect(outNode);

      osc.start(now);
      osc.stop(now + p.decay + 0.05);
    });
  }
}

if (typeof window !== "undefined") {
  window.ChimeAudioSystem = ChimeAudioSystem;
}
