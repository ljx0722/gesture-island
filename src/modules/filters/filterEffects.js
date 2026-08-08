// filterEffects.js — 17 filters with visible parameter effects
function lerp(a, b, t) { return a + (b - a) * t }
function clampByte(v) { return Math.max(0, Math.min(255, Math.round(v))) }
function noise2d(x, y, seed = 0) { const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s) }

function hslToRgb(h, s, l) {
  let r, g, b
  if (s === 0) { r = g = b = l }
  else {
    const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p+(q-p)*6*t; if (t < 1/2) return q; if (t < 2/3) return p+(q-p)*(2/3-t)*6; return p }
    const q = l < 0.5 ? l*(1+s) : l+s-l*s, p = 2*l - q
    r = hue2rgb(p,q,h+1/3); g = hue2rgb(p,q,h); b = hue2rgb(p,q,h-1/3)
  }
  return { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255) }
}

export function applyVintageHalftone(r, g, b, x, y, maskAlpha, p, t) {
  let gray = 0.299*r+0.587*g+0.114*b
  gray = gray*p.contrast+(128-128*p.contrast)
  const d = Math.sin(x*p.dotSize*0.3)*Math.cos(y*p.dotSize*0.3)*0.5+0.5
  const grain = (noise2d(x,y,Math.floor(t*10))-0.5)*40*(p.grainAmount||0)
  let tr,tg,tb
  if (gray<85) { tr=42; tg=10; tb=10 }
  else if (gray<170) { tr=139; tg=26; tb=26 }
  else { tr=245; tg=230; tb=210 }
  return { r: clampByte(lerp(r,tr+grain,p.intensity)), g: clampByte(lerp(g,tg+grain,p.intensity)), b: clampByte(lerp(b,tb+grain,p.intensity)) }
}

export function applyCoolBlue(r, g, b, x, y, maskAlpha, p, t) {
  let gray = 0.299*r+0.587*g+0.114*b
  gray = gray*(1-p.desaturation)+(r+g+b)/3*p.desaturation
  const nr = lerp(r,gray,p.desaturation), ng = lerp(g,gray,p.desaturation), nb = lerp(b,gray+60*p.blueShift,p.desaturation)
  const scanline = Math.sin(y*0.5+t*2)*p.scanlineOpacity*35
  return { r: clampByte(lerp(r,nr*0.65+10+scanline,p.intensity)), g: clampByte(lerp(g,ng*0.75+20+scanline,p.intensity)), b: clampByte(lerp(b,nb*1.1+30+scanline,p.intensity)) }
}

export function applyVintageGreen(r, g, b, x, y, maskAlpha, p, t) {
  let gray = 0.299*r+0.587*g+0.114*b
  const offX = (p.rgbOffset||0)*(Math.sin(t*2)*2), dith = (p.ditherAmount||0)*(noise2d(x,y,0)-0.5)*35
  const gShift = (p.greenShift||0)*40
  let tr,tg,tb
  if (gray<85) { tr=26; tg=42+gShift; tb=10 }
  else if (gray<170) { tr=74; tg=90+gShift; tb=58 }
  else { tr=230; tg=224+gShift; tb=208 }
  return { r: clampByte(lerp(r,tr+dith+offX,p.intensity)), g: clampByte(lerp(g,tg+dith,p.intensity)), b: clampByte(lerp(b,tb+dith-offX,p.intensity)) }
}

export function applyWarmSepia(r, g, b, x, y, maskAlpha, p, t) {
  let gray = 0.299*r+0.587*g+0.114*b
  const sr = gray*1.1+30*p.warmth, sg = gray*0.95+15*p.warmth, sb = gray*0.7-10*p.warmth
  const vig = 1-Math.sqrt((x%400-200)**2+(y%400-200)**2)/300
  const v = Math.max(0,Math.min(1,vig*(p.vignetteStrength||0)))+0.5
  const paper = (p.paperAge||0)*(noise2d(x/3,y/3,1)-0.5)*25
  return { r: clampByte(lerp(r,Math.min(255,sr)*v+paper,p.intensity)), g: clampByte(lerp(g,Math.min(255,sg)*v+paper,p.intensity)), b: clampByte(lerp(b,Math.min(255,sb)*v+paper,p.intensity)) }
}

