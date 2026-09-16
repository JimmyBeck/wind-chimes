/**
 * sketch.js - 金鱼梦 交互主循环与 Verlet 软绳渲染流水线
 * 遵循单源配置原则（Single Source of Truth），所有可调参数统一在顶部集中暴露
 */

// ==========================================
// 全局可调参数配置 (Single Source of Truth)
// ==========================================
const CONFIG = {
  // 结构参数
  numRings: 7,            // 同心圆环数 (3~8)
  numStrands: 34,         // 垂线总数 (12~48)
  topRadius: 195,         // 顶部外环半径 (px)
  dropLength: 680,        // 悬垂深度 (px)
  spreadRatio: 0.95,      // 底部微扩散收拢比例
  ringPitch: 0.38,        // 3D俯视仰角倾斜度

  // 挂件形态与算法参数
  pendantType: "koi",     // 挂件形态: koi (锦鲤), butterfly (彩蝶), ginkgo (银杏叶), crane (千纸鹤), custom (自定义)
  koiCount: 26,           // 挂件总数 (4~45)
  koiScale: 1.05,         // 尺寸缩放倍率 (0.6~1.8)
  koiSpeed: 1.0,          // 游频/扇翅速率 (0.4~2.2)
  koiWiggleAmp: 1.0,      // 摆幅大小 (0.3~2.0)
  koiColorTheme: "cinnabar", // 配色方案: cinnabar (朱砂), golden (赤金), cyan (翠微), monochrome (水墨), iridescent (幻锦)
  koiFacingMode: "auto",  // 游动朝向: auto (自由交错), cw (顺时针), ccw (逆时针)

  // 琉璃珠饰与空间晶石
  beadDensity: 1.0,       // 串珠密度倍率
  beadSize: 1.0,          // 珠粒大小倍率
  beadTheme: "blueGreen", // 琉璃色泽: blueGreen (天青翡翠), amberGold (琥珀流金), purpleCrystal (紫玉荧晶), iceWhite (冰雪清透)
  dewParticles: true,     // 飘落水露微粒

  // 物理核心：微弱重力、柳叶垂落、超低频柔性风动与圆锥软限幅
  gravity: 0.055,         // 微弱重力回复力 (0.01~0.25，柔顺回正拉力)
  segPhaseLag: 0.42,      // 沿线每节非同步相位差 (0.1~0.8 rad，形成轻柔S波)
  windFlutter: 1.0,       // 非同步微风波纹灵动度
  waveTension: 0.28,      // 沿线弹性波传导张力
  airDrag: 0.92,          // 空气流体阻尼 (0.86~0.96，消退柔韧度)
  windStrength: 1.0,      // 基础微风强度
  mouseForce: 1.2,        // 鼠标流体推力 (如清风拂过)
  autoRotateSpeed: 0.0028,// 顶部吊环慢速自转角速度
  strandWidth: 0.45,      // 极细银丝线宽 (px)
  pendulumAmp: 5.5,       // 全局顶部悬挂微幅钟摆晃动摆幅 (px)

  // 背景
  bgTheme: "ricePaper",   // 背景底色: ricePaper (澄心堂暖宣白), warmSilk (温润素绢), bambooGreen (潇湘竹青), darkNight (玄夜玄墨)

  // 音频设置
  bgAudioEnabled: false,  // 原声风铃背景音
  chimeAudioEnabled: true,// 触碰交互发声
  volume: 0.75            // 主音量
};

if (typeof window !== "undefined") {
  window.CONFIG = CONFIG;
}

function hash(seed) {
  let s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

class VerletNode {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.ox = x;
    this.oy = y;
    this.oz = z;
  }
}

