import * as THREE from 'three';

export interface MaterialRegistry {
  warmWindows: THREE.MeshStandardMaterial[];
  sunMat: THREE.MeshBasicMaterial | null;
  sunHaloMat: THREE.ShaderMaterial | null;
  moonMat: THREE.MeshStandardMaterial | null;
  starsMat: THREE.MeshBasicMaterial | null;
  cloudMat: THREE.MeshStandardMaterial | null;
  waterMat: THREE.MeshPhysicalMaterial | null;
  timeUniform: { value: number };
}

const NOISE_GLSL = /* glsl */ `
float sg_hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float sg_noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(sg_hash(i + vec3(0.0, 0.0, 0.0)), sg_hash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(sg_hash(i + vec3(0.0, 1.0, 0.0)), sg_hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(sg_hash(i + vec3(0.0, 0.0, 1.0)), sg_hash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(sg_hash(i + vec3(0.0, 1.0, 1.0)), sg_hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z
  );
}

float sg_fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * sg_noise(p);
    p = p * 2.03 + vec3(7.1, 13.7, 3.9);
    a *= 0.5;
  }
  return v;
}

float sg_voronoi(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  float md = 8.0;
  for (int k = -1; k <= 1; k++) {
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec3 g = vec3(float(i), float(j), float(k));
        vec3 o = vec3(
          sg_hash(p + g),
          sg_hash(p + g + vec3(17.3, 5.1, 9.7)),
          sg_hash(p + g + vec3(31.7, 19.3, 3.1))
        );
        vec3 r = g + o - f;
        float d = dot(r, r);
        md = min(md, d);
      }
    }
  }
  return sqrt(md);
}
`;

function linColor(r: number, g: number, b: number): THREE.Color {
  return new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
}

function injectObjectPos(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vSgObjPos;\nvarying vec3 vSgLocalNormal;',
    )
    .replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvSgObjPos = position;\nvSgLocalNormal = normal;',
    );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    `#include <common>\nvarying vec3 vSgObjPos;\nvarying vec3 vSgLocalNormal;\n${NOISE_GLSL}`,
  );
}

interface RampNoiseSpec {
  scale: number;
  lowStop: number;
  highStop: number;
  c0: readonly [number, number, number];
  c1: readonly [number, number, number];
  roughness: number;
}

const NOISE_RAMP_SPECS: Record<string, RampNoiseSpec> = {
  材质_春草地: { scale: 22, lowStop: 0.28, highStop: 0.75, c0: [0.085, 0.275, 0.052], c1: [0.205, 0.455, 0.095], roughness: 0.78 },
  材质_春树叶: { scale: 30, lowStop: 0.28, highStop: 0.75, c0: [0.095, 0.32, 0.068], c1: [0.23, 0.52, 0.115], roughness: 0.62 },
  材质_樱花浅粉: { scale: 30, lowStop: 0.28, highStop: 0.75, c0: [0.95, 0.58, 0.72], c1: [1.0, 0.82, 0.89], roughness: 0.48 },
  材质_樱花深粉: { scale: 28, lowStop: 0.28, highStop: 0.75, c0: [0.84, 0.3, 0.46], c1: [0.98, 0.54, 0.68], roughness: 0.52 },
  材质_夏草地: { scale: 24, lowStop: 0.28, highStop: 0.75, c0: [0.032, 0.165, 0.048], c1: [0.095, 0.32, 0.085], roughness: 0.76 },
  材质_夏树叶亮: { scale: 30, lowStop: 0.28, highStop: 0.75, c0: [0.06, 0.25, 0.055], c1: [0.145, 0.42, 0.095], roughness: 0.58 },
  材质_夏树叶深: { scale: 28, lowStop: 0.28, highStop: 0.75, c0: [0.022, 0.135, 0.035], c1: [0.068, 0.265, 0.068], roughness: 0.6 },
  材质_秋草地: { scale: 20, lowStop: 0.28, highStop: 0.75, c0: [0.22, 0.125, 0.032], c1: [0.44, 0.255, 0.058], roughness: 0.8 },
  材质_秋叶红: { scale: 26, lowStop: 0.28, highStop: 0.75, c0: [0.42, 0.032, 0.015], c1: [0.78, 0.085, 0.035], roughness: 0.58 },
  材质_秋叶橙: { scale: 26, lowStop: 0.28, highStop: 0.75, c0: [0.64, 0.145, 0.02], c1: [0.94, 0.31, 0.04], roughness: 0.56 },
  材质_秋叶黄: { scale: 26, lowStop: 0.28, highStop: 0.75, c0: [0.68, 0.36, 0.025], c1: [0.96, 0.64, 0.06], roughness: 0.56 },
  材质_松针: { scale: 35, lowStop: 0.28, highStop: 0.75, c0: [0.022, 0.095, 0.045], c1: [0.055, 0.185, 0.08], roughness: 0.68 },
};