export function applyNeonCyberpunk(r, g, b, x, y, maskAlpha, p, t) {
  let gray = 0.299*r+0.587*g+0.114*b
  const glow=(p.neonGlow||0)*(Math.sin(x*0.05+t*2)*Math.cos(y*0.05-t)+1)*25
  const flick=1+((p.flickerSpeed||0)>0?((noise2d(0,Math.floor(t*20),2)>0.7)?0.12:0):0)
  if (gray>128*p.duotoneBalance) return { r:clampByte(lerp(r,(220+gray*0.1)*flick+glow,p.intensity)), g:clampByte(lerp(g,gray*0.3*flick+glow*0.5,p.intensity)), b:clampByte(lerp(b,(180+gray*0.2)*flick+glow,p.intensity)) }
  return { r:clampByte(lerp(r,gray*0.2*flick+glow*0.5,p.intensity)), g:clampByte(lerp(g,(160+gray*0.3)*flick+glow*0.3,p.intensity)), b:clampByte(lerp(b,(200+gray*0.2)*flick+glow,p.intensity)) }
}

export function applyBWSilver(r, g, b, x, y, maskAlpha, p, t) {
  let gray = 0.299*r+0.587*g+0.114*b
  gray = ((gray-128)*p.contrast+128); gray = Math.max(0,Math.min(255,gray))
  const grain = (noise2d(x,y,Math.floor(t*8))-0.5)*16*(p.grainSize||0)
  return { r:clampByte(lerp(r,gray+grain,p.intensity)), g:clampByte(lerp(g,gray*0.98+4*p.silverTone+grain,p.intensity)), b:clampByte(lerp(b,gray*0.95+6*p.silverTone+grain,p.intensity)) }
}

export function applyPopArt(r, g, b, x, y, maskAlpha, p, t) {
  const gray = 0.299*r+0.587*g+0.114*b, sr=lerp(gray,r,p.saturation), sg=lerp(gray,g,p.saturation), sb=lerp(gray,b,p.saturation)
  const dotSize = (p.dotSize || 5) * 0.06
  const dot = Math.sin(x * dotSize) * Math.sin(y * dotSize) > 0 ? 0.15 : -0.15
  const outline = (p.outlineThickness||0)*(Math.abs(Math.sin(x*0.04+y*0.04))>0.95?50:0)
  return { r:clampByte(lerp(r,Math.round(sr/64)*64*(1+dot)+outline,p.intensity)), g:clampByte(lerp(g,Math.round(sg/64)*64*(1+dot)+outline,p.intensity)), b:clampByte(lerp(b,Math.round(sb/64)*64*(1+dot)+outline,p.intensity)) }
}

export function applyOilPainting(r, g, b, x, y, maskAlpha, p, t) {
  const bs = p.brushSize||6, bx=Math.floor(x/bs)*bs, by=Math.floor(y/bs)*bs
  const jit = ((bx*7+by*13)%100)/100*p.colorVariance*40
  const relief = (p.reliefStrength||0)*Math.sin(bx*0.3)*Math.cos(by*0.3)*25
  return { r:clampByte(lerp(r,Math.min(255,r+jit+relief),p.intensity)), g:clampByte(lerp(g,Math.min(255,g+jit*0.8+relief),p.intensity)), b:clampByte(lerp(b,Math.min(255,b+jit*0.6+relief),p.intensity)) }
}

export function applyWatercolor(r, g, b, x, y, maskAlpha, p, t) {
  const sr=r*(1-p.washSoftness*0.3)+240*p.washSoftness*0.3, sg=g*(1-p.washSoftness*0.3)+240*p.washSoftness*0.3, sb=b*(1-p.washSoftness*0.3)+235*p.washSoftness*0.3
  const bleed = (p.bleedRadius||0)*(noise2d(x/8,y/8,Math.floor(t))-0.5)*40
  const paper = (p.paperTexture||0)*(noise2d(x/2,y/2,3)-0.5)*18
  return { r:clampByte(lerp(r,sr+bleed+paper,p.intensity)), g:clampByte(lerp(g,sg+bleed+paper,p.intensity)), b:clampByte(lerp(b,sb+bleed+paper,p.intensity)) }
}

