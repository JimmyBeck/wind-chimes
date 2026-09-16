/**
 * koi.js (Pendants Engine) - 挂件渲染与多素材仿生动画系统
 * 支持 5 大类艺术挂件形态：
 * 1. 灵动锦鲤 (KoiFish) - 10节流体力学脊椎行波、双叶轻纱凤尾
 * 2. 翩跹彩蝶 (Butterfly) - 3D扇翼动力学、工笔丝脉、金粉微斑
 * 3. 沉香金叶 (GinkgoLeaf) - 银杏扇叶辐射脉络、微风翻卷起伏
 * 4. 素白青鸟 (OrigamiCrane) - 千纸鹤折纸切面、素雅纸张光影
 * 5. 自定义挂件 (CustomPendant) - 支持用户上传任意透明PNG图案
 */

// 色彩方案
class KoiPalette {
  static PRESETS = {
    cinnabar: {
      name: "朱砂红金 (原版)",
      head: "#FF5E36",
      bodyPrimary: "#E63946",
      bodySecondary: "#FF7B54",
      belly: "#FFF5F2",
      finBase: "rgba(255, 90, 70, 0.42)",
      finEdge: "rgba(72, 219, 251, 0.75)",
      goldShine: "rgba(255, 220, 100, 0.85)",
      spotColor: "#D63031"
    },
    golden: {
      name: "锦绣赤金",
      head: "#FFA502",
      bodyPrimary: "#FF7F50",
      bodySecondary: "#FFA502",
      belly: "#FFFDF0",
      finBase: "rgba(255, 160, 40, 0.42)",
      finEdge: "rgba(255, 230, 150, 0.8)",
      goldShine: "rgba(255, 240, 140, 0.9)",
      spotColor: "#FF6348"
    },
    cyan: {
      name: "翠微碧波",
      head: "#1DD1A1",
      bodyPrimary: "#10AC84",
      bodySecondary: "#48DBFB",
      belly: "#F0FFFF",
      finBase: "rgba(72, 219, 251, 0.4)",
      finEdge: "rgba(29, 209, 161, 0.75)",
      goldShine: "rgba(200, 247, 197, 0.85)",
      spotColor: "#10AC84"
    },
    monochrome: {
      name: "水墨丹顶",
      head: "#EE5253",
      bodyPrimary: "#2F3542",
      bodySecondary: "#57606F",
      belly: "#F1F2F6",
      finBase: "rgba(87, 96, 111, 0.35)",
      finEdge: "rgba(47, 53, 66, 0.6)",
      goldShine: "rgba(255, 255, 255, 0.75)",
      spotColor: "#2F3542"
    },
    iridescent: {
      name: "五彩幻锦",
      head: "#FF6B81",
      bodyPrimary: "#FF4757",
      bodySecondary: "#FFA502",
      belly: "#FFF5F5",
      finBase: "rgba(255, 159, 243, 0.45)",
      finEdge: "rgba(84, 160, 255, 0.75)",
      goldShine: "rgba(254, 202, 87, 0.85)",
      spotColor: "#FF4757"
    }
  };
}

// ==========================================
// 1. 灵动锦鲤 (KoiFish) - 东方水彩流线锦鲤
// ==========================================
class KoiFish {
  constructor(options = {}) {
    this.type = "koi";
    this.strandIndex = options.strandIndex ?? 0;
    this.heightRatio = options.heightRatio ?? 0.5;
    this.seed = options.seed ?? Math.floor(Math.random() * 10000);
    this.size = options.size ?? (28 + (this.seed % 18));
    this.speed = options.speed ?? (0.85 + (this.seed % 4) * 0.1);
    this.wiggleAmp = options.wiggleAmp ?? 1.0;
    this.facing = options.facing ?? (Math.random() > 0.5 ? 1 : -1);
    this.tiltAngle = options.tiltAngle ?? ((Math.random() - 0.5) * 0.25);
    this.colorTheme = options.colorTheme ?? "cinnabar";
    this.phase = options.phase ?? Math.random() * Math.PI * 2;
    this.tailPhase = options.tailPhase ?? Math.random() * Math.PI * 2;
    this.tailSpeed = 2.4 + (this.seed % 5) * 0.35;
    this.bobPhase = options.bobPhase ?? Math.random() * Math.PI * 2;
    this.radialOffset = options.radialOffset ?? ((Math.random() - 0.5) * 10);

    this.tailWag = 0;
    this.bob = 0;
    this.tilt = 0;
  }