const SIMPLE_SOLID_SPECS: Record<
  string,
  { color: readonly [number, number, number]; roughness: number; metalness?: number }
> = {
  材质_底座毛毡: { color: [0.04, 0.035, 0.035], roughness: 0.92 },
  材质_深色木梁: { color: [0.16, 0.08, 0.038], roughness: 0.65 },
  材质_暖红屋瓦: { color: [0.58, 0.18, 0.09], roughness: 0.62 },
  材质_黑煤与铁艺: { color: [0.03, 0.03, 0.035], roughness: 0.28, metalness: 0.35 },
  材质_野花黄: { color: [0.98, 0.78, 0.12], roughness: 0.5 },
  材质_长椅木: { color: [0.36, 0.19, 0.08], roughness: 0.52 },
  材质_白兔毛: { color: [0.95, 0.93, 0.9], roughness: 0.82 },
  材质_兔耳粉: { color: [0.96, 0.52, 0.6], roughness: 0.65 },
  材质_向日葵黄: { color: [0.98, 0.72, 0.04], roughness: 0.48 },
  材质_荷叶: { color: [0.075, 0.28, 0.085], roughness: 0.48 },
  材质_荷花粉: { color: [0.96, 0.56, 0.72], roughness: 0.42 },
  材质_南瓜橙: { color: [0.88, 0.24, 0.025], roughness: 0.38 },
  材质_南瓜金: { color: [0.92, 0.48, 0.05], roughness: 0.4 },
  材质_木桶木: { color: [0.32, 0.16, 0.07], roughness: 0.64 },
  材质_胡萝卜: { color: [0.95, 0.34, 0.03], roughness: 0.48 },
  材质_红围巾: { color: [0.76, 0.06, 0.07], roughness: 0.74 },
};