export function applyPixelRetro(r, g, b, x, y, maskAlpha, p, t) {
  const px=Math.floor(x/p.pixelSize)*p.pixelSize, py=Math.floor(y/p.pixelSize)*p.pixelSize
  const lv=Math.pow(2,Math.round(p.colorDepth)), step=256/lv
  const pattern = p.ditherPattern || 0
  let noiseOff = 0
  if (pattern === 1) noiseOff = (noise2d(px, py, 0) - 0.5) * step * 0.4
  else if (pattern === 2) noiseOff = (Math.sin(px * 0.5) * Math.cos(py * 0.5)) * step * 0.3
  return { r:clampByte(lerp(r,Math.round((r+noiseOff)/step)*step,p.intensity)), g:clampByte(lerp(g,Math.round((g+noiseOff)/step)*step,p.intensity)), b:clampByte(lerp(b,Math.round((b+noiseOff)/step)*step,p.intensity)) }
}

export function applyThermal(r, g, b, x, y, maskAlpha, p, t) {
  let gv=(0.299*r+0.587*g+0.114*b)/255; gv=Math.max(0,Math.min(1,(gv-0.5)*p.heatSensitivity+0.5))
  const coldH = ((p.coldHue||240)/360)%1, hotH = ((p.hotHue||0)/360)%1
  let hr,hg,hb
  if (gv<0.33){ const T=gv/0.33; const c=hslToRgb(coldH,0.7,0.4), m=hslToRgb((coldH+hotH)/2,0.6,0.5); hr=lerp(c.r,m.r,T); hg=lerp(c.g,m.g,T); hb=lerp(c.b,m.b,T) }
  else if (gv<0.66){ const T=(gv-0.33)/0.33; const m=hslToRgb((coldH+hotH)/2,0.6,0.5), w=hslToRgb(hotH,0.8,0.55); hr=lerp(m.r,w.r,T); hg=lerp(m.g,w.g,T); hb=lerp(m.b,w.b,T) }
  else { const T=(gv-0.66)/0.34; const w=hslToRgb(hotH,0.8,0.55); hr=lerp(w.r,255,T); hg=lerp(w.g,50,T); hb=lerp(w.b,0,T) }
  return { r:clampByte(lerp(r,hr,p.intensity)), g:clampByte(lerp(g,hg,p.intensity)), b:clampByte(lerp(b,hb,p.intensity)) }
}

export function applySketchPencil(r, g, b, x, y, maskAlpha, p, t) {
  let gray=0.299*r+0.587*g+0.114*b
  const threshold = p.edgeThreshold || 0.15
  const hatch=Math.sin(x*p.lineDensity*0.1+y*Math.tan(p.hatchAngle*Math.PI/180)*p.lineDensity*0.1)>0?30:0
  const edge=255-Math.abs(gray-128)*2
  const e = edge < (threshold*255) ? 128 : edge
  return { r:clampByte(lerp(r,Math.max(0,e-hatch),p.intensity)), g:clampByte(lerp(g,Math.max(0,e-hatch),p.intensity)), b:clampByte(lerp(b,Math.max(0,e-hatch),p.intensity)) }
}

export function applyRainbowHolo(r, g, b, x, y, maskAlpha, p, t) {
  const shift = p.shiftHue || 0
  const hue=((x*0.3+y*0.5+t*p.prismSpeed+shift*360)%1)*360
  const {r:hr,g:hg,b:hb}=hslToRgb(hue/360,0.8,0.55)
  return { r:clampByte(lerp(r,hr,p.intensity*p.rainbowIntensity)), g:clampByte(lerp(g,hg,p.intensity*p.rainbowIntensity)), b:clampByte(lerp(b,hb,p.intensity*p.rainbowIntensity)) }
}

