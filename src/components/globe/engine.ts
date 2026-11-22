import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  BACKDROP_FLOOR,
  clamp01,
  eval3ptRgb,
  eval3ptScalar,
  lerp,
  MOON_COLORS,
  NIGHT_LIGHTS,
  smoothstep,
  WEATHER_MUL,
  WORLD_SKY,
  type SeasonId,
  type WeatherId,
} from './config';
import { applyProceduralMaterials, type MaterialRegistry } from './materials';
import { GlobeParticleSystem } from './particles';

export interface GlobeEngineCallbacks {
  onLoaded: () => void;
  onError: (message: string) => void;
  onTimeSync?: (t: number) => void;
}

export interface GlobeEngineHandle {
  setSeason: (season: SeasonId) => void;
  setTime: (t: number) => void;
  setWeather: (weather: WeatherId) => void;
  setPlaying: (playing: boolean) => void;
  setCycleEnabled: (enabled: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  triggerShake: () => void;
  resetView: () => void;
  resize: () => void;
  dispose: () => void;
}

const DEFAULT_CAM_POS = new THREE.Vector3(0.32, 1.72, 4.65);
const DEFAULT_CAM_TARGET = new THREE.Vector3(0.0, 1.07, 0.0);

function setLin(target: THREE.Color, rgb: readonly [number, number, number], mul = 1.0): void {
  target.setRGB(rgb[0] * mul, rgb[1] * mul, rgb[2] * mul, THREE.LinearSRGBColorSpace);
}

function createSkyDome(): {
  mesh: THREE.Mesh;
  uniforms: { uLow: { value: THREE.Color }; uHigh: { value: THREE.Color } };
} {
  const uniforms = {
    uLow: { value: new THREE.Color().setRGB(0.02, 0.03, 0.07, THREE.LinearSRGBColorSpace) },
    uHigh: { value: new THREE.Color().setRGB(0.05, 0.1, 0.22, THREE.LinearSRGBColorSpace) },
  };
  const geo = new THREE.SphereGeometry(28, 32, 24);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uLow;
      uniform vec3 uHigh;
      varying vec3 vWorldDir;
      void main() {
        float h = clamp(vWorldDir.y * 0.65 + 0.38, 0.0, 1.0);
        vec3 col = mix(uLow, uHigh, smoothstep(0.0, 1.0, h));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -10;
  return { mesh, uniforms };
}

function createStudioFloor(): {
  mesh: THREE.Mesh;
  uniforms: { uCenterColor: { value: THREE.Color }; uEdgeColor: { value: THREE.Color } };
} {
  const uniforms = {
    uCenterColor: { value: new THREE.Color().setRGB(0.06, 0.08, 0.12, THREE.LinearSRGBColorSpace) },
    uEdgeColor: { value: new THREE.Color().setRGB(0.02, 0.03, 0.06, THREE.LinearSRGBColorSpace) },
  };
  const geo = new THREE.CircleGeometry(4.8, 72);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.48,
    metalness: 0.04,
    transparent: true,
    depthWrite: true,
  });
  mat.customProgramCacheKey = () => 'sg-studio-floor';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCenterColor = uniforms.uCenterColor;
    shader.uniforms.uEdgeColor = uniforms.uEdgeColor;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFloorXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFloorXZ = position.xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uCenterColor;\nuniform vec3 uEdgeColor;\nvarying vec2 vFloorXZ;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float r = length(vFloorXZ);
        float grad = smoothstep(0.0, 3.2, r);
        diffuseColor.rgb = mix(uCenterColor, uEdgeColor, grad);
        float ao = mix(0.32, 1.0, smoothstep(0.75, 1.28, r));
        diffuseColor.rgb *= ao;
        diffuseColor.a = 1.0 - smoothstep(2.2, 4.6, r);
        `,
      );
  };

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -0.002;
  mesh.receiveShadow = true;
  mesh.renderOrder = -2;
  return { mesh, uniforms };
}

export function mountSnowGlobe(
  container: HTMLElement,
  initial: { season: SeasonId; time: number; weather: WeatherId; playing: boolean; reducedMotion: boolean },
  callbacks: GlobeEngineCallbacks,
): GlobeEngineHandle {
  let disposed = false;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
  } catch {
    callbacks.onError('当前浏览器环境未启用 WebGL，无法渲染 3D 玻璃球。');
    return {
      setSeason: () => {},
      setTime: () => {},
      setWeather: () => {},
      setPlaying: () => {},
      setCycleEnabled: () => {},
      setReducedMotion: () => {},
      triggerShake: () => {},
      resetView: () => {},
      resize: () => {},
      dispose: () => {},
    };
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  const envTarget = pmrem.fromScene(envScene, 0.04);
  envScene.dispose();
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.72;

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  camera.position.copy(DEFAULT_CAM_POS);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(DEFAULT_CAM_TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.enablePan = false;
  controls.minDistance = 2.25;
  controls.maxDistance = 6.6;
  controls.minPolarAngle = 0.22;
  controls.maxPolarAngle = Math.PI * 0.51;
  controls.update();

  // Backdrop dome & reflective studio floor
  const skyDome = createSkyDome();
  const studioFloor = createStudioFloor();
  scene.add(skyDome.mesh, studioFloor.mesh);

  // Lighting rig matching Blender's 5 studio lights + 2 practical interior lights
  const hemiLight = new THREE.HemisphereLight(0xdce8ff, 0x262930, 0.75);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff5e0, 2.2);
  keyLight.position.set(-2.35, 4.35, -0.45);
  keyLight.target.position.copy(DEFAULT_CAM_TARGET);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 12;
  keyLight.shadow.camera.left = -1.6;
  keyLight.shadow.camera.right = 1.6;
  keyLight.shadow.camera.top = 1.8;
  keyLight.shadow.camera.bottom = -1.4;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.015;
  scene.add(keyLight, keyLight.target);

  const rimLight = new THREE.DirectionalLight(0xd1edff, 1.35);
  rimLight.position.set(2.35, 3.05, -2.25);
  rimLight.target.position.copy(DEFAULT_CAM_TARGET);
  scene.add(rimLight, rimLight.target);

  const frontFill = new THREE.DirectionalLight(0xf5faff, 1.0);
  frontFill.position.set(-1.4, 2.4, 3.2);
  frontFill.target.position.copy(DEFAULT_CAM_TARGET);
  scene.add(frontFill, frontFill.target);

  const warmFill = new THREE.DirectionalLight(0xffedd1, 0.65);
  warmFill.position.set(2.4, 1.25, 2.5);
  warmFill.target.position.copy(DEFAULT_CAM_TARGET);
  scene.add(warmFill, warmFill.target);

  const cabinLight = new THREE.PointLight(0xffaa48, 0.0, 1.35, 1.6);
  cabinLight.position.set(-0.18, 0.83, 0.1);
  const lampLight = new THREE.PointLight(0xffb554, 0.0, 1.45, 1.6);
  lampLight.position.set(0.06, 0.988, 0.27);

  // Root group for the physical snow globe (wobbles cleanly on shake)
  const globeRoot = new THREE.Group();
  globeRoot.name = 'snow_globe_root';
  scene.add(globeRoot);
  globeRoot.add(cabinLight, lampLight);

  const particles = new GlobeParticleSystem();
  globeRoot.add(particles.group);

  let seasonGroups: Partial<Record<SeasonId, THREE.Object3D>> = {};
  let skyNodes: {
    sun?: THREE.Object3D;
    sunHalo?: THREE.Object3D;
    moon?: THREE.Object3D;
    stars?: THREE.Object3D;
    cloudsMain?: THREE.Object3D;
    cloudsThick?: THREE.Object3D;
  } = {};
  let matRegistry: MaterialRegistry | null = null;
  let gltfSceneRoot: THREE.Object3D | null = null;

  let curSeason: SeasonId = initial.season;
  let curTime = clamp01(initial.time);
  let curWeather: WeatherId = initial.weather;
  let isPlaying = initial.playing;
  let cycleEnabled = false;
  let reducedMotion = initial.reducedMotion;

  let shakeEnergy = 0;
  let resettingView = false;
  let resetProgress = 0;
  const resetStartPos = new THREE.Vector3();
  const resetStartTarget = new THREE.Vector3();

  function syncCameraDistanceForAspect(width: number, height: number): void {
    const aspect = Math.max(0.45, width / Math.max(1, height));
    camera.aspect = aspect;
    // Widen effective vertical FOV smoothly on narrow portrait frames so the globe & base aren't clipped horizontally
    camera.fov = aspect < 0.96 ? Math.min(44, 34 / Math.max(0.76, aspect)) : 34;
    camera.updateProjectionMatrix();
  }

  function resize(): void {
    if (disposed) return;
    const rect = container.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    renderer.setSize(w, h, false);
    syncCameraDistanceForAspect(w, h);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  function applyEnvironment(): void {
    const t = curTime;
    const w = curWeather;
    const s = curSeason;
    const wm = WEATHER_MUL[w];

    // 1. Season visibility
    (['spring', 'summer', 'autumn', 'winter'] as SeasonId[]).forEach((sid) => {
      const grp = seasonGroups[sid];
      if (grp) grp.visible = sid === s;
    });

    // 2. Sky dome gradient & ambient IBL
    const wSpec = WORLD_SKY[s];
    const wLow = eval3ptRgb(wSpec.day.low, wSpec.dusk.low, wSpec.night.low, t);
    const wHigh = eval3ptRgb(wSpec.day.high, wSpec.dusk.high, wSpec.night.high, t);
    const wStrength = eval3ptScalar(wSpec.day.strength, wSpec.dusk.strength, wSpec.night.strength, t) * wm.sky;

    setLin(skyDome.uniforms.uLow.value, wLow, wm.sky);
    setLin(skyDome.uniforms.uHigh.value, wHigh, wm.sky);
    scene.environmentIntensity = clamp01(wStrength * 0.55) + 0.18;
    hemiLight.intensity = 0.25 + wStrength * 0.42;
    setLin(hemiLight.color, wHigh, 1.0);
    setLin(hemiLight.groundColor, wLow, 0.7);

    // 3. Studio floor gradient
    const fSpec = BACKDROP_FLOOR[s];
    const f0 = eval3ptRgb(fSpec.day[0], fSpec.dusk[0], fSpec.night[0], t);
    const f1 = eval3ptRgb(fSpec.day[1], fSpec.dusk[1], fSpec.night[1], t);
    setLin(studioFloor.uniforms.uCenterColor.value, f0, wm.sky);
    setLin(studioFloor.uniforms.uEdgeColor.value, f1, wm.sky);

    // 4. Studio lights (Blender Z-up -> Three Y-up: (x, z, -y))
    const nl = NIGHT_LIGHTS[s];
    const keyPosX = eval3ptScalar(-2.35, -3.75, -3.3, t);
    const keyPosY_B = eval3ptScalar(0.45, 1.15, 0.9, t);
    const keyPosZ_B = eval3ptScalar(4.35, 1.55, 3.1, t);
    keyLight.position.set(keyPosX, keyPosZ_B, -keyPosY_B);
    setLin(keyLight.color, eval3ptRgb([1.0, 0.96, 0.88], [1.0, 0.52, 0.2], nl.keyColor, t));
    keyLight.intensity = (eval3ptScalar(290, 240, nl.keyEnergy, t) / 115) * wm.key;

    const rimPosX = eval3ptScalar(2.35, 2.75, 2.5, t);
    const rimPosY_B = eval3ptScalar(2.25, 1.95, 2.1, t);
    const rimPosZ_B = eval3ptScalar(3.05, 1.65, 2.4, t);
    rimLight.position.set(rimPosX, rimPosZ_B, -rimPosY_B);
    setLin(rimLight.color, eval3ptRgb([0.82, 0.93, 1.0], [1.0, 0.56, 0.3], nl.rimColor, t));
    rimLight.intensity = (eval3ptScalar(150, 200, nl.rimEnergy, t) / 110) * (w === 'PRECIP' ? 0.85 : 1.0);

    setLin(frontFill.color, eval3ptRgb([0.96, 0.98, 1.0], [1.0, 0.78, 0.56], nl.frontColor, t));
    frontFill.intensity = (eval3ptScalar(180, 88, nl.frontEnergy, t) / 155) * (w === 'PRECIP' ? 0.88 : 1.0);

    setLin(warmFill.color, eval3ptRgb([1.0, 0.93, 0.82], [1.0, 0.72, 0.42], [1.0, 0.82, 0.6], t));
    warmFill.intensity = eval3ptScalar(88, 68, 55, t) / 120;

    // 5. Practical cabin & streetlamp warm glow
    const pracBoost = w === 'PRECIP' && t > 0.35 ? 1.25 : 1.0;
    cabinLight.intensity = eval3ptScalar(0.0, 1.35, 1.8, t) * 0.9 * pracBoost;
    lampLight.intensity = eval3ptScalar(0.0, 1.6, 2.2, t) * 0.9 * pracBoost;

    if (matRegistry) {
      const wgCol = eval3ptRgb([0.68, 0.8, 0.9], [1.0, 0.72, 0.34], [1.0, 0.72, 0.3], t);
      const wgEm = eval3ptScalar(0.15, 2.4, 4.2, t);
      for (const wg of matRegistry.warmWindows) {
        setLin(wg.color, wgCol);
        setLin(wg.emissive, wgCol);
        wg.emissiveIntensity = wgEm;
      }

      // 6. Sun (upper-left arc at Blender y=0.32 -> Three z=-0.32)
      const sunNorm = Math.min(1.0, t / 0.72);
      const sunTheta = lerp((104 * Math.PI) / 180, (172 * Math.PI) / 180, sunNorm);
      const sunVis = 1.0 - smoothstep(0.54, 0.72, t);
      const sunDuskBoost = 1.0 + 0.12 * smoothstep(0.2, 0.5, t) * (1.0 - smoothstep(0.52, 0.7, t));
      const sunSc = sunVis * sunDuskBoost * wm.sunScale;
      const sunCol = eval3ptRgb([1.0, 0.96, 0.76], [1.0, 0.42, 0.1], [1.0, 0.24, 0.05], sunNorm);
      const sunEmFactor = (eval3ptScalar(12, 14, 0, t) / 12) * sunVis * wm.sunEm;

      if (skyNodes.sun) {
        skyNodes.sun.visible = sunVis > 0.02;
        skyNodes.sun.position.set(0.64 * Math.cos(sunTheta), 1.22 + 0.64 * Math.sin(sunTheta), -0.32);
        skyNodes.sun.scale.setScalar(Math.max(0.001, sunSc));
      }
      if (matRegistry.sunMat) {
        setLin(matRegistry.sunMat.color, sunCol, 0.9 + sunEmFactor * 0.75);
      }
      if (matRegistry.sunHaloMat) {
        setLin(matRegistry.sunHaloMat.uniforms.uColor.value, sunCol);
        matRegistry.sunHaloMat.uniforms.uIntensity.value = sunEmFactor;
      }

      // 7. Crescent Moon (upper-right arc)
      const moonT = clamp01((t - 0.36) / 0.64);
      const moonTheta = lerp((22 * Math.PI) / 180, (62 * Math.PI) / 180, moonT);
      const moonVis = smoothstep(0.36, 0.62, t);
      const moonSc = moonVis * wm.moonScale;
      const mCol = MOON_COLORS[s];

      if (skyNodes.moon) {
        skyNodes.moon.visible = moonVis > 0.02;
        skyNodes.moon.position.set(0.64 * Math.cos(moonTheta), 1.22 + 0.64 * Math.sin(moonTheta), -0.32);
        skyNodes.moon.scale.setScalar(Math.max(0.001, moonSc));
      }
      if (matRegistry.moonMat) {
        setLin(matRegistry.moonMat.color, mCol);
        setLin(matRegistry.moonMat.emissive, mCol);
        matRegistry.moonMat.emissiveIntensity = 2.6 * moonVis * wm.moonEm;
      }

      // 8. Stars
      const starVis = smoothstep(0.55, 0.85, t) * wm.starVis;
      if (skyNodes.stars) {
        skyNodes.stars.visible = starVis > 0.02;
      }
      if (matRegistry.starsMat) {
        matRegistry.starsMat.opacity = starVis;
      }

      // 9. Clouds
      if (skyNodes.cloudsMain) {
        skyNodes.cloudsMain.scale.setScalar(wm.cloudMainScale);
      }
      if (skyNodes.cloudsThick) {
        skyNodes.cloudsThick.visible = w !== 'CLEAR';
        skyNodes.cloudsThick.scale.setScalar(wm.cloudThickScale);
      }
      if (matRegistry.cloudMat) {
        const cDay: readonly [number, number, number] = s === 'spring' ? [1.0, 0.96, 0.98] : [0.98, 0.99, 1.0];
        const cDusk: readonly [number, number, number] = [1.0, 0.65, 0.5];
        const cNight: readonly [number, number, number] = s === 'autumn' ? [0.26, 0.18, 0.2] : [0.18, 0.25, 0.4];
        const cBase = eval3ptRgb(cDay, cDusk, cNight, t);
        const cEmCol = eval3ptRgb([1.0, 0.98, 0.96], [1.0, 0.48, 0.26], [0.35, 0.48, 0.75], t);
        const cEmStr = eval3ptScalar(0.08, 0.42, 0.14, t) * wm.cloudEmMul;
        setLin(matRegistry.cloudMat.color, cBase, wm.cloudColorMul);
        setLin(matRegistry.cloudMat.emissive, cEmCol);
        matRegistry.cloudMat.emissiveIntensity = cEmStr;
        matRegistry.cloudMat.opacity = wm.cloudAlpha;
      }
    }

    particles.setSeason(s);
    particles.setWeather(w);
    particles.setTimeOfDay(t);
  }

  // Load deduplicated 4-season GLB
  const loader = new GLTFLoader();
  loader.load(
    '/models/four-seasons-globe.glb',
    (gltf) => {
      if (disposed) return;
      gltfSceneRoot = gltf.scene;
      matRegistry = applyProceduralMaterials(gltf.scene);

      seasonGroups = {
        spring: gltf.scene.getObjectByName('season_spring'),
        summer: gltf.scene.getObjectByName('season_summer'),
        autumn: gltf.scene.getObjectByName('season_autumn'),
        winter: gltf.scene.getObjectByName('season_winter'),
      };
      skyNodes = {
        sun: gltf.scene.getObjectByName('sky_sun'),
        sunHalo: gltf.scene.getObjectByName('sky_sun_halo'),
        moon: gltf.scene.getObjectByName('sky_moon'),
        stars: gltf.scene.getObjectByName('sky_stars'),
        cloudsMain: gltf.scene.getObjectByName('sky_clouds_main'),
        cloudsThick: gltf.scene.getObjectByName('sky_clouds_thick'),
      };

      globeRoot.add(gltf.scene);
      applyEnvironment();
      callbacks.onLoaded();
    },
    undefined,
    (err) => {
      if (disposed) return;
      console.error('Failed to load snow globe GLB:', err);
      callbacks.onError('3D 模型加载失败，请刷新页面重试。');
    },
  );

  // Animation loop
  let rafId = 0;
  let lastNow = performance.now();
  let simTime = 0;

  function tick(now: number): void {
    if (disposed) return;
    rafId = window.requestAnimationFrame(tick);

    const rawDt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
    lastNow = now;

    if (isPlaying) {
      simTime += rawDt;
      if (matRegistry) matRegistry.timeUniform.value = simTime;
      particles.update(rawDt, simTime);

      // Gentle ambient cloud drift
      if (skyNodes.cloudsMain) {
        skyNodes.cloudsMain.position.x = Math.sin(simTime * 0.25) * 0.035;
      }
      if (skyNodes.cloudsThick) {
        skyNodes.cloudsThick.position.x = Math.cos(simTime * 0.2) * 0.028;
      }

      // Continuous day-night cycle if enabled
      if (cycleEnabled) {
        curTime = (curTime + rawDt / 24) % 1.0;
        applyEnvironment();
        callbacks.onTimeSync?.(curTime);
      }
    }

    // Damped globe wobble from shake
    if (shakeEnergy > 0.001) {
      const freq = 22;
      const damp = Math.exp(-3.6 * rawDt);
      globeRoot.rotation.z = Math.sin(simTime * freq) * 0.065 * shakeEnergy;
      globeRoot.rotation.x = Math.cos(simTime * freq * 0.85) * 0.035 * shakeEnergy;
      shakeEnergy *= damp;
      if (shakeEnergy <= 0.002) {
        shakeEnergy = 0;
        globeRoot.rotation.set(0, 0, 0);
      }
    }

    // Smooth camera reset
    if (resettingView) {
      if (reducedMotion) {
        camera.position.copy(DEFAULT_CAM_POS);
        controls.target.copy(DEFAULT_CAM_TARGET);
        resettingView = false;
      } else {
        resetProgress = Math.min(1, resetProgress + rawDt * 2.8);
        const ease = 1 - Math.pow(1 - resetProgress, 3);
        camera.position.lerpVectors(resetStartPos, DEFAULT_CAM_POS, ease);
        controls.target.lerpVectors(resetStartTarget, DEFAULT_CAM_TARGET, ease);
        if (resetProgress >= 1) resettingView = false;
      }
    }

    controls.update();
    renderer.render(scene, camera);
  }

  rafId = window.requestAnimationFrame(tick);

  return {
    setSeason(season) {
      curSeason = season;
      applyEnvironment();
    },
    setTime(t) {
      curTime = clamp01(t);
      applyEnvironment();
    },
    setWeather(weather) {
      curWeather = weather;
      applyEnvironment();
    },
    setPlaying(playing) {
      isPlaying = playing;
    },
    setCycleEnabled(enabled) {
      cycleEnabled = enabled;
    },
    setReducedMotion(reduced) {
      reducedMotion = reduced;
      if (reduced) {
        shakeEnergy = 0;
        globeRoot.rotation.set(0, 0, 0);
      }
    },
    triggerShake() {
      particles.triggerShake();
      if (!reducedMotion) {
        shakeEnergy = 1.0;
      }
    },
    resetView() {
      resetStartPos.copy(camera.position);
      resetStartTarget.copy(controls.target);
      resetProgress = 0;
      resettingView = true;
    },
    resize,
    dispose() {
      if (disposed) return;
      disposed = true;
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.dispose();
      particles.dispose();

      skyDome.mesh.geometry.dispose();
      (skyDome.mesh.material as THREE.Material).dispose();
      studioFloor.mesh.geometry.dispose();
      (studioFloor.mesh.material as THREE.Material).dispose();

      if (gltfSceneRoot) {
        gltfSceneRoot.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const m of mats) m?.dispose();
          }
        });
      }

      envTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