function makeNoiseRampMaterial(name: string, spec: RampNoiseSpec): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    name,
    color: linColor(1, 1, 1),
    roughness: spec.roughness,
    metalness: 0.0,
  });
  const c0 = `vec3(${spec.c0[0].toFixed(4)}, ${spec.c0[1].toFixed(4)}, ${spec.c0[2].toFixed(4)})`;
  const c1 = `vec3(${spec.c1[0].toFixed(4)}, ${spec.c1[1].toFixed(4)}, ${spec.c1[2].toFixed(4)})`;
  mat.customProgramCacheKey = () => `sg-noise-ramp-${name}`;
  mat.onBeforeCompile = (shader) => {
    injectObjectPos(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      vec3 bPos = vec3(vSgObjPos.x, -vSgObjPos.z, vSgObjPos.y);
      float nFac = sg_fbm(bPos * ${spec.scale.toFixed(2)});
      float tRamp = smoothstep(${spec.lowStop.toFixed(3)}, ${spec.highStop.toFixed(3)}, nFac);
      diffuseColor.rgb *= mix(${c0}, ${c1}, tRamp);
      `,
    );
  };
  return mat;
}

function makeWalnutMaterial(name: string): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    name,
    color: linColor(1, 1, 1),
    roughness: 0.24,
    metalness: 0.0,
    clearcoat: 0.72,
    clearcoatRoughness: 0.08,
  });
  mat.customProgramCacheKey = () => 'sg-walnut-base';
  mat.onBeforeCompile = (shader) => {
    injectObjectPos(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      vec3 bPos = vec3(vSgObjPos.x, -vSgObjPos.z, vSgObjPos.y);
      vec3 mapped = bPos * vec3(2.0, 2.0, 10.0);
      float dist = length(mapped.xy) * 4.2 + sg_fbm(mapped * 2.2) * 2.75;
      float wave = 0.5 + 0.5 * sin(dist * 6.2831853);
      float tWood = smoothstep(0.25, 0.80, wave);
      diffuseColor.rgb *= mix(vec3(0.042, 0.016, 0.007), vec3(0.145, 0.055, 0.022), tWood);
      `,
    );
  };
  return mat;
}

function makeCabinWallMaterial(name: string): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    name,
    color: linColor(1, 1, 1),
    roughness: 0.62,
    metalness: 0.0,
  });
  mat.customProgramCacheKey = () => 'sg-cabin-wall';
  mat.onBeforeCompile = (shader) => {
    injectObjectPos(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      vec3 bPos = vec3(vSgObjPos.x, -vSgObjPos.z, vSgObjPos.y);
      vec3 mapped = bPos * vec3(1.5, 1.5, 18.0);
      float band = mapped.z * 3.0 + sg_fbm(mapped * 1.4) * 1.1;
      float wave = 0.5 + 0.5 * sin(band * 6.2831853);
      float tWall = smoothstep(0.15, 0.80, wave);
      diffuseColor.rgb *= mix(vec3(0.20, 0.095, 0.042), vec3(0.42, 0.22, 0.10), tWall);
      `,
    );
  };
  return mat;
}

function makeBrassMaterial(name: string): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    name,
    color: linColor(0.86, 0.67, 0.28),
    metalness: 0.94,
    roughness: 0.23,
  });
  mat.customProgramCacheKey = () => 'sg-brass';
  mat.onBeforeCompile = (shader) => {
    injectObjectPos(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
      vec3 bPos = vec3(vSgObjPos.x, -vSgObjPos.z, vSgObjPos.y);
      float bNoise = sg_fbm(bPos * 45.0);
      roughnessFactor = mix(0.17, 0.28, bNoise);
      `,
    );
  };
  return mat;
}

function makeStoneMaterial(name: string): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    name,
    color: linColor(1, 1, 1),
    roughness: 0.8,
    metalness: 0.0,
  });
  mat.customProgramCacheKey = () => 'sg-stone';
  mat.onBeforeCompile = (shader) => {
    injectObjectPos(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      vec3 bPos = vec3(vSgObjPos.x, -vSgObjPos.z, vSgObjPos.y);
      float vDist = sg_voronoi(bPos * 28.0);
      float tStone = smoothstep(0.05, 0.35, vDist);
      diffuseColor.rgb *= mix(vec3(0.14, 0.14, 0.15), vec3(0.34, 0.33, 0.35), tStone);
      `,
    );
  };
  return mat;
}

function makeSnowMaterial(name: string): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    name,
    color: linColor(0.94, 0.97, 1.0),
    roughness: 0.45,
    metalness: 0.0,
  });
  mat.customProgramCacheKey = () => 'sg-snow';
  mat.onBeforeCompile = (shader) => {
    injectObjectPos(shader);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
      vec3 bPos = vec3(vSgObjPos.x, -vSgObjPos.z, vSgObjPos.y);
      float sparkle = sg_voronoi(bPos * 140.0);
      roughnessFactor = mix(0.08, 0.58, smoothstep(0.0, 0.24, sparkle));
      `,
    );
  };
  return mat;
}