export function applyNegativeInvert(r, g, b, x, y, maskAlpha, p, t) {
  const curve=(v)=>{ const n=v/255; return 1/(1+Math.exp(-p.curveSteepness*(n-0.5)))*255 }
  return { r:clampByte(lerp(r,255-curve(r),p.intensity*p.inversionAmount)), g:clampByte(lerp(g,255-curve(g),p.intensity*p.inversionAmount)), b:clampByte(lerp(b,255-curve(b),p.intensity*p.inversionAmount)) }
}

export function applyGlitchArt(r, g, b, x, y, maskAlpha, p, t) {
  if (Math.random()>p.glitchChance) return {r,g,b}
  const si=Math.floor(y/p.sliceHeight), sx=((si*7+Math.floor(t*10))%100<40)?p.rgbShiftX:0, sy=((si*13)%100<30)?p.rgbShiftY:0
  return { r:clampByte(r+sx*3), g:clampByte(g-sx), b:clampByte(b+sy*2) }
}

export function applyCustomMagic(r, g, b, x, y, maskAlpha, p, t) {
  const I=p.intensity??0.85, sc=Math.max(0.1,p.patternScale??1.5), sp=p.animationSpeed??1, time=t*sp
  const c1=p.primaryRgb||[255,79,216], c2=p.secondaryRgb||[64,220,255]
  const gray=(0.299*r+0.587*g+0.114*b)/255
  let pat=0
  if (p.pattern==='dots'){ const cl=18/sc,cx=((x+time*25)%cl)-cl/2,cy=((y-time*15)%cl)-cl/2; pat=1-Math.min(1,Math.sqrt(cx*cx+cy*cy)/(cl*0.38)) }
  else if (p.pattern==='stripes') pat=Math.sin((x*0.08+y*0.04)*sc+time*3)*0.5+0.5
  else if (p.pattern==='checker'){ const cl=Math.max(4,28/sc); pat=((Math.floor((x+time*18)/cl)+Math.floor(y/cl))%2)?0.8:0.2 }
  else if (p.pattern==='stars'){ const n=noise2d(Math.floor(x/12),Math.floor(y/12),Math.floor(time*4)); pat=n>0.72?Math.sin(time*8+n*20)*0.5+0.5:Math.sin((x+y)*0.025*sc+time)*0.2+0.35 }
  else pat=Math.sin(x*0.025*sc+Math.sin(y*0.018*sc+time)*2+time*2)*0.5+0.5

  let cA=c1,cB=c2
  if (p.rainbow){ const h=(x*0.0015*sc+y*0.001*sc+time*0.08+gray*0.25)%1; const rA=hslToRgb(h,0.9,0.58),rB=hslToRgb((h+0.35)%1,0.9,0.55); cA=[rA.r,rA.g,rA.b]; cB=[rB.r,rB.g,rB.b] }

  let tr=lerp(cA[0],cB[0],pat), tg=lerp(cA[1],cB[1],pat), tb=lerp(cA[2],cB[2],pat)
  if (p.mixMode==='duotone'){ tr=lerp(cA[0],cB[0],gray); tg=lerp(cA[1],cB[1],gray); tb=lerp(cA[2],cB[2],gray) }
  else if (p.mixMode==='poster'){ const b=Math.floor(gray*4)/3; tr=lerp(cA[0],cB[0],b); tg=lerp(cA[1],cB[1],b); tb=lerp(cA[2],cB[2],b) }
  else if (p.mixMode==='glow'){ const gl=0.6+pat*0.6; tr*=gl; tg*=gl; tb*=gl }
  else { tr=lerp(r,tr,0.7); tg=lerp(g,tg,0.7); tb=lerp(b,tb,0.7) }

  const sparkle=(p.sparkle??0.35)*(noise2d(Math.floor(x/5),Math.floor(y/5),Math.floor(time*8))>0.86?70:0)
  return { r:clampByte(lerp(r,tr+sparkle,I)), g:clampByte(lerp(g,tg+sparkle,I)), b:clampByte(lerp(b,tb+sparkle,I)) }
}