  update(time, wind = { x: 0, y: 0 }) {
    const t = time * this.speed;
    const windWiggle = (wind.x + wind.y) * 0.05;
    this.tailWag = Math.sin(t * this.tailSpeed + this.tailPhase) * this.wiggleAmp;
    this.finWag = Math.sin(t * this.tailSpeed * 1.3 + this.tailPhase);
    this.bob = Math.sin(t * 1.3 + this.bobPhase) * 2.2;
    this.tilt = this.tiltAngle + this.tailWag * 0.035 + windWiggle;
  }

  draw(ctx, options = {}) {
    const scale = options.scale ?? 1.0;
    const opacity = options.opacity ?? 1.0;
    if (opacity <= 0.01) return;

    const paletteKey = options.colorTheme || this.colorTheme;
    const pal = KoiPalette.PRESETS[paletteKey] || KoiPalette.PRESETS.cinnabar;

    ctx.save();
    ctx.translate(0, this.bob);
    ctx.rotate(this.tilt);
    ctx.scale(this.facing * scale, scale);
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity));

    const s = this.size;
    const bodyLen = s * 0.95;
    const bodyH = s * 0.30;

    // 1. 分叉三角 wagging 摇摆尾鳍
    ctx.save();
    ctx.translate(-bodyLen * 0.42, 0);
    ctx.rotate(this.tailWag * 0.55);
    ctx.beginPath();
    ctx.moveTo(0, -bodyH * 0.30);
    ctx.lineTo(-bodyLen * 0.55, -bodyH * 0.95);
    ctx.lineTo(-bodyLen * 0.32, 0);
    ctx.lineTo(-bodyLen * 0.55, bodyH * 0.95);
    ctx.lineTo(0, bodyH * 0.30);
    ctx.closePath();
    ctx.fillStyle = pal.bodyPrimary || pal.head || "#e8503a";
    ctx.globalAlpha = opacity * 0.82;
    ctx.fill();

    // 尾鳍透光细纹
    ctx.strokeStyle = pal.finEdge || pal.belly || "#fff3e6";
    ctx.lineWidth = 0.7;
    ctx.globalAlpha = opacity * 0.45;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-bodyLen * 0.45, -bodyH * 0.65);
    ctx.moveTo(0, 0);
    ctx.lineTo(-bodyLen * 0.45, bodyH * 0.65);
    ctx.stroke();
    ctx.restore();

    // 2. 灵动背鳍 (dorsal fin)
    ctx.beginPath();
    ctx.moveTo(-bodyLen * 0.05, -bodyH * 0.75);
    ctx.quadraticCurveTo(-bodyLen * 0.28, -bodyH * 1.55, -bodyLen * 0.42, -bodyH * 0.70);
    ctx.closePath();
    ctx.fillStyle = pal.bodyPrimary || "#e8503a";
    ctx.globalAlpha = opacity * 0.65;
    ctx.fill();

    // 3. 纺锤形水彩流线鱼身 (尖吻尖尾，无臃肿模糊)
    ctx.beginPath();
    ctx.moveTo(bodyLen * 0.50, 0);
    ctx.quadraticCurveTo(bodyLen * 0.30, -bodyH * 1.05, -bodyLen * 0.20, -bodyH * 0.72);
    ctx.quadraticCurveTo(-bodyLen * 0.42, -bodyH * 0.30, -bodyLen * 0.42, 0);
    ctx.quadraticCurveTo(-bodyLen * 0.42, bodyH * 0.30, -bodyLen * 0.20, bodyH * 0.72);
    ctx.quadraticCurveTo(bodyLen * 0.30, bodyH * 1.05, bodyLen * 0.50, 0);
    ctx.closePath();

    // 肚腹水色底图
    ctx.fillStyle = pal.belly || "#fff3e6";
    ctx.globalAlpha = opacity * 0.94;
    ctx.fill();

    // 主色水彩层
    ctx.fillStyle = pal.bodyPrimary || "#e8503a";
    ctx.globalAlpha = opacity * 0.72;
    ctx.fill();

    // 4. 鱼背微光透亮斑 (soft glowing patch)
    ctx.beginPath();
    ctx.ellipse(-bodyLen * 0.05, -bodyH * 0.25, bodyLen * 0.24, bodyH * 0.45, 0.15, 0, Math.PI * 2);
    ctx.fillStyle = pal.bodySecondary || pal.head || "#ffb199";
    ctx.globalAlpha = opacity * 0.45;
    ctx.fill();

    // 5. 丹顶红斑或锦斑 (koi spot)
    if (pal.spotColor) {
      ctx.beginPath();
      ctx.ellipse(bodyLen * 0.18, -bodyH * 0.15, bodyLen * 0.14, bodyH * 0.32, 0.2, 0, Math.PI * 2);
      ctx.fillStyle = pal.spotColor;
      ctx.globalAlpha = opacity * 0.68;
      ctx.fill();
    }

    // 6. 腹侧微振胸鳍 (pectoral fin)
    ctx.beginPath();
    ctx.moveTo(bodyLen * 0.08, bodyH * 0.55);
    const finWag = (this.finWag || 0) * bodyH * 0.15;
    ctx.quadraticCurveTo(bodyLen * 0.02, bodyH * 1.15 + finWag, -bodyLen * 0.18, bodyH * 0.85);
    ctx.closePath();
    ctx.fillStyle = pal.bodySecondary || pal.head || "#ffb199";
    ctx.globalAlpha = opacity * 0.60;
    ctx.fill();

    // 7. 点睛之笔 (ink dot eye)
    ctx.globalAlpha = opacity * 0.92;
    ctx.beginPath();
    ctx.arc(bodyLen * 0.36, -bodyH * 0.08, s * 0.032, 0, Math.PI * 2);
    ctx.fillStyle = "#2b1810";
    ctx.fill();

    // 晶亮微光点
    ctx.beginPath();
    ctx.arc(bodyLen * 0.37, -bodyH * 0.09, s * 0.012, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    // 8. 龙须 (delicate whiskers)
    ctx.beginPath();
    ctx.moveTo(bodyLen * 0.48, -bodyH * 0.05);
    ctx.quadraticCurveTo(bodyLen * 0.64, -bodyH * 0.22, bodyLen * 0.74, -bodyH * 0.14);
    ctx.moveTo(bodyLen * 0.48, bodyH * 0.05);
    ctx.quadraticCurveTo(bodyLen * 0.64, bodyH * 0.22, bodyLen * 0.74, bodyH * 0.14);
    ctx.strokeStyle = pal.bodyPrimary || "#e8503a";
    ctx.lineWidth = Math.max(0.6, s * 0.022);
    ctx.globalAlpha = opacity * 0.55;
    ctx.stroke();

    ctx.restore();
  }
}