class WindChimeApp {
  constructor() {
    this.canvas = document.getElementById("chimeCanvas");
    this.ctx = this.canvas.getContext("2d");

    // 全局设置参数：严格继承自顶部 CONFIG
    this.config = Object.assign({}, window.CONFIG || CONFIG);

    // 运行状态
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // 3D 旋转角度与惯性
    this.rotY = 0;
    this.rotX = this.config.ringPitch;
    this.targetRotX = this.rotX;
    this.rotVelocityY = this.config.autoRotateSpeed;

    this.mouse = { x: -1000, y: -1000, vx: 0, vy: 0, prevX: 0, prevY: 0, isDown: false };
    this.mouseDownPos = { x: 0, y: 0 };
    this.time = 0;

    this.customImage = null;
    this.unfoldProgress = 1.0;
    this.isUnfolding = false;
    this.unfoldStartTime = 0;

    // 悬挂钟摆与阵风波脉
    this.chimeCenter = { x: 0, z: 0 };
    this.gusts = [];

    // 实体集合
    this.rings = [];
    this.strands = [];
    this.kois = [];
    this.particles = [];

    // 音频系统
    this.audio = new ChimeAudioSystem();

    this.initCanvas();
    this.buildChimeStructure();
    this.initParticles();
    this.bindEvents();

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  initCanvas() {
    const w = window.innerWidth || document.documentElement.clientWidth;
    const h = window.innerHeight || document.documentElement.clientHeight;
    this.width = w > 50 ? w : 1280;
    this.height = h > 50 ? h : 800;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = this.width + "px";
    this.canvas.style.height = this.height + "px";
    this.ctx.scale(this.dpr, this.dpr);
  }

  triggerUnfoldAnimation() {
    this.isUnfolding = true;
    this.unfoldProgress = 0.0;
    this.unfoldStartTime = performance.now();
  }

  triggerGust(power = 1.0) {
    this.gusts.push({
      startTime: this.time,
      power: power
    });
    if (this.gusts.length > 5) this.gusts.shift();
    if (this.audio) {
      const strandIdx = Math.floor(Math.random() * (this.strands.length || 1));
      this.audio.playChime(strandIdx, 0.85, 0);
    }
  }

  buildChimeStructure() {
    this.rings = [];
    this.strands = [];
    this.kois = [];

    const numR = this.config.numRings;
    const maxR = this.config.topRadius;

    // 1. 同心圆环
    for (let i = 0; i < numR; i++) {
      const r = maxR * ((i + 1) / numR);
      this.rings.push({
        index: i,
        radius: r,
        y: 0
      });
    }

    // 2. 构建多质点柔性软绳垂线
    const numS = this.config.numStrands;
    const numNodes = 18; // 每根垂线 18 个质点，支持细腻连续的非同步 S 形柳条波浪

    for (let i = 0; i < numS; i++) {
      const ringIdx = Math.floor(Math.sqrt(Math.random()) * numR);
      const ring = this.rings[Math.min(ringIdx, numR - 1)];

      const angle = (i / numS) * Math.PI * 2 + (ringIdx * 0.45);
      const radius = ring.radius;
      const baseLen = this.config.dropLength * (0.82 + 0.28 * Math.random());
      const segLen = baseLen / (numNodes - 1);

      // 顶部世界坐标
      const topX = Math.cos(angle + this.rotY) * radius;
      const topY = 0;
      const topZ = Math.sin(angle + this.rotY) * radius;

      // 初始化 18 个质点
      const nodes = [];
      for (let n = 0; n < numNodes; n++) {
        const ny = topY + n * segLen;
        nodes.push(new VerletNode(topX, ny, topZ));
      }

      // 晶石珠子 (疏密有致，如露珠点缀细丝)
      const beads = [];
      const numBeads = Math.floor((5 + Math.random() * 4) * this.config.beadDensity);
      for (let b = 0; b < numBeads; b++) {
        const ratio = (b + 1) / (numBeads + 1) + (Math.random() - 0.5) * 0.05;
        beads.push({
          ratio: Math.max(0.08, Math.min(0.95, ratio)),
          type: Math.random() > 0.45 ? "blue" : "green",
          size: (2.2 + Math.random() * 1.8) * this.config.beadSize,
          shape: Math.random() > 0.35 ? "diamond" : "drop"
        });
      }

      this.strands.push({
        id: i,
        ringIndex: ringIdx,
        radius: radius,
        baseAngle: angle,
        length: baseLen,
        segLen: segLen,
        numNodes: numNodes,
        nodes: nodes,
        beads: beads,
        projectedPts: [],
        freq: 0.28 + hash(i * 3.1) * 0.26,
        freq2: (0.28 + hash(i * 3.1) * 0.26) * 1.8 + hash(i * 8.8) * 0.15,
        delayStep: 0.38 + hash(i * 2.2) * 0.28,
        phase: hash(i * 7.7) * Math.PI * 2,
        phaseZ: hash(i * 13.3) * Math.PI * 2,
        ampMul: 0.65 + hash(i * 11.3) * 0.70,
        dirX: hash(i * 5.5) > 0.5 ? 1 : -1,
        dirZ: hash(i * 9.1) > 0.5 ? 1 : -1
      });
    }

    // 3. 构建挂件
    const numK = this.config.koiCount;
    for (let k = 0; k < numK; k++) {
      const strandIdx = Math.floor(Math.random() * this.strands.length);
      const heightRatio = 0.18 + 0.76 * (k / (numK - 1 || 1)) + (Math.random() - 0.5) * 0.04;

      let facing = 1;
      if (this.config.koiFacingMode === "cw") facing = 1;
      else if (this.config.koiFacingMode === "ccw") facing = -1;
      else facing = Math.random() > 0.45 ? 1 : -1;

      const pendant = PendantFactory.create(this.config.pendantType, {
        strandIndex: strandIdx,
        heightRatio: Math.max(0.06, Math.min(0.95, heightRatio)),
        size: (24 + Math.random() * 14) * this.config.koiScale,
        speed: (0.85 + Math.random() * 0.4) * this.config.koiSpeed,
        wiggleAmp: this.config.koiWiggleAmp,
        facing: facing,
        tiltAngle: (Math.random() - 0.5) * 0.25,
        colorTheme: this.config.koiColorTheme,
        phase: Math.random() * Math.PI * 2
      });

      this.kois.push(pendant);
    }
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < 35; i++) {
      this.particles.push({
        x: (Math.random() - 0.5) * 450,
        y: -300 + Math.random() * 900,
        z: (Math.random() - 0.5) * 450,
        radius: 1.2 + Math.random() * 2.0,
        alpha: 0.25 + Math.random() * 0.55,
        speedY: 0.35 + Math.random() * 0.65,
        driftPhase: Math.random() * Math.PI * 2
      });
    }
  }