// New fun filters
export function applyKaleidoscope(r, g, b, x, y, maskAlpha, p, t) {
  const cx=(x%200)-100, cy=(y%200)-100, a=Math.atan2(cy,cx), r2=Math.sqrt(cx*cx+cy*cy)
  const seg=3+(p.segments||4), mirrorA=((a*seg/Math.PI)%2)-1
  const mirrorR=Math.abs(mirrorA)*2; const hue=(mirrorR*0.5+(r2*0.002+t*0.2))%1
  const {r:hr,g:hg,b:hb}=hslToRgb(hue,0.85,0.55)
  return { r:clampByte(lerp(r,hr,p.intensity||0.85)), g:clampByte(lerp(g,hg,p.intensity||0.85)), b:clampByte(lerp(b,hb,p.intensity||0.85)) }
}

export function applyCandyPaint(r, g, b, x, y, maskAlpha, p, t) {
  const gray=(0.299*r+0.587*g+0.114*b)/255
  const h=((x*0.002+y*0.003)+(p.colorShift||0)+Math.sin(t*(p.speed||1))*0.15)%1
  const {r:hr,g:hg,b:hb}=hslToRgb(h,1,0.45+gray*0.35)
  const drips=(p.dripAmount||0)*(Math.sin(x*0.1+t*3)*Math.sin(y*0.15)*0.6+0.4)*40
  return { r:clampByte(lerp(r,hr+drips,p.intensity||0.8)), g:clampByte(lerp(g,hg+drips,p.intensity||0.8)), b:clampByte(lerp(b,hb+drips,p.intensity||0.8)) }
}

// ── New filters inspired by finger-frame-effect ──

export function applyToonShader(r, g, b, x, y, maskAlpha, p, t) {
  const levels = p.posterLevels || 5
  const step = 256 / levels
  const pr = Math.round(r / step) * step, pg = Math.round(g / step) * step, pb = Math.round(b / step) * step
  const edge = p.edgeStrength || 0.3
  let gray = 0.299 * r + 0.587 * g + 0.114 * b
  const gx = (noise2d(x + 1, y) - noise2d(x - 1, y)) * 80
  const gy = (noise2d(x, y + 1) - noise2d(x, y - 1)) * 80
  let gval = Math.sqrt(gx * gx + gy * gy) / 150
  const outline = gval > (0.15 / (edge + 0.01)) ? 0 : 1
  return {
    r: clampByte(lerp(r, pr * outline + (1 - outline) * 20, p.intensity || 0.85)),
    g: clampByte(lerp(g, pg * outline + (1 - outline) * 20, p.intensity || 0.85)),
    b: clampByte(lerp(b, pb * outline + (1 - outline) * 20, p.intensity || 0.85)),
  }
}

export function applyFilmNoir(r, g, b, x, y, maskAlpha, p, t) {
  let gray = 0.299 * r + 0.587 * g + 0.114 * b
  gray = ((gray - 128) * (p.contrast || 2) + 128)
  gray = clampByte(gray)
  const grain = (noise2d(x * 2, y * 2, Math.floor(t * 15)) - 0.5) * 30 * (p.grainAmount || 0.6)
  const vx = x - cx, vy = y - cy
  const maxDist = Math.sqrt(cx * cx + cy * cy)
  const vig = 1 - Math.sqrt(vx * vx + vy * vy) / (maxDist * 0.9)
  const vignette = clamp(Math.max(0, vig * (p.vignetteStrength || 0.7)) * 0.5 + 0.5, 0, 1)
  return {
    r: clampByte(lerp(r, (gray + grain) * vignette, p.intensity || 0.9)),
    g: clampByte(lerp(g, (gray - 2 + grain) * vignette, p.intensity || 0.9)),
    b: clampByte(lerp(b, (gray - 5 + grain) * vignette, p.intensity || 0.9)),
  }
}

