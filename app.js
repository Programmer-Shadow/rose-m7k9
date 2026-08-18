(() => {
  "use strict";

  const canvas = document.getElementById("roseCanvas");
  const shell = document.querySelector(".app-shell");
  const heartLayer = document.getElementById("heartLayer");
  const bloomButton = document.getElementById("bloomButton");
  const musicButton = document.getElementById("musicButton");
  const musicLabel = document.getElementById("musicLabel");
  const gestureHint = document.getElementById("gestureHint");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const TAU = Math.PI * 2;
  const mobileQuery = window.matchMedia("(max-width: 680px)");
  const palette = [
    [1.0, 0.19, 0.31],
    [1.0, 0.35, 0.48],
    [1.0, 0.62, 0.7],
    [1.0, 0.83, 0.58],
    [1.0, 0.94, 0.84]
  ];
  const leafPalette = [
    [0.38, 0.75, 0.42],
    [0.57, 0.86, 0.55],
    [0.78, 0.9, 0.55]
  ];
  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    progress: 0,
    progressVelocity: 0.48,
    pulse: 0,
    burstLife: 0,
    frame: 0,
    lastTime: performance.now(),
    pointerDown: false,
    lastPointer: null,
    lastTap: 0,
    dragging: false,
    targetRotationX: -0.08,
    targetRotationY: -0.18,
    rotationX: -0.08,
    rotationY: -0.18,
    musicPlaying: false
  };

  let renderer;
  let scene;
  let camera;
  let roseGroup;
  let roseMaterial;
  let burstPoints;
  let burstMaterial;
  let particles = [];
  let audio = null;
  let fallbackContext = null;

  const random = (min, max) => min + Math.random() * (max - min);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const smooth = (value) => value * value * (3 - 2 * value);
  const lerp = (a, b, amount) => a + (b - a) * amount;

  function rgba(color, alpha) {
    return `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, ${alpha})`;
  }

  function addPoint(target, color, size, phase, spread = 3.2) {
    particles.push({
      target,
      start: new THREE.Vector3(
        target.x + random(-spread, spread),
        target.y + random(-spread, spread),
        target.z + random(-spread, spread)
      ),
      color,
      size,
      phase
    });
  }

  function addPetalParticles(layer, petalIndex, petalCount, count) {
    const baseAngle = (petalIndex / petalCount) * TAU + layer * 0.28;
    const length = 0.42 + layer * 0.145;
    const layerDepth = layer / 6;
    for (let index = 0; index < count; index += 1) {
      const u = Math.pow(Math.random(), 0.72);
      const v = random(-1, 1);
      const width = (0.075 + 0.24 * Math.sin(Math.PI * u) ** 0.82) * (1 - layerDepth * 0.2);
      const theta = baseAngle + v * width * (0.58 + u * 0.42) + (1 - u) * (0.34 - layerDepth * 0.12);
      const radius = 0.075 + length * u;
      const petalFold = 0.055 * Math.sin(Math.PI * u) + 0.035 * (1 - u);
      const x = Math.cos(theta) * (radius + v * width * 0.13);
      const y = 0.35 + Math.sin(theta) * (radius + v * width * 0.13) * 0.78 + petalFold - layerDepth * 0.055 * u * u;
      const z = 0.14 + layerDepth * 0.17 + Math.cos(theta) * radius * 0.13 + v * 0.055 + 0.07 * Math.sin(Math.PI * u);
      const color = palette[Math.floor(random(0, palette.length))];
      addPoint(new THREE.Vector3(x, y, z), color, random(0.035, 0.075), random(0, TAU), 2.8 + layerDepth * 0.55);
    }
  }

  function addCoreParticles(count) {
    for (let index = 0; index < count; index += 1) {
      const t = Math.random();
      const angle = t * TAU * 2.6 + random(-0.12, 0.12);
      const radius = 0.035 + t * 0.51;
      const x = Math.cos(angle) * radius * 0.92;
      const y = 0.38 + Math.sin(angle) * radius * 0.76 + 0.18 * (1 - t) - 0.06 * t;
      const z = 0.32 + Math.cos(angle) * radius * 0.18;
      addPoint(new THREE.Vector3(x, y, z), palette[Math.floor(random(1, palette.length))], random(0.04, 0.082), random(0, TAU), 2.25);
    }
  }

  function addCalyxParticles(count) {
    for (let index = 0; index < count; index += 1) {
      const t = Math.random();
      const angle = Math.floor(Math.random() * 5) * (TAU / 5) + random(-0.12, 0.12);
      const radius = 0.08 + t * 0.55;
      const x = Math.cos(angle) * radius;
      const y = 0.12 - t * 0.18 + Math.sin(angle) * radius * 0.28;
      const z = 0.12 + Math.cos(angle) * radius * 0.15;
      addPoint(new THREE.Vector3(x, y, z), leafPalette[Math.floor(random(0, leafPalette.length))], random(0.03, 0.068), random(0, TAU), 2.25);
    }
  }

  function addStemParticles(count) {
    for (let index = 0; index < count; index += 1) {
      const t = Math.random();
      const y = 0.42 - t * 1.82;
      const x = 0.04 * Math.sin(t * 5.2) - 0.04 * t + random(-0.045, 0.045) * (0.28 + t);
      const z = 0.035 * Math.cos(t * 3.5) + random(-0.035, 0.035);
      addPoint(new THREE.Vector3(x, y, z), [0.72, 0.22 + 0.23 * t, 0.25 + 0.1 * t], random(0.028, 0.06), random(0, TAU), 2.05);
    }
  }

  function addLeafParticles(side, count) {
    for (let index = 0; index < count; index += 1) {
      const u = Math.random();
      const v = random(-1, 1);
      const centerY = -0.75 - side * 0.06;
      const centerX = side * (0.12 + u * 0.36);
      const width = 0.2 * Math.sin(Math.PI * u) ** 0.7;
      const x = centerX + side * v * width;
      const y = centerY + 0.18 * Math.sin(Math.PI * u) - Math.abs(v) * 0.035;
      const z = 0.02 + 0.11 * Math.sin(Math.PI * u) + v * 0.025;
      addPoint(new THREE.Vector3(x, y, z), leafPalette[Math.floor(random(0, leafPalette.length))], random(0.028, 0.06), random(0, TAU), 2.15);
    }
  }

  function buildRoseParticles() {
    particles = [];
    const mobile = mobileQuery.matches;
    const targetCount = reduceMotion ? 4100 : mobile ? 7000 : 11500;
    const layerCount = 7;
    const petalCount = 12;
    const petalSamples = Math.floor(targetCount * 0.68 / layerCount / petalCount);
    for (let layer = 0; layer < layerCount; layer += 1) {
      for (let petal = 0; petal < petalCount; petal += 1) {
        addPetalParticles(layer, petal, petalCount, petalSamples);
      }
    }
    addCoreParticles(Math.floor(targetCount * 0.12));
    addCalyxParticles(Math.floor(targetCount * 0.055));
    addStemParticles(Math.floor(targetCount * 0.105));
    addLeafParticles(-1, Math.floor(targetCount * 0.035));
    addLeafParticles(1, Math.floor(targetCount * 0.035));
  }

  function makeRoseGeometry() {
    buildRoseParticles();
    const positions = new Float32Array(particles.length * 3);
    const starts = new Float32Array(particles.length * 3);
    const colors = new Float32Array(particles.length * 3);
    const sizes = new Float32Array(particles.length);
    const phases = new Float32Array(particles.length);
    particles.forEach((particle, index) => {
      const offset = index * 3;
      positions[offset] = particle.target.x;
      positions[offset + 1] = particle.target.y;
      positions[offset + 2] = particle.target.z;
      starts[offset] = particle.start.x;
      starts[offset + 1] = particle.start.y;
      starts[offset + 2] = particle.start.z;
      colors[offset] = particle.color[0];
      colors[offset + 1] = particle.color[1];
      colors[offset + 2] = particle.color[2];
      sizes[index] = particle.size;
      phases[index] = particle.phase;
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aStart", new THREE.BufferAttribute(starts, 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    return geometry;
  }

  const vertexShader = `
    uniform float uTime;
    uniform float uProgress;
    uniform float uPulse;
    attribute vec3 aStart;
    attribute vec3 aColor;
    attribute float aSize;
    attribute float aPhase;
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
      float progress = smoothstep(0.0, 1.0, uProgress);
      vec3 pos = mix(aStart, position, progress);
      vec3 normal = normalize(position + vec3(0.0001));
      float drift = sin(uTime * 0.95 + aPhase) * 0.012;
      pos += normal * drift;
      pos *= 1.0 + uPulse * (0.08 + 0.025 * sin(aPhase));
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = clamp(aSize * (260.0 / max(1.0, -mvPosition.z)) * (1.0 + uPulse * 0.38), 1.0, 7.0);
      gl_Position = projectionMatrix * mvPosition;
      vColor = aColor;
      vAlpha = (0.72 + 0.28 * sin(uTime * 1.8 + aPhase)) * (0.72 + progress * 0.28);
    }
  `;

  const fragmentShader = `
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
      vec2 point = gl_PointCoord - vec2(0.5);
      float distanceToCenter = length(point);
      float glow = smoothstep(0.5, 0.04, distanceToCenter);
      if (glow < 0.012) discard;
      gl_FragColor = vec4(vColor, glow * vAlpha);
    }
  `;

  function makeBurst() {
    const count = 180;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      const theta = Math.random() * TAU;
      const phi = Math.acos(random(-1, 1));
      const radius = random(0.55, 1.1);
      positions[offset] = radius * Math.sin(phi) * Math.cos(theta);
      positions[offset + 1] = radius * Math.cos(phi);
      positions[offset + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    burstMaterial = new THREE.PointsMaterial({
      color: 0xffd29a,
      size: 0.045,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    burstPoints = new THREE.Points(geometry, burstMaterial);
    burstPoints.visible = false;
    roseGroup.add(burstPoints);
  }

  function setupThree() {
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: "high-performance"
      });
    } catch (error) {
      setupFallback();
      return false;
    }
    renderer.setClearColor(0x000000, 0);
    if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if ("outputEncoding" in renderer && THREE.sRGBEncoding) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 6.3);
    roseGroup = new THREE.Group();
    scene.add(roseGroup);

    const geometry = makeRoseGeometry();
    roseMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uPulse: { value: 0 }
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    roseGroup.add(new THREE.Points(geometry, roseMaterial));
    makeBurst();
    resizeThree();
    return true;
  }

  function resizeThree() {
    if (!renderer) return;
    const rect = shell.getBoundingClientRect();
    state.width = Math.max(320, rect.width);
    state.height = Math.max(480, rect.height);
    state.dpr = Math.min(window.devicePixelRatio || 1, mobileQuery.matches ? 1.35 : 1.65);
    renderer.setPixelRatio(state.dpr);
    renderer.setSize(state.width, state.height, false);
    camera.aspect = state.width / state.height;
    camera.fov = mobileQuery.matches ? 43 : 39;
    camera.position.z = mobileQuery.matches ? 7.0 : 6.3;
    camera.updateProjectionMatrix();
    roseGroup.position.set(mobileQuery.matches ? 0.02 : 1.18, mobileQuery.matches ? -0.58 : -0.11, 0);
    roseGroup.scale.setScalar(mobileQuery.matches ? 0.92 : 1.0);
  }

  function setupFallback() {
    fallbackContext = canvas.getContext("2d");
    if (!fallbackContext) return;
    gestureHint.textContent = "当前设备不支持 3D，已切换为轻量模式";
    resizeFallback();
  }

  function resizeFallback() {
    if (!fallbackContext) return;
    const rect = shell.getBoundingClientRect();
    state.width = rect.width;
    state.height = rect.height;
    state.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.floor(state.width * state.dpr);
    canvas.height = Math.floor(state.height * state.dpr);
    fallbackContext.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  function renderFallback(time) {
    if (!fallbackContext) return;
    const centerX = state.width * (mobileQuery.matches ? 0.58 : 0.69);
    const centerY = state.height * (mobileQuery.matches ? 0.55 : 0.55);
    const scale = Math.min(state.width, state.height) * (mobileQuery.matches ? 0.27 : 0.29);
    fallbackContext.clearRect(0, 0, state.width, state.height);
    fallbackContext.save();
    fallbackContext.globalCompositeOperation = "lighter";
    const progress = smooth(state.progress);
    for (let index = 0; index < 2600; index += 1) {
      const angle = (index / 2600) * TAU * 3;
      const radius = 0.11 + Math.abs(Math.sin(angle * 2.5)) ** 0.7 * 0.88;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * 0.9;
      const px = lerp(random(-1.1, 1.1), x, progress);
      const py = lerp(random(-1.1, 1.1), y, progress);
      fallbackContext.fillStyle = rgba(palette[index % palette.length], 0.72);
      fallbackContext.beginPath();
      fallbackContext.arc(centerX + px * scale, centerY + py * scale, 1.1 + Math.sin(time * 0.002 + index) * 0.3, 0, TAU);
      fallbackContext.fill();
    }
    fallbackContext.restore();
  }

  function updateMotion(dt, time) {
    const speed = reduceMotion ? 0.55 : 0.78;
    if (state.progress < 1) {
      state.progress = clamp(state.progress + dt * state.progressVelocity, 0, 1);
      state.progressVelocity = lerp(state.progressVelocity, speed, dt * 1.8);
    }
    state.pulse = Math.max(0, state.pulse - dt * 1.4);
    state.burstLife = Math.max(0, state.burstLife - dt * 1.2);
    if (renderer && roseGroup) {
      if (!state.dragging) state.targetRotationY += dt * (reduceMotion ? 0.015 : 0.045);
      state.rotationY = lerp(state.rotationY, state.targetRotationY, 1 - Math.pow(0.0008, dt));
      state.rotationX = lerp(state.rotationX, state.targetRotationX, 1 - Math.pow(0.0008, dt));
      roseGroup.rotation.y = state.rotationY;
      roseGroup.rotation.x = state.rotationX;
      roseMaterial.uniforms.uTime.value = time * 0.001;
      roseMaterial.uniforms.uProgress.value = state.progress;
      roseMaterial.uniforms.uPulse.value = state.pulse;
      if (burstPoints && burstMaterial) {
        burstPoints.visible = state.burstLife > 0;
        burstPoints.scale.setScalar(1 + (1 - state.burstLife) * 2.5);
        burstMaterial.opacity = state.burstLife * 0.85;
      }
      renderer.render(scene, camera);
    } else {
      renderFallback(time);
    }
  }

  function spawnHearts(x, y) {
    const count = mobileQuery.matches ? 8 : 13;
    for (let index = 0; index < count; index += 1) {
      const heart = document.createElement("span");
      heart.className = "float-heart";
      heart.textContent = "♥";
      heart.style.left = `${x + random(-16, 16)}px`;
      heart.style.top = `${y + random(-10, 10)}px`;
      heart.style.setProperty("--heart-dx", `${random(-72, 72)}px`);
      heart.style.setProperty("--heart-dy", `${random(-120, -62)}px`);
      heart.style.setProperty("--heart-rotate", `${random(-24, 24)}deg`);
      heart.style.color = index % 3 === 0 ? "#ffd29a" : index % 3 === 1 ? "#ff6d86" : "#ffb3bf";
      heartLayer.appendChild(heart);
      window.setTimeout(() => heart.remove(), 2050);
    }
  }

  function bloom(x = state.width * (mobileQuery.matches ? 0.58 : 0.69), y = state.height * 0.55) {
    state.progress = Math.min(state.progress, 0.76);
    state.progressVelocity = 1.05;
    state.pulse = 1;
    state.burstLife = 1;
    gestureHint.classList.add("is-hidden");
    if (x && y) {
      const rect = canvas.getBoundingClientRect();
      const clickX = x - rect.left;
      const clickY = y - rect.top;
      burstPoints?.position.set((clickX / state.width - 0.5) * 3, -(clickY / state.height - 0.5) * 2, 0);
    }
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function handlePointerDown(event) {
    event.preventDefault();
    const point = canvasPoint(event);
    state.pointerDown = true;
    state.dragging = false;
    state.lastPointer = point;
    canvas.setPointerCapture?.(event.pointerId);
    bloom(point.x, point.y);
    const now = performance.now();
    if (now - state.lastTap < 360) spawnHearts(point.x, point.y);
    state.lastTap = now;
    ensureMusic();
  }

  function handlePointerMove(event) {
    if (!state.pointerDown || !state.lastPointer) return;
    const point = canvasPoint(event);
    const dx = point.x - state.lastPointer.x;
    const dy = point.y - state.lastPointer.y;
    if (Math.hypot(dx, dy) > 2) {
      state.dragging = true;
      state.targetRotationY += dx * 0.008;
      state.targetRotationX = clamp(state.targetRotationX + dy * 0.005, -0.68, 0.62);
      state.lastPointer = point;
    }
  }

  function handlePointerUp(event) {
    state.pointerDown = false;
    state.dragging = false;
    canvas.releasePointerCapture?.(event.pointerId);
  }

  function updateMusicButton() {
    musicButton.setAttribute("aria-pressed", String(state.musicPlaying));
    musicLabel.textContent = state.musicPlaying ? "暂停音乐" : "播放音乐";
  }

  function createAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    const context = new AudioContext();
    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    const delay = context.createDelay(1.2);
    const feedback = context.createGain();
    master.gain.value = 0.045;
    compressor.threshold.value = -22;
    compressor.knee.value = 18;
    compressor.ratio.value = 5;
    delay.delayTime.value = 0.36;
    feedback.gain.value = 0.22;
    delay.connect(feedback).connect(delay);
    master.connect(compressor).connect(context.destination);
    master.connect(delay).connect(compressor);
    return { context, master, nextNote: 0, timer: null };
  }

  function playTone(frequency, start, duration, type = "sine", volume = 0.12) {
    if (!audio) return;
    const oscillator = audio.context.createOscillator();
    const gain = audio.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.045);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(audio.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  function scheduleMusic() {
    if (!audio || !state.musicPlaying) return;
    const chords = [
      [261.63, 329.63, 392.0, 493.88],
      [220.0, 261.63, 329.63, 392.0],
      [174.61, 220.0, 261.63, 349.23],
      [196.0, 246.94, 293.66, 392.0]
    ];
    const melody = [659.25, 587.33, 523.25, 493.88, 523.25, 587.33, 659.25, 783.99];
    const step = 0.62;
    while (audio.nextNote < audio.context.currentTime + 1.8) {
      const stepIndex = Math.floor(audio.nextNote / step) % melody.length;
      const chord = chords[Math.floor(audio.nextNote / (step * 2)) % chords.length];
      playTone(chord[stepIndex % chord.length], audio.nextNote, step * 1.7, "sine", 0.055);
      if (stepIndex % 2 === 0) playTone(melody[stepIndex], audio.nextNote + 0.04, step * 0.95, "triangle", 0.07);
      audio.nextNote += step;
    }
  }

  async function ensureMusic() {
    if (!audio) audio = createAudio();
    if (!audio) return;
    if (audio.context.state === "suspended") await audio.context.resume();
    if (!state.musicPlaying) {
      state.musicPlaying = true;
      audio.nextNote = audio.context.currentTime + 0.04;
      scheduleMusic();
      audio.timer = window.setInterval(scheduleMusic, 420);
      updateMusicButton();
    }
  }

  async function toggleMusic() {
    if (!audio) audio = createAudio();
    if (!audio) {
      musicLabel.textContent = "浏览器不支持";
      return;
    }
    if (state.musicPlaying) {
      state.musicPlaying = false;
      window.clearInterval(audio.timer);
      audio.timer = null;
      updateMusicButton();
      return;
    }
    await ensureMusic();
  }

  function frame(time) {
    const dt = Math.min(0.034, Math.max(0.001, (time - state.lastTime) / 1000));
    state.lastTime = time;
    state.frame += 1;
    updateMotion(dt, time);
    requestAnimationFrame(frame);
  }

  bloomButton.addEventListener("click", () => bloom());
  musicButton.addEventListener("click", toggleMusic);
  canvas.addEventListener("pointerdown", handlePointerDown, { passive: false });
  canvas.addEventListener("pointermove", handlePointerMove, { passive: true });
  canvas.addEventListener("pointerup", handlePointerUp, { passive: true });
  canvas.addEventListener("pointercancel", handlePointerUp, { passive: true });
  window.addEventListener("resize", () => {
    if (renderer) resizeThree();
    else resizeFallback();
  }, { passive: true });

  if (setupThree()) {
    gestureHint.textContent = "拖动玫瑰旋转 · 点击让它绽放";
  }
  requestAnimationFrame(frame);
})();