  bindEvents() {
    window.addEventListener("resize", () => {
      this.initCanvas();
    });

    const onMove = (x, y) => {
      this.mouse.vx = x - this.mouse.prevX;
      this.mouse.vy = y - this.mouse.prevY;
      this.mouse.prevX = x;
      this.mouse.prevY = y;
      this.mouse.x = x;
      this.mouse.y = y;

      if (this.mouse.isDown) {
        const deltaRot = this.mouse.vx * 0.0038;
        this.rotY += deltaRot;
        this.rotVelocityY = deltaRot;
        this.targetRotX = Math.max(0.12, Math.min(0.85, this.targetRotX - this.mouse.vy * 0.003));
      }
    };

    window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));

    window.addEventListener("mousedown", (e) => {
      if (e.target.closest("#settingsDrawer") || e.target.closest("#togglePanelBtn") || e.target.closest(".floating-bar")) return;
      this.mouse.isDown = true;
      this.mouse.prevX = e.clientX;
      this.mouse.prevY = e.clientY;
      this.mouseDownPos = { x: e.clientX, y: e.clientY };
      this.rotVelocityY = 0;
      this.audio.initContext();
    });

    window.addEventListener("mouseup", (e) => {
      if (this.mouse.isDown && this.mouseDownPos) {
        const moveDist = Math.hypot(e.clientX - this.mouseDownPos.x, e.clientY - this.mouseDownPos.y);
        if (moveDist < 6) {
          // 单击画布：拂来清风，激发自上而下波纹与清脆风铃
          this.triggerGust(1.0);
        }
      }
      this.mouse.isDown = false;
    });

    window.addEventListener("touchmove", (e) => {
      if (e.touches.length > 0) onMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    window.addEventListener("touchstart", (e) => {
      if (e.touches.length > 0) {
        if (e.target.closest("#settingsDrawer") || e.target.closest("#togglePanelBtn") || e.target.closest(".floating-bar")) return;
        this.mouse.isDown = true;
        this.mouse.prevX = e.touches[0].clientX;
        this.mouse.prevY = e.touches[0].clientY;
        this.mouseDownPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        this.rotVelocityY = 0;
        this.audio.initContext();
      }
    }, { passive: true });

    window.addEventListener("touchend", (e) => {
      if (this.mouse.isDown && this.mouseDownPos) {
        const endX = e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0].clientX : this.mouse.x;
        const endY = e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0].clientY : this.mouse.y;
        const moveDist = Math.hypot(endX - this.mouseDownPos.x, endY - this.mouseDownPos.y);
        if (moveDist < 8) {
          this.triggerGust(1.0);
        }
      }
      this.mouse.isDown = false;
    });
  }

  // 3D 弱透视空间投影
  project3D(x, y, z, cx, cy) {
    const cosX = Math.cos(this.rotX);
    const sinX = Math.sin(this.rotX);
    const y2 = y * cosX - z * sinX;
    const z2 = y * sinX + z * cosX;

    const cameraDist = 950;
    const fov = cameraDist / (cameraDist + z2);

    return {
      x: cx + x * fov,
      y: cy + y2 * fov,
      z: z2,
      scale: fov
    };
  }

  updatePhysics() {
    this.time += 0.016;

    if (this.isUnfolding) {
      const elapsed = (performance.now() - this.unfoldStartTime) / 1000;
      this.unfoldProgress = Math.min(1.0, elapsed / 3.2);
      if (this.unfoldProgress >= 1.0) this.isUnfolding = false;
    }

    // 1. 顶部自转与惯性滑行
    if (!this.mouse.isDown) {
      this.rotVelocityY = this.rotVelocityY * 0.965 + this.config.autoRotateSpeed * 0.035;
      this.rotY += this.rotVelocityY;
    }
    this.rotX += (this.targetRotX - this.rotX) * 0.08;

    const cx = this.width / 2;
    const cy = this.height * 0.20;

    // 2. 全局悬挂微幅钟摆晃动 (整套风铃在微风中做自然的悬垂轻摆)
    const pendulumAmp = (this.config.pendulumAmp ?? 5.5) * this.config.windStrength;
    this.chimeCenter.x = Math.sin(this.time * 0.75) * pendulumAmp;
    this.chimeCenter.z = Math.cos(this.time * 0.55) * (pendulumAmp * 0.65);
    const chimeX = this.chimeCenter.x;
    const chimeZ = this.chimeCenter.z;

    // 3. 柳叶微重力、超低频行波、柔性 Verlet 软绳动力学仿真
    const g = Math.max(0.01, Math.min(0.25, this.config.gravity ?? 0.055));
    const drag = Math.max(0.86, Math.min(0.96, this.config.airDrag ?? 0.92));
    const maxOffset = 38 * (this.config.windFlutter ?? 1.0);
    const unfoldFactor = Math.min(1.0, Math.max(0.01, (this.unfoldProgress - 0.2) / 0.8));

    for (let strand of this.strands) {
      // 顶部锚点随环自转与全局悬垂钟摆的世界坐标
      const topAngle = strand.baseAngle + this.rotY;
      const topX = chimeX + Math.cos(topAngle) * strand.radius;
      const topY = 0;
      const topZ = chimeZ + Math.sin(topAngle) * strand.radius;

      strand.nodes[0].x = topX;
      strand.nodes[0].y = topY;
      strand.nodes[0].z = topZ;
      strand.nodes[0].ox = topX;
      strand.nodes[0].oy = topY;
      strand.nodes[0].oz = topZ;

      const curSegLen = strand.segLen * unfoldFactor;
      const activeSeg = Math.max(1, Math.round(unfoldFactor * (strand.numNodes - 1)));

      for (let j = 1; j < strand.numNodes; j++) {
        const node = strand.nodes[j];
        const reach = j / (strand.numNodes - 1);

        if (j > activeSeg) {
          node.x = node.ox = topX;
          node.y = node.oy = topY + j * curSegLen;
          node.z = node.oz = topZ;
          continue;
        }

        // Verlet 速度积分 (惯性与空气阻尼)
        let vx = (node.x - node.ox) * drag;
        let vy = (node.y - node.oy) * drag;
        let vz = (node.z - node.oz) * drag;

        node.ox = node.x;
        node.oy = node.y;
        node.oz = node.z;

        // 超低频行波驱动 (0.28 ~ 0.55 rad/s，非同步 S 曲线)
        const w1 = Math.sin(this.time * strand.freq  - j * strand.delayStep        + strand.phase)       * strand.ampMul;
        const w2 = Math.sin(this.time * strand.freq2 - j * strand.delayStep * 1.35  + strand.phase * 1.7) * strand.ampMul * 0.40;
        const windForceX = (w1 + w2) * this.config.windStrength * reach * strand.dirX;

        const wz1 = Math.sin(this.time * strand.freq * 0.92 - j * strand.delayStep * 0.88 + strand.phaseZ) * strand.ampMul;
        const windForceZ = wz1 * this.config.windStrength * reach * strand.dirZ * 0.65;

        // 拂来清风与点击激发的下行脉冲涟漪
        let gustX = 0, gustZ = 0;
        for (let g of this.gusts) {
          const dt = this.time - g.startTime;
          const travelDelay = j * 0.07 + (strand.radius / 195) * 0.12;
          const localDt = dt - travelDelay;
          if (localDt > 0 && localDt < 2.2) {
            const pulse = Math.exp(-Math.pow((localDt - 0.35) / 0.28, 2)) * g.power * reach;
            const ripple = Math.sin(localDt * 4.6) * pulse * 3.2;
            gustX += ripple * strand.dirX;
            gustZ += ripple * 0.5 * strand.dirZ;
          }
        }

        // 鼠标流体推力 (如清风拂过)
        let mouseX = 0, mouseZ = 0;
        if (Math.hypot(this.mouse.vx, this.mouse.vy) > 0.6) {
          const proj = this.project3D(node.x, node.y, node.z, cx, cy);
          const dx = proj.x - this.mouse.x;
          const dy = proj.y - this.mouse.y;
          const dist = Math.hypot(dx, dy);
          const radius = 95;
          if (dist < radius) {
            const falloff = Math.pow(1 - dist / radius, 1.4);
            mouseX = this.mouse.vx * 0.25 * falloff * this.config.mouseForce;
            mouseZ = this.mouse.vy * 0.20 * falloff * this.config.mouseForce;

            if (j === Math.floor(strand.numNodes / 2)) {
              const pan = (proj.x - cx) / (this.width * 0.45);
              this.audio.playChime(strand.id, falloff * 0.75, pan);
            }
          }
        }

        // 施加加速度并积分
        node.x += vx + (windForceX + gustX + mouseX) * 0.16;
        node.y += vy + g;
        node.z += vz + (windForceZ + gustZ + mouseZ) * 0.16;

        // 围绕垂线的圆锥软限幅 (保证下垂感与垂直度，杜绝发散与横向飘飞)
        const curMax = maxOffset * reach;
        node.x = clamp(node.x, topX - curMax, topX + curMax);
        node.z = clamp(node.z, topZ - curMax, topZ + curMax);
      }

      // 4 次 3D Verlet 距离松弛 (严格保持丝线恒长，杜绝橡皮筋弹力与拉伸)
      for (let iter = 0; iter < 4; iter++) {
        for (let j = 0; j < strand.numNodes - 1; j++) {
          const a = strand.nodes[j];
          const b = strand.nodes[j + 1];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dz = b.z - a.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001;
          const diff = (dist - curSegLen) / dist * 0.5;
          const ox = dx * diff;
          const oy = dy * diff;
          const oz = dz * diff;
          if (j > 0) {
            a.x += ox; a.y += oy; a.z += oz;
          }
          b.x -= ox; b.y -= oy; b.z -= oz;
        }
      }

      // 预计算所有质点的 3D 屏幕投影
      strand.projectedPts = strand.nodes.map(n => this.project3D(n.x, n.y, n.z, cx, cy));
    }

    // 3. 挂件姿态与游动动力学更新
    for (let pendant of this.kois) {
      const baseSz = 26 + ((pendant.seed || 0) % 14);
      pendant.size = baseSz * this.config.koiScale;
      const baseSp = 0.85 + ((pendant.seed || 0) % 4) * 0.1;
      pendant.speed = baseSp * this.config.koiSpeed;
      pendant.wiggleAmp = this.config.koiWiggleAmp;
      pendant.colorTheme = this.config.koiColorTheme;
      pendant.update(this.time, { x: 0.1, y: 0.1 });
    }

    // 4. 甘露水滴更新
    if (this.config.dewParticles) {
      for (let pt of this.particles) {
        pt.y += pt.speedY;
        pt.x += Math.sin(this.time + pt.driftPhase) * 0.45;
        if (pt.y > 750) {
          pt.y = -320;
          pt.x = (Math.random() - 0.5) * 450;
          pt.z = (Math.random() - 0.5) * 450;
        }
      }
    }
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const cx = w / 2;
    const cy = h * 0.20;
    const hangY = cy - 130;

    this.drawBackground(ctx, w, h);

    // 天花板固定吊索（至悬挂挂钩 hangY）
    const isDark = this.config.bgTheme === "darkNight";
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, -10);
    ctx.lineTo(cx, hangY);
    ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.45)" : "rgba(140, 155, 165, 0.55)";
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // 悬挂挂钩结
    ctx.beginPath();
    ctx.arc(cx, hangY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? "#FFFFFF" : "#8A9BA8";
    ctx.fill();
    ctx.restore();

    // 全局悬挂吊环微幅轻柔钟摆轻晃 (从挂钩处做自然缓摆)
    const swayAngle = (Math.sin(this.time * 0.12) * 0.026 + Math.sin(this.time * 0.05 + 1.3) * 0.012) * (this.config.windStrength || 1.0);
    ctx.save();
    ctx.translate(cx, hangY);
    ctx.rotate(swayAngle);
    ctx.translate(-cx, -hangY);

    this.drawCeilingWire(ctx, cx, cy, hangY);
    this.drawRipplesRings(ctx, cx, cy);
    this.drawDepthSortedEntities(ctx, cx, cy);

    if (this.config.dewParticles) {
      this.drawDewParticles(ctx, cx, cy);
    }

    ctx.restore();
  }

  drawBackground(ctx, w, h) {
    const bgThemes = {
      ricePaper:   { top: "#FAF8F3", bot: "#F3EDE1" },
      warmSilk:    { top: "#FDFBF7", bot: "#F5EFE6" },
      bambooGreen: { top: "#F2F7F4", bot: "#E4EDE7" },
      darkNight:   { top: "#16191D", bot: "#0D0F12" }
    };
    const theme = bgThemes[this.config.bgTheme] || bgThemes.ricePaper;

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, theme.top);
    bgGrad.addColorStop(1, theme.bot);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);
  }

  drawCeilingWire(ctx, cx, cy, hangY) {
    const chX = this.chimeCenter ? this.chimeCenter.x : 0;
    const chZ = this.chimeCenter ? this.chimeCenter.z : 0;
    const topProj = this.project3D(chX, 0, chZ, cx, cy);
    const hy = hangY !== undefined ? hangY : cy - 130;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, hy);
    ctx.lineTo(topProj.x, topProj.y);
    const isDark = this.config.bgTheme === "darkNight";
    ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.45)" : "rgba(140, 155, 165, 0.55)";
    ctx.lineWidth = 1.0;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(topProj.x, topProj.y, 2.8, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? "#FFFFFF" : "#8A9BA8";
    ctx.fill();
    ctx.restore();
  }

  drawRipplesRings(ctx, cx, cy) {
    const isDark = this.config.bgTheme === "darkNight";
    const ringProgress = Math.min(1.0, this.unfoldProgress * 1.5);
    const chX = this.chimeCenter ? this.chimeCenter.x : 0;
    const chZ = this.chimeCenter ? this.chimeCenter.z : 0;

    ctx.save();
    ctx.lineWidth = 0.85;

    for (let ring of this.rings) {
      const curR = ring.radius * ringProgress;
      if (curR <= 0.5) continue;

      ctx.beginPath();
      const segs = 64;
      for (let s = 0; s <= segs; s++) {
        const theta = (s / segs) * Math.PI * 2 + this.rotY;
        const rx = chX + Math.cos(theta) * curR;
        const rz = chZ + Math.sin(theta) * curR;
        const pt = this.project3D(rx, 0, rz, cx, cy);
        if (s === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.28)" : "rgba(140, 160, 175, 0.42)";
      ctx.stroke();
    }

    for (let k = 0; k < 4; k++) {
      const ang = (k * Math.PI) / 2 + this.rotY;
      const maxR = this.config.topRadius * ringProgress;
      const pt1 = this.project3D(chX, 0, chZ, cx, cy);
      const pt2 = this.project3D(chX + Math.cos(ang) * maxR, 0, chZ + Math.sin(ang) * maxR, cx, cy);

      ctx.beginPath();
      ctx.moveTo(pt1.x, pt1.y);
      ctx.lineTo(pt2.x, pt2.y);
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(160, 175, 185, 0.25)";
      ctx.stroke();
    }

    ctx.restore();
  }

  // 深度排序：统筹渲染垂线、珠子、锦鲤
  drawDepthSortedEntities(ctx, cx, cy) {
    const isDark = this.config.bgTheme === "darkNight";
    const drawList = [];

    // 1. 垂线与珠子
    for (let strand of this.strands) {
      const pts = strand.projectedPts;
      if (!pts || pts.length === 0) continue;

      const midZ = (pts[0].z + pts[pts.length - 1].z) / 2;

      drawList.push({
        type: "strand",
        z: midZ,
        strand: strand,
        projPts: pts
      });

      for (let b of strand.beads) {
        const u = b.ratio;
        const pIdx = u * (strand.nodes.length - 1);
        const i0 = Math.floor(pIdx);
        const i1 = Math.min(strand.nodes.length - 1, i0 + 1);
        const t = pIdx - i0;

        const bx = strand.nodes[i0].x + (strand.nodes[i1].x - strand.nodes[i0].x) * t;
        const by = strand.nodes[i0].y + (strand.nodes[i1].y - strand.nodes[i0].y) * t;
        const bz = strand.nodes[i0].z + (strand.nodes[i1].z - strand.nodes[i0].z) * t;

        const projBead = this.project3D(bx, by, bz, cx, cy);
        const p0 = strand.projectedPts[i0] || projBead;
        const p1 = strand.projectedPts[i1] || projBead;
        const beadAng = Math.atan2(p1.y - p0.y, p1.x - p0.x);

        drawList.push({
          type: "bead",
          z: projBead.z,
          bead: b,
          proj: projBead,
          ang: beadAng
        });
      }
    }

    // 2. 挂件 (附着于 Verlet 软绳对应深度，切线微倾联动)
    const koiProgress = Math.min(1.0, Math.max(0.0, (this.unfoldProgress - 0.35) / 0.65));

    for (let pendant of this.kois) {
      const strand = this.strands[pendant.strandIndex % this.strands.length];
      if (!strand || !strand.nodes || strand.nodes.length === 0) continue;

      const nodes = strand.nodes;
      const u = pendant.heightRatio;
      const pIdx = u * (nodes.length - 1);
      const i0 = Math.floor(pIdx);
      const i1 = Math.min(nodes.length - 1, i0 + 1);
      const t = pIdx - i0;

      const fx = nodes[i0].x + (nodes[i1].x - nodes[i0].x) * t + pendant.radialOffset;
      const fy = nodes[i0].y + (nodes[i1].y - nodes[i0].y) * t;
      const fz = nodes[i0].z + (nodes[i1].z - nodes[i0].z) * t;

      const proj = this.project3D(fx, fy, fz, cx, cy);

      // 挂件附着于丝线，随丝线微倾斜联动
      const dx = nodes[i1].x - nodes[i0].x;
      const dy = nodes[i1].y - nodes[i0].y;
      const strandTilt = Math.atan2(dx, dy) * 0.22;

      drawList.push({
        type: "pendant",
        z: proj.z,
        pendant: pendant,
        proj: proj,
        strandTilt: strandTilt,
        opacity: koiProgress
      });
    }

    drawList.sort((a, b) => a.z - b.z);

    for (let item of drawList) {
      if (item.type === "strand") {
        this.renderStrand(ctx, item.projPts, isDark);
      } else if (item.type === "bead") {
        this.renderBead(ctx, item.bead, item.proj, isDark, item.ang);
      } else if (item.type === "pendant") {
        if (item.opacity > 0.02) {
          ctx.save();
          ctx.translate(item.proj.x, item.proj.y);
          ctx.rotate(item.strandTilt || 0);
          const zScale = item.proj.scale;
          const depthAlpha = Math.max(0.45, Math.min(1.0, (item.z + 400) / 750));
          item.pendant.draw(ctx, {
            scale: zScale,
            opacity: item.opacity * depthAlpha,
            customImage: this.customImage
          });
          ctx.restore();
        }
      }
    }
  }

  // 极细通透蚕丝线绘制（通过平滑样条拟合 16 个 Verlet 质点）
  renderStrand(ctx, projPts, isDark) {
    if (projPts.length < 2) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(projPts[0].x, projPts[0].y);

    for (let i = 1; i < projPts.length - 1; i++) {
      const xc = (projPts[i].x + projPts[i + 1].x) / 2;
      const yc = (projPts[i].y + projPts[i + 1].y) / 2;
      ctx.quadraticCurveTo(projPts[i].x, projPts[i].y, xc, yc);
    }
    ctx.lineTo(projPts[projPts.length - 1].x, projPts[projPts.length - 1].y);

    const lineWidth = Math.max(0.35, Math.min(1.2, this.config.strandWidth));
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.28)" : "rgba(165, 180, 195, 0.40)";
    ctx.stroke();
    ctx.restore();
  }

  renderBead(ctx, bead, proj, isDark, ang = 0) {
    const x = proj.x;
    const y = proj.y;
    const r = bead.size * proj.scale;
    if (r <= 0.4) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang !== undefined ? ang - Math.PI / 2 : 0);

    let mainColor, edgeColor;
    if (this.config.beadTheme === "amberGold") {
      mainColor = "rgba(255, 180, 50, 0.85)";
      edgeColor = "rgba(255, 220, 100, 0.9)";
    } else if (this.config.beadTheme === "purpleCrystal") {
      mainColor = "rgba(180, 100, 240, 0.85)";
      edgeColor = "rgba(220, 160, 255, 0.9)";
    } else if (this.config.beadTheme === "iceWhite") {
      mainColor = "rgba(230, 245, 255, 0.85)";
      edgeColor = "rgba(255, 255, 255, 0.95)";
    } else {
      if (bead.type === "blue") {
        mainColor = "rgba(70, 160, 245, 0.85)";
        edgeColor = "rgba(160, 220, 255, 0.9)";
      } else {
        mainColor = "rgba(40, 195, 140, 0.85)";
        edgeColor = "rgba(170, 245, 210, 0.9)";
      }
    }

    if (bead.shape === "diamond") {
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.2);
      ctx.lineTo(r * 0.75, 0);
      ctx.lineTo(0, r * 1.2);
      ctx.lineTo(-r * 0.75, 0);
      ctx.closePath();
      ctx.fillStyle = mainColor;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, -r * 1.2);
      ctx.lineTo(r * 0.35, 0);
      ctx.lineTo(0, 0);
      ctx.fillStyle = edgeColor;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = mainColor;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.3, r * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.globalAlpha = 0.85;
      ctx.fill();
    }

    ctx.restore();
  }

  drawDewParticles(ctx, cx, cy) {
    const isDark = this.config.bgTheme === "darkNight";
    ctx.save();
    for (let pt of this.particles) {
      const proj = this.project3D(pt.x, pt.y, pt.z, cx, cy);
      const pr = pt.radius * proj.scale;
      if (pr <= 0.2) continue;

      ctx.beginPath();
      ctx.arc(proj.x, proj.y, pr, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? "rgba(160, 220, 255, 0.65)" : "rgba(70, 170, 230, 0.65)";
      ctx.globalAlpha = pt.alpha;
      ctx.fill();
    }
    ctx.restore();
  }

  loop() {
    this.updatePhysics();
    this.render();
    requestAnimationFrame(this.loop);
  }

  exportPoster(resolutionScale = 2) {
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = this.width * resolutionScale;
    exportCanvas.height = this.height * resolutionScale;
    const exportCtx = exportCanvas.getContext("2d");
    exportCtx.scale(resolutionScale, resolutionScale);

    const origCtx = this.ctx;
    this.ctx = exportCtx;
    this.render();
    this.ctx = origCtx;

    const dataUrl = exportCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `金鱼梦_艺术风铃_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }
}

if (typeof window !== "undefined") {
  window.WindChimeApp = WindChimeApp;
}