// ==========================================
// 2. 翩跹彩蝶 (Butterfly)
// ==========================================
class Butterfly {
  constructor(options = {}) {
    this.type = "butterfly";
    this.strandIndex = options.strandIndex ?? 0;
    this.heightRatio = options.heightRatio ?? 0.5;
    this.seed = options.seed ?? Math.floor(Math.random() * 10000);
    this.size = (options.size ?? (24 + (this.seed % 12))) * 0.95;
    this.speed = options.speed ?? (1.0 + (this.seed % 4) * 0.15);
    this.facing = options.facing ?? (Math.random() > 0.5 ? 1 : -1);
    this.colorTheme = options.colorTheme ?? "cinnabar";
    this.phase = options.phase ?? Math.random() * Math.PI * 2;
    this.radialOffset = options.radialOffset ?? ((Math.random() - 0.5) * 12);
    this.flap = 0;
  }

  update(time, wind = { x: 0, y: 0 }) {
    const t = time * 4.2 * this.speed + this.phase;
    // 3D 扇翅角度：cos(t) 控制双翅开合
    this.flap = Math.cos(t);
  }

  draw(ctx, options = {}) {
    const scale = options.scale ?? 1.0;
    const opacity = options.opacity ?? 1.0;
    const paletteKey = options.colorTheme || this.colorTheme;
    const palette = KoiPalette.PRESETS[paletteKey] || KoiPalette.PRESETS.cinnabar;
    const s = this.size;

    ctx.save();
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
    if (this.facing < 0) ctx.scale(-1, 1);

    // 扇翅宽度受 3D 投影缩放
    const flapWidth = Math.max(0.18, Math.abs(this.flap));

    // 绘制双翅 (左后、右前)
    const sides = [-1, 1];
    for (let side of sides) {
      ctx.save();
      ctx.scale(1, flapWidth * side);

      // 前翅大扇面
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.1);
      ctx.bezierCurveTo(s * 0.4, -s * 0.9, s * 1.1, -s * 0.95, s * 1.15, -s * 0.4);
      ctx.bezierCurveTo(s * 1.0, -s * 0.1, s * 0.5, 0, 0, 0);
      ctx.closePath();

      const foreGrad = ctx.createRadialGradient(s * 0.3, -s * 0.3, s * 0.1, s * 0.6, -s * 0.5, s * 0.9);
      foreGrad.addColorStop(0.0, palette.head);
      foreGrad.addColorStop(0.5, palette.bodyPrimary);
      foreGrad.addColorStop(0.85, palette.finEdge);
      foreGrad.addColorStop(1.0, "rgba(255, 255, 255, 0.0)");
      ctx.fillStyle = foreGrad;
      ctx.globalAlpha = 0.75;
      ctx.fill();

      // 后翅小飘带
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(s * 0.5, s * 0.2, s * 0.9, s * 0.5, s * 0.85, s * 0.85);
      ctx.bezierCurveTo(s * 0.5, s * 0.85, s * 0.2, s * 0.5, 0, s * 0.2);
      ctx.closePath();
      ctx.fillStyle = palette.bodySecondary;
      ctx.globalAlpha = 0.68;
      ctx.fill();

      // 翅脉与金色晶斑
      ctx.beginPath();
      ctx.arc(s * 0.6, -s * 0.45, s * 0.09, 0, Math.PI * 2);
      ctx.fillStyle = palette.goldShine;
      ctx.globalAlpha = 0.9;
      ctx.fill();

      ctx.restore();
    }