function makePondWaterMaterial(name: string, timeUniform: { value: number }): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    name,
    color: linColor(0.14, 0.76, 0.84),
    roughness: 0.04,
    metalness: 0.0,
    clearcoat: 0.85,
    clearcoatRoughness: 0.03,
    emissive: linColor(0.08, 0.55, 0.68),
    emissiveIntensity: 0.18,
  });
  mat.customProgramCacheKey = () => 'sg-pond-water';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    injectObjectPos(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 bPos = vec3(vSgObjPos.x, -vSgObjPos.z, vSgObjPos.y);
        float r = length(bPos.xy - vec2(0.32, -0.18));
        float ripple = 0.5 + 0.5 * sin(r * 54.0 - uTime * 2.2);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.26, 0.88, 0.94), ripple * 0.18);
        `,
      );
  };
  return mat;
}

/**
 * EEVEE-style Fresnel glass shell.
 * Deliberately avoids Three.js `transmission > 0` so transparent sky elements
 * (clouds, sun halo, stars, rain, smoke) remain crisp inside the globe.
 */
function makeGlassDomeMaterial(name: string): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    name,
    color: linColor(0.96, 0.99, 1.0),
    roughness: 0.02,
    metalness: 0.0,
    ior: 1.48,
    clearcoat: 1.0,
    clearcoatRoughness: 0.015,
    reflectivity: 0.95,
    envMapIntensity: 1.75,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  mat.customProgramCacheKey = () => 'sg-glass-dome-fresnel';
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `
      float ndv = clamp(abs(dot(normalize(vNormal), normalize(vViewPosition))), 0.0, 1.0);
      float facing = 1.0 - ndv;
      float glassAlpha = mix(0.022, 0.075, smoothstep(0.0, 0.62, facing));
      glassAlpha = mix(glassAlpha, 0.38, smoothstep(0.62, 1.0, facing));
      // Add crisp cool glass specular reflection without dimming interior colors
      outgoingLight += vec3(0.86, 0.94, 1.0) * pow(facing, 4.0) * 0.24;
      diffuseColor.a = glassAlpha;
      #include <opaque_fragment>
      `,
    );
  };
  return mat;
}

function makeSunHaloMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: '材质_太阳光晕_动态',
    uniforms: {
      uColor: { value: linColor(1.0, 0.96, 0.76) },
      uIntensity: { value: 0.75 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNorm;
      varying vec3 vViewPos;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNorm = normalize(normalMatrix * normal);
        vViewPos = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec3 vNorm;
      varying vec3 vViewPos;
      void main() {
        float ndv = clamp(dot(normalize(vNorm), normalize(vViewPos)), 0.0, 1.0);
        float halo = pow(ndv, 2.2) * 0.42;
        gl_FragColor = vec4(uColor * uIntensity * 1.4, halo * clamp(uIntensity, 0.0, 1.0));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export function applyProceduralMaterials(root: THREE.Object3D): MaterialRegistry {
  const timeUniform = { value: 0 };
  const cache = new Map<string, THREE.Material>();
  const registry: MaterialRegistry = {
    warmWindows: [],
    sunMat: null,
    sunHaloMat: null,
    moonMat: null,
    starsMat: null,
    cloudMat: null,
    waterMat: null,
    timeUniform,
  };

  const getOrCreate = (orig: THREE.Material, meshName: string): THREE.Material => {
    const mname = orig.name || meshName;
    const hit = cache.get(mname);
    if (hit) return hit;

    let next: THREE.Material;
    if (mname === '材质_玻璃球' || meshName === 'shared_glass_dome') {
      next = makeGlassDomeMaterial(mname);
    } else if (mname === '材质_胡桃木底座') {
      next = makeWalnutMaterial(mname);
    } else if (mname === '材质_木屋墙面') {
      next = makeCabinWallMaterial(mname);
    } else if (mname === '材质_黄铜') {
      next = makeBrassMaterial(mname);
    } else if (mname === '材质_石材') {
      next = makeStoneMaterial(mname);
    } else if (mname === '材质_雪地') {
      next = makeSnowMaterial(mname);
    } else if (mname === '材质_池水') {
      const wm = makePondWaterMaterial(mname, timeUniform);
      registry.waterMat = wm;
      next = wm;
    } else if (mname in NOISE_RAMP_SPECS) {
      next = makeNoiseRampMaterial(mname, NOISE_RAMP_SPECS[mname]);
    } else if (mname in SIMPLE_SOLID_SPECS) {
      const s = SIMPLE_SOLID_SPECS[mname];
      next = new THREE.MeshStandardMaterial({
        name: mname,
        color: linColor(s.color[0], s.color[1], s.color[2]),
        roughness: s.roughness,
        metalness: s.metalness ?? 0.0,
      });
    } else if (mname.startsWith('材质_暖光玻璃')) {
      const wg = new THREE.MeshStandardMaterial({
        name: mname,
        color: linColor(1.0, 0.72, 0.34),
        emissive: linColor(1.0, 0.72, 0.3),
        emissiveIntensity: 1.5,
        roughness: 0.18,
      });
      registry.warmWindows.push(wg);
      next = wg;
    } else if (mname.startsWith('材质_太阳光晕') || meshName === 'sky_sun_halo') {
      const shm = makeSunHaloMaterial();
      registry.sunHaloMat = shm;
      next = shm;
    } else if (mname.startsWith('材质_太阳') || meshName === 'sky_sun') {
      const sm = new THREE.MeshBasicMaterial({
        name: mname,
        color: linColor(1.0, 0.96, 0.76),
      });
      registry.sunMat = sm;
      next = sm;
    } else if (mname.startsWith('材质_月亮') || meshName === 'sky_moon') {
      const mm = new THREE.MeshStandardMaterial({
        name: mname,
        color: linColor(0.86, 0.94, 1.0),
        emissive: linColor(0.86, 0.94, 1.0),
        emissiveIntensity: 1.8,
        roughness: 0.4,
      });
      registry.moonMat = mm;
      next = mm;
    } else if (mname.startsWith('材质_繁星') || meshName === 'sky_stars') {
      const stm = new THREE.MeshBasicMaterial({
        name: mname,
        color: linColor(0.94, 0.97, 1.0),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      registry.starsMat = stm;
      next = stm;
    } else if (mname.startsWith('材质_云朵') || meshName.startsWith('sky_clouds')) {
      const cm = new THREE.MeshStandardMaterial({
        name: mname,
        color: linColor(0.98, 0.99, 1.0),
        emissive: linColor(1.0, 0.98, 0.96),
        emissiveIntensity: 0.08,
        roughness: 0.88,
        transparent: true,
        opacity: 0.92,
      });
      registry.cloudMat = cm;
      next = cm;
    } else {
      next = orig;
    }

    cache.set(mname, next);
    return next;
  };

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const isGlass = obj.name === 'shared_glass_dome';
    const isSky = obj.name.startsWith('sky_');

    obj.castShadow = !isGlass && !isSky && obj.name !== 'shared_felt';
    obj.receiveShadow = !isGlass && !isSky;

    if (isGlass) {
      obj.renderOrder = 20;
    } else if (obj.name === 'sky_sun_halo') {
      obj.renderOrder = 9;
    } else if (obj.name.startsWith('sky_clouds')) {
      obj.renderOrder = 8;
    } else if (obj.name === 'sky_stars') {
      obj.renderOrder = 5;
    }

    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map((m) => getOrCreate(m, obj.name));
    } else if (obj.material) {
      obj.material = getOrCreate(obj.material, obj.name);
    }
  });

  return registry;
}
