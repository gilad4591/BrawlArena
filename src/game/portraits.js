/**
 * Procedural anime-style bust portraits, drawn on a canvas. Used on the
 * character-select cards and the in-battle HUD. Purely code-drawn (no assets)
 * but styled per character via character.style.
 */

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  r = Math.max(0, Math.min(255, r + amt));
  g = Math.max(0, Math.min(255, g + amt));
  b = Math.max(0, Math.min(255, b + amt));
  return `rgb(${r},${g},${b})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawPortrait(ctx, char, size) {
  const st = char.style;
  const s = size;
  const cx = s / 2;

  ctx.save();
  roundRect(ctx, 0, 0, s, s, s * 0.14);
  ctx.clip();

  // background
  const bg = ctx.createLinearGradient(0, 0, s, s);
  bg.addColorStop(0, shade(char.color, -70));
  bg.addColorStop(1, shade(char.color, -140));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, s, s);
  // rim light
  const rim = ctx.createRadialGradient(s * 0.7, s * 0.3, 4, s * 0.7, s * 0.3, s * 0.8);
  rim.addColorStop(0, 'rgba(255,255,255,0.18)');
  rim.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, s, s);

  const faceCY = s * 0.44;
  const faceW = s * 0.4;
  const faceH = s * 0.5;
  const faceTop = faceCY - faceH / 2;

  // shoulders / torso (clothing)
  const torso = ctx.createLinearGradient(0, s * 0.7, 0, s);
  torso.addColorStop(0, char.color);
  torso.addColorStop(1, shade(char.color, -50));
  ctx.fillStyle = torso;
  ctx.beginPath();
  ctx.moveTo(s * 0.1, s);
  ctx.quadraticCurveTo(s * 0.2, s * 0.78, cx, s * 0.76);
  ctx.quadraticCurveTo(s * 0.8, s * 0.78, s * 0.9, s);
  ctx.closePath();
  ctx.fill();
  // collar accent
  ctx.strokeStyle = char.accent;
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.1, s * 0.82);
  ctx.lineTo(cx, s * 0.9);
  ctx.lineTo(cx + s * 0.1, s * 0.82);
  ctx.stroke();

  // neck
  ctx.fillStyle = shade(st.skin, -25);
  ctx.fillRect(cx - s * 0.07, faceCY + faceH * 0.28, s * 0.14, s * 0.16);

  // back hair
  drawBackHair(ctx, st, cx, faceCY, faceW, faceH, s);

  // face
  const faceGrad = ctx.createLinearGradient(cx - faceW / 2, 0, cx + faceW / 2, 0);
  faceGrad.addColorStop(0, shade(st.skin, -18));
  faceGrad.addColorStop(0.5, st.skin);
  faceGrad.addColorStop(1, shade(st.skin, -18));
  ctx.fillStyle = faceGrad;
  ctx.beginPath();
  ctx.moveTo(cx - faceW / 2, faceTop + faceH * 0.28);
  ctx.quadraticCurveTo(cx - faceW / 2, faceTop, cx, faceTop);
  ctx.quadraticCurveTo(cx + faceW / 2, faceTop, cx + faceW / 2, faceTop + faceH * 0.28);
  ctx.lineTo(cx + faceW * 0.42, faceTop + faceH * 0.6);
  ctx.quadraticCurveTo(cx + faceW * 0.34, faceCY + faceH * 0.42, cx, faceCY + faceH * 0.46);
  ctx.quadraticCurveTo(cx - faceW * 0.34, faceCY + faceH * 0.42, cx - faceW * 0.42, faceTop + faceH * 0.6);
  ctx.closePath();
  ctx.fill();

  // ears
  ctx.fillStyle = shade(st.skin, -20);
  [-1, 1].forEach((d) => {
    ctx.beginPath();
    ctx.ellipse(cx + d * faceW * 0.46, faceCY, s * 0.03, s * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // ---- eyes ----
  const eyeY = faceCY + faceH * 0.02;
  const eyeDX = faceW * 0.22;
  const eyeW = faceW * 0.2;
  const eyeH = faceH * 0.16;
  const shadow = st.crest === 'shadow';
  [-1, 1].forEach((d) => {
    const ex = cx + d * eyeDX;
    // eye white
    ctx.fillStyle = '#fbfdff';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, eyeW / 2, eyeH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // iris
    ctx.fillStyle = shadow ? shade(st.eye, 20) : st.eye;
    ctx.beginPath();
    ctx.ellipse(ex + d * eyeW * 0.06, eyeY + eyeH * 0.08, eyeW * 0.34, eyeH * 0.44, 0, 0, Math.PI * 2);
    ctx.fill();
    if (shadow) {
      ctx.shadowColor = st.eye;
      ctx.shadowBlur = s * 0.06;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    // pupil
    ctx.fillStyle = 'rgba(10,8,20,0.85)';
    ctx.beginPath();
    ctx.ellipse(ex + d * eyeW * 0.06, eyeY + eyeH * 0.08, eyeW * 0.15, eyeH * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(ex - eyeW * 0.12, eyeY - eyeH * 0.1, eyeW * 0.09, 0, Math.PI * 2);
    ctx.fill();
    // upper lid
    ctx.strokeStyle = 'rgba(20,15,30,0.8)';
    ctx.lineWidth = s * 0.018;
    ctx.beginPath();
    ctx.moveTo(ex - eyeW * 0.55, eyeY - eyeH * 0.4);
    ctx.quadraticCurveTo(ex, eyeY - eyeH * 0.75, ex + eyeW * 0.55, eyeY - eyeH * 0.3);
    ctx.stroke();
  });

  // eyebrows (determined)
  ctx.strokeStyle = shade(st.hair, -20);
  ctx.lineWidth = s * 0.022;
  ctx.lineCap = 'round';
  [-1, 1].forEach((d) => {
    const bx = cx + d * eyeDX;
    ctx.beginPath();
    ctx.moveTo(bx - d * eyeW * 0.5, eyeY - eyeH * 0.75);
    ctx.lineTo(bx + d * eyeW * 0.55, eyeY - eyeH * 1.05);
    ctx.stroke();
  });

  // nose + mouth
  ctx.strokeStyle = shade(st.skin, -45);
  ctx.lineWidth = s * 0.014;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.008, eyeY + eyeH * 0.9);
  ctx.lineTo(cx + s * 0.02, eyeY + eyeH * 1.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - faceW * 0.1, faceCY + faceH * 0.22);
  ctx.quadraticCurveTo(cx, faceCY + faceH * 0.27, cx + faceW * 0.1, faceCY + faceH * 0.22);
  ctx.stroke();

  // front hair / crest on top
  drawFrontHair(ctx, st, cx, faceCY, faceW, faceH, faceTop, s, char);

  ctx.restore();

  // border
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 2;
  roundRect(ctx, 1, 1, s - 2, s - 2, s * 0.14);
  ctx.stroke();
}

function drawBackHair(ctx, st, cx, faceCY, faceW, faceH, s) {
  ctx.fillStyle = shade(st.hair, -35);
  const top = faceCY - faceH * 0.62;
  if (st.hairStyle === 'hood' || st.hairStyle === 'cloak') {
    // hood behind
    ctx.fillStyle = st.hairStyle === 'cloak' ? shade(st.hair, 10) : shade(st.hair, -10);
    ctx.beginPath();
    ctx.moveTo(cx - faceW * 0.85, faceCY + faceH * 0.4);
    ctx.quadraticCurveTo(cx - faceW * 0.95, top - faceH * 0.1, cx, top - faceH * 0.18);
    ctx.quadraticCurveTo(cx + faceW * 0.95, top - faceH * 0.1, cx + faceW * 0.85, faceCY + faceH * 0.4);
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.ellipse(cx, faceCY - faceH * 0.05, faceW * 0.62, faceH * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawFrontHair(ctx, st, cx, faceCY, faceW, faceH, faceTop, s, char) {
  const hair = st.hair;
  const hl = shade(hair, 30);
  ctx.fillStyle = hair;

  const drawBangs = () => {
    const grad = ctx.createLinearGradient(0, faceTop - faceH * 0.3, 0, faceCY);
    grad.addColorStop(0, hl);
    grad.addColorStop(1, hair);
    ctx.fillStyle = grad;
  };

  switch (st.hairStyle) {
    case 'spiky': {
      drawBangs();
      ctx.beginPath();
      const baseY = faceTop + faceH * 0.16;
      ctx.moveTo(cx - faceW * 0.56, baseY);
      const spikes = 7;
      for (let i = 0; i <= spikes; i += 1) {
        const t = i / spikes;
        const x = cx - faceW * 0.56 + t * faceW * 1.12;
        const up = faceTop - faceH * (0.25 + (i % 2) * 0.18);
        ctx.lineTo(x, up);
        ctx.lineTo(x + faceW * 0.08, baseY - faceH * 0.02);
      }
      ctx.lineTo(cx + faceW * 0.56, baseY + faceH * 0.05);
      ctx.quadraticCurveTo(cx, faceTop + faceH * 0.02, cx - faceW * 0.56, baseY);
      ctx.fill();
      break;
    }
    case 'slick': {
      drawBangs();
      ctx.beginPath();
      ctx.moveTo(cx - faceW * 0.58, faceTop + faceH * 0.24);
      ctx.quadraticCurveTo(cx - faceW * 0.3, faceTop - faceH * 0.22, cx + faceW * 0.6, faceTop - faceH * 0.05);
      ctx.quadraticCurveTo(cx + faceW * 0.2, faceTop + faceH * 0.02, cx + faceW * 0.1, faceTop + faceH * 0.2);
      ctx.quadraticCurveTo(cx - faceW * 0.2, faceTop + faceH * 0.06, cx - faceW * 0.58, faceTop + faceH * 0.24);
      ctx.fill();
      break;
    }
    case 'mohawk': {
      // shaved sides = skin already; central strip
      drawBangs();
      ctx.beginPath();
      ctx.moveTo(cx - faceW * 0.16, faceTop + faceH * 0.1);
      ctx.lineTo(cx - faceW * 0.1, faceTop - faceH * 0.42);
      ctx.lineTo(cx, faceTop - faceH * 0.2);
      ctx.lineTo(cx + faceW * 0.1, faceTop - faceH * 0.46);
      ctx.lineTo(cx + faceW * 0.16, faceTop + faceH * 0.1);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'rugged': {
      drawBangs();
      ctx.beginPath();
      ctx.moveTo(cx - faceW * 0.56, faceTop + faceH * 0.2);
      for (let i = 0; i <= 5; i += 1) {
        const t = i / 5;
        const x = cx - faceW * 0.56 + t * faceW * 1.12;
        ctx.quadraticCurveTo(x, faceTop - faceH * 0.1, x + faceW * 0.11, faceTop + faceH * 0.05);
      }
      ctx.lineTo(cx + faceW * 0.56, faceTop + faceH * 0.2);
      ctx.fill();
      // stubble
      ctx.fillStyle = 'rgba(40,30,20,0.25)';
      ctx.beginPath();
      ctx.ellipse(cx, faceCY + faceH * 0.28, faceW * 0.32, faceH * 0.16, 0, 0, Math.PI);
      ctx.fill();
      break;
    }
    case 'hood':
    case 'cloak': {
      const cloth = st.hairStyle === 'cloak' ? shade(char.color, -30) : char.color;
      ctx.fillStyle = cloth;
      ctx.beginPath();
      ctx.moveTo(cx - faceW * 0.78, faceCY + faceH * 0.2);
      ctx.quadraticCurveTo(cx - faceW * 0.7, faceTop - faceH * 0.35, cx, faceTop - faceH * 0.4);
      ctx.quadraticCurveTo(cx + faceW * 0.7, faceTop - faceH * 0.35, cx + faceW * 0.78, faceCY + faceH * 0.2);
      ctx.quadraticCurveTo(cx + faceW * 0.5, faceTop + faceH * 0.02, cx, faceTop + faceH * 0.04);
      ctx.quadraticCurveTo(cx - faceW * 0.5, faceTop + faceH * 0.02, cx - faceW * 0.78, faceCY + faceH * 0.2);
      ctx.fill();
      if (st.hairStyle === 'cloak') {
        // shadow over upper face
        ctx.fillStyle = 'rgba(10,6,20,0.4)';
        ctx.beginPath();
        ctx.ellipse(cx, faceCY - faceH * 0.02, faceW * 0.42, faceH * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    default:
      break;
  }

  // crest accessory (headband gem / small emblem)
  drawCrest(ctx, st, cx, faceTop, faceW, faceH, s);
}

function drawCrest(ctx, st, cx, faceTop, faceW, faceH, s) {
  const cy = faceTop + faceH * 0.06;
  const map = {
    flame: '#ff8a2f',
    ice: '#bfefff',
    spark: '#fff08a',
    rock: '#c9a06a',
    wind: '#bfffd6',
    shadow: '#e08bff',
  };
  const col = map[st.crest] || '#fff';
  if (st.crest === 'rock' || st.crest === 'wind') return; // no forehead gem
  ctx.fillStyle = col;
  ctx.shadowColor = col;
  ctx.shadowBlur = s * 0.05;
  ctx.beginPath();
  if (st.crest === 'flame') {
    ctx.moveTo(cx, cy - faceH * 0.1);
    ctx.quadraticCurveTo(cx + faceW * 0.08, cy, cx, cy + faceH * 0.05);
    ctx.quadraticCurveTo(cx - faceW * 0.08, cy, cx, cy - faceH * 0.1);
  } else {
    ctx.moveTo(cx, cy - faceH * 0.06);
    ctx.lineTo(cx + faceW * 0.06, cy);
    ctx.lineTo(cx, cy + faceH * 0.06);
    ctx.lineTo(cx - faceW * 0.06, cy);
    ctx.closePath();
  }
  ctx.fill();
  ctx.shadowBlur = 0;
}

/** Create a standalone canvas with the portrait rendered at devicePixelRatio. */
export function makePortraitCanvas(char, size) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement('canvas');
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  drawPortrait(ctx, char, size);
  return canvas;
}