    // 蝶身与触角
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.08, s * 0.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#2B2A27";
    ctx.globalAlpha = 0.9;
    ctx.fill();

    // 纤细触角
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.3);
    ctx.quadraticCurveTo(s * 0.2, -s * 0.55, s * 0.35, -s * 0.6);
    ctx.moveTo(0, -s * 0.3);
    ctx.quadraticCurveTo(-s * 0.2, -s * 0.55, -s * 0.35, -s * 0.6);
    ctx.strokeStyle = "#2B2A27";
    ctx.lineWidth = 0.75;
    ctx.stroke();

    ctx.restore();
  }
}

// ==========================================
// 3. 沉香金叶 / 银杏叶 (GinkgoLeaf)
// ==========================================
class GinkgoLeaf {
  constructor(options = {}) {
    this.type = "ginkgo";
    this.strandIndex = options.strandIndex ?? 0;
    this.heightRatio = options.heightRatio ?? 0.5;
    this.seed = options.seed ?? Math.floor(Math.random() * 10000);
    this.size = (options.size ?? (24 + (this.seed % 12))) * 0.92;
    this.speed = options.speed ?? (0.9 + (this.seed % 4) * 0.1);
    this.facing = options.facing ?? (Math.random() > 0.5 ? 1 : -1);
    this.phase = options.phase ?? Math.random() * Math.PI * 2;
    this.radialOffset = options.radialOffset ?? ((Math.random() - 0.5) * 12);
    this.sway = 0;
  }