export function applyMosaic(r, g, b, x, y, maskAlpha, p, t) {
  const bs = Math.max(4, p.blockSize || 16)
  const bx = Math.floor(x / bs) * bs, by = Math.floor(y / bs) * bs
  const shift = Math.max(0.5, p.colorShift || 0.6)
  const steps = Math.round(256 / (4 + (1 - shift) * 12))
  const sr = Math.round((r + (bx % 13 - 6)) / steps) * steps
  const sg = Math.round((g + (by % 11 - 5)) / steps) * steps
  const sb = Math.round((b + ((bx + by) % 17 - 8)) / steps) * steps
  return {
    r: clampByte(lerp(r, sr, p.intensity || 0.9)),
    g: clampByte(lerp(g, sg, p.intensity || 0.9)),
    b: clampByte(lerp(b, sb, p.intensity || 0.9)),
  }
}

export function applyEmboss(r, g, b, x, y, maskAlpha, p, t) {
  let gray = 0.299 * r + 0.587 * g + 0.114 * b
  const gx = (noise2d(x + 1, y) - noise2d(x - 1, y)) * 40
  const gy = (noise2d(x, y + 1) - noise2d(x, y - 1)) * 40
  const relief = (Math.abs(gx) + Math.abs(gy)) * (p.reliefDepth || 1.5)
  gray = clampByte(gray + relief - 128 * (p.reliefDepth || 1.5) + 128)
  return {
    r: clampByte(lerp(r, gray + 15, p.intensity || 0.8)),
    g: clampByte(lerp(g, gray + 5, p.intensity || 0.8)),
    b: clampByte(lerp(b, gray - 10, p.intensity || 0.8)),
  }
}

export function applyDreamGlow(r, g, b, x, y, maskAlpha, p, t) {
  const glow = p.glowAmount || 0.5
  const soft = p.softness || 0.4
  const avg = (r + g + b) / 3
  const wr = avg + (r - avg) * (1 - soft) + 60 * glow * Math.sin(x * 0.03 + t * 2) * Math.cos(y * 0.03 + t)
  const wg = avg + (g - avg) * (1 - soft) + 50 * glow * Math.sin(y * 0.03 + t * 1.5) * Math.cos(x * 0.03 + t)
  const wb = avg + (b - avg) * (1 - soft) + 70 * glow * Math.sin((x + y) * 0.03 + t * 1.8) * Math.cos(x * 0.03 + t)
  return {
    r: clampByte(lerp(r, wr, p.intensity || 0.7)),
    g: clampByte(lerp(g, wg, p.intensity || 0.7)),
    b: clampByte(lerp(b, wb, p.intensity || 0.7)),
  }
}

export function applyVibrance(r, g, b, x, y, maskAlpha, p, t) {
  const avg = (r + g + b) / 3
  const maxChan = Math.max(r, g, b)
  const saturation = maxChan > 0 ? (maxChan - Math.min(r, g, b)) / maxChan : 0
  const boost = (p.vibranceBoost || 0.6) * (1 - saturation)
  const sr = avg + (r - avg) * (1 + boost), sg = avg + (g - avg) * (1 + boost), sb = avg + (b - avg) * (1 + boost)
  return {
    r: clampByte(lerp(r, sr, p.intensity || 0.8)),
    g: clampByte(lerp(g, sg, p.intensity || 0.8)),
    b: clampByte(lerp(b, sb, p.intensity || 0.8)),
  }
}

export const FILTER_APPLIERS = {
  'vintage-halftone': applyVintageHalftone, 'cool-blue': applyCoolBlue, 'vintage-green': applyVintageGreen,
  'warm-sepia': applyWarmSepia, 'neon-cyberpunk': applyNeonCyberpunk, 'bw-silver': applyBWSilver,
  'pop-art': applyPopArt, 'oil-painting': applyOilPainting, 'watercolor': applyWatercolor,
  'pixel-retro': applyPixelRetro, 'thermal': applyThermal, 'sketch-pencil': applySketchPencil,
  'rainbow-holo': applyRainbowHolo, 'negative-invert': applyNegativeInvert, 'glitch-art': applyGlitchArt,
  'custom-magic': applyCustomMagic,
  'kaleidoscope': applyKaleidoscope, 'candy-paint': applyCandyPaint,
  'toon-shader': applyToonShader, 'film-noir': applyFilmNoir,
  'mosaic': applyMosaic, 'emboss': applyEmboss,
  'dream-glow': applyDreamGlow, 'vibrance': applyVibrance,
}