  update(time, wind = { x: 0, y: 0 }) {
    const t = time * 2.2 * this.speed + this.phase;
    this.sway = Math.sin(t) * 0.25 + (wind.x + wind.y) * 0.1;
  }

  draw(ctx, options = {}) {
    const scale = options.scale ?? 1.0;
    const opacity = options.opacity ?? 1.0;
    const s = this.size;

    ctx.save();
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
    ctx.rotate(this.sway);
    if (this.facing < 0) ctx.scale(-1, 1);

    // 细长叶柄
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(s * 0.15, s * 0.35, s * 0.25, s * 0.65);
    ctx.strokeStyle = "rgba(180, 140, 60, 0.75)";
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // 银杏经典扇形叶面
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-s * 0.55, -s * 0.45, -s * 0.85, -s * 0.95, -s * 0.3, -s * 1.15);
    // 中央微缺口
    ctx.quadraticCurveTo(0, -s * 0.95, s * 0.3, -s * 1.15);
    ctx.bezierCurveTo(s * 0.85, -s * 0.95, s * 0.55, -s * 0.45, 0, 0);
    ctx.closePath();

    const leafGrad = ctx.createRadialGradient(0, 0, s * 0.1, 0, -s * 0.8, s * 1.1);
    leafGrad.addColorStop(0.0, "#E67E22");
    leafGrad.addColorStop(0.4, "#F39C12");
    leafGrad.addColorStop(0.85, "#F1C40F");
    leafGrad.addColorStop(1.0, "#F9E79F");

    ctx.fillStyle = leafGrad;
    ctx.globalAlpha = 0.82;
    ctx.fill();

    // 辐射状细腻叶脉
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = 0.6;
    for (let a = -0.55; a <= 0.55; a += 0.18) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.sin(a) * s * 1.05, -Math.cos(a) * s * 1.05);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ==========================================
// 4. 素白青鸟 / 千纸鹤 (OrigamiCrane)
// ==========================================
class OrigamiCrane {
  constructor(options = {}) {
    this.type = "crane";
    this.strandIndex = options.strandIndex ?? 0;
    this.heightRatio = options.heightRatio ?? 0.5;
    this.seed = options.seed ?? Math.floor(Math.random() * 10000);
    this.size = (options.size ?? (24 + (this.seed % 12))) * 0.9;
    this.speed = options.speed ?? (0.9 + (this.seed % 4) * 0.1);
    this.facing = options.facing ?? (Math.random() > 0.5 ? 1 : -1);
    this.phase = options.phase ?? Math.random() * Math.PI * 2;
    this.radialOffset = options.radialOffset ?? ((Math.random() - 0.5) * 12);
    this.tilt = 0;
  }

  update(time, wind = { x: 0, y: 0 }) {
    const t = time * 2.5 * this.speed + this.phase;
    this.tilt = Math.sin(t) * 0.18 + wind.x * 0.08;
  }

  draw(ctx, options = {}) {
    const scale = options.scale ?? 1.0;
    const opacity = options.opacity ?? 1.0;
    const s = this.size;

    ctx.save();
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
    ctx.rotate(this.tilt);
    if (this.facing < 0) ctx.scale(-1, 1);

    // 折纸千纸鹤多面几何多边形
    // 1. 左翼
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.1);
    ctx.lineTo(-s * 0.9, -s * 0.6);
    ctx.lineTo(-s * 0.2, 0);
    ctx.closePath();
    ctx.fillStyle = "rgba(240, 245, 250, 0.85)";
    ctx.fill();
    ctx.strokeStyle = "rgba(180, 195, 210, 0.6)";
    ctx.stroke();

    // 2. 右翼 (迎光面)
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.1);
    ctx.lineTo(s * 0.9, -s * 0.7);
    ctx.lineTo(s * 0.25, 0);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fill();
    ctx.strokeStyle = "rgba(180, 195, 210, 0.6)";
    ctx.stroke();

    // 3. 头部与颈
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(s * 0.6, -s * 0.25);
    ctx.lineTo(s * 0.5, -s * 0.2);
    ctx.lineTo(0, s * 0.15);
    ctx.closePath();
    ctx.fillStyle = "rgba(230, 238, 245, 0.9)";
    ctx.fill();
    ctx.stroke();

    // 4. 尾羽
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-s * 0.65, s * 0.25);
    ctx.lineTo(0, s * 0.15);
    ctx.closePath();
    ctx.fillStyle = "rgba(215, 225, 235, 0.85)";
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}

// ==========================================
// 5. 用户自定义图片挂件 (CustomPendant)
// ==========================================
class CustomPendant {
  constructor(options = {}) {
    this.type = "custom";
    this.strandIndex = options.strandIndex ?? 0;
    this.heightRatio = options.heightRatio ?? 0.5;
    this.seed = options.seed ?? Math.floor(Math.random() * 10000);
    this.size = (options.size ?? (26 + (this.seed % 12))) * 1.1;
    this.speed = options.speed ?? (1.0 + (this.seed % 4) * 0.1);
    this.facing = options.facing ?? (Math.random() > 0.5 ? 1 : -1);
    this.phase = options.phase ?? Math.random() * Math.PI * 2;
    this.radialOffset = options.radialOffset ?? ((Math.random() - 0.5) * 12);
    this.tilt = 0;
  }

  update(time, wind = { x: 0, y: 0 }) {
    const t = time * 2.2 * this.speed + this.phase;
    this.tilt = Math.sin(t) * 0.15 + (wind.x + wind.y) * 0.08;
  }

  draw(ctx, options = {}) {
    const scale = options.scale ?? 1.0;
    const opacity = options.opacity ?? 1.0;
    const img = options.customImage;
    const s = this.size;

    ctx.save();
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
    ctx.rotate(this.tilt);
    if (this.facing < 0) ctx.scale(-1, 1);

    if (img && img.complete && img.naturalWidth > 0) {
      // 保持原始长宽比绘制
      const aspect = img.naturalWidth / img.naturalHeight;
      let w = s * 1.5;
      let h = w / aspect;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      // 占位图形：优雅双玉璜/如意纹
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(220, 60, 50, 0.85)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = "#FAF8F3";
      ctx.fill();
    }

    ctx.restore();
  }
}

// 统一工厂方法
class PendantFactory {
  static create(type, options) {
    switch (type) {
      case "butterfly":
        return new Butterfly(options);
      case "ginkgo":
        return new GinkgoLeaf(options);
      case "crane":
        return new OrigamiCrane(options);
      case "custom":
        return new CustomPendant(options);
      case "koi":
      default:
        return new KoiFish(options);
    }
  }
}

if (typeof window !== "undefined") {
  window.KoiFish = KoiFish;
  window.Butterfly = Butterfly;
  window.GinkgoLeaf = GinkgoLeaf;
  window.OrigamiCrane = OrigamiCrane;
  window.CustomPendant = CustomPendant;
  window.PendantFactory = PendantFactory;
  window.KoiPalette = KoiPalette;
}
