import * as THREE from 'three';
import { eval3ptScalar, PARTICLE_GLOW, type SeasonId, type WeatherId } from './config';

const DOME_CENTER_Y = 1.22;
const DOME_INNER_RADIUS = 0.87;
const FLOOR_Y = 0.72;

interface ParticleState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  vrx: number;
  vry: number;
  vrz: number;
  scale: number;
  phase: number;
  baseSpeed: number;
  anchorX: number;
  anchorY: number;
  anchorZ: number;
}

function seededRand(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInsideDome(rand: () => number, minY = FLOOR_Y + 0.04, maxY = DOME_CENTER_Y + DOME_INNER_RADIUS - 0.06): [number, number, number] {
  for (let attempt = 0; attempt < 24; attempt++) {
    const x = (rand() * 2 - 1) * DOME_INNER_RADIUS;
    const y = minY + rand() * (maxY - minY);
    const z = (rand() * 2 - 1) * DOME_INNER_RADIUS;
    const dy = y - DOME_CENTER_Y;
    if (x * x + dy * dy + z * z <= DOME_INNER_RADIUS * DOME_INNER_RADIUS * 0.92) {
      return [x, y, z];
    }
  }
  return [0, DOME_CENTER_Y + 0.1, 0];
}

function createPetalGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.008);
  shape.bezierCurveTo(0.006, -0.005, 0.007, 0.004, 0.002, 0.008);
  shape.lineTo(0, 0.006);
  shape.lineTo(-0.002, 0.008);
  shape.bezierCurveTo(-0.007, 0.004, -0.006, -0.005, 0, -0.008);
  const geo = new THREE.ShapeGeometry(shape, 5);
  geo.computeVertexNormals();
  return geo;
}

function createMapleLeafGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.011);
  shape.lineTo(0.0025, -0.005);
  shape.lineTo(0.01, -0.004);
  shape.lineTo(0.006, 0.001);
  shape.lineTo(0.011, 0.006);
  shape.lineTo(0.0035, 0.006);
  shape.lineTo(0, 0.013);
  shape.lineTo(-0.0035, 0.006);
  shape.lineTo(-0.011, 0.006);
  shape.lineTo(-0.006, 0.001);
  shape.lineTo(-0.01, -0.004);
  shape.lineTo(-0.0025, -0.005);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape, 1);
  geo.computeVertexNormals();
  return geo;
}

function createSnowCrystalGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const points = 6;
  const outer = 0.014;
  const inner = 0.0048;
  for (let i = 0; i < points * 2; i++) {
    const a = (i * Math.PI) / points;
    const r = i % 2 === 0 ? outer : inner;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape, 1);
  geo.computeVertexNormals();
  return geo;
}

function linColor(r: number, g: number, b: number): THREE.Color {
  return new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
}

class ParticleBatch {
  mesh: THREE.InstancedMesh;
  states: ParticleState[] = [];
  activeCount: number;
  private maxCount: number;
  private mode: 'fall' | 'flutter' | 'firefly' | 'rain';
  private dummy = new THREE.Object3D();

  constructor(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    maxCount: number,
    activeCount: number,
    mode: 'fall' | 'flutter' | 'firefly' | 'rain',
    seed: number,
  ) {
    this.maxCount = maxCount;
    this.activeCount = activeCount;
    this.mode = mode;
    this.mesh = new THREE.InstancedMesh(geo, mat, maxCount);
    this.mesh.count = activeCount;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 14;

    const rand = seededRand(seed);
    for (let i = 0; i < maxCount; i++) {
      const [x, y, z] = randomInsideDome(rand);
      this.states.push({
        x,
        y,
        z,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: rand() * Math.PI * 2,
        ry: rand() * Math.PI * 2,
        rz: rand() * Math.PI * 2,
        vrx: (rand() - 0.5) * 2.2,
        vry: (rand() - 0.5) * 2.2,
        vrz: (rand() - 0.5) * 2.2,
        scale: 0.72 + rand() * 0.65,
        phase: rand() * Math.PI * 2,
        baseSpeed: mode === 'rain' ? 1.45 + rand() * 0.7 : 0.12 + rand() * 0.14,
        anchorX: x,
        anchorY: y,
        anchorZ: z,
      });
    }
    this.syncMatrices(0);
  }

  setVisibleCount(count: number): void {
    this.activeCount = Math.min(this.maxCount, Math.max(0, count));
    this.mesh.count = this.activeCount;
  }

  injectShake(rand: () => number): void {
    for (let i = 0; i < this.maxCount; i++) {
      const st = this.states[i];
      const angle = Math.atan2(st.z, st.x) + Math.PI * 0.5;
      const swirl = 1.4 + rand() * 1.3;
      st.vx += Math.cos(angle) * swirl + (rand() - 0.5) * 0.7;
      st.vz += Math.sin(angle) * swirl + (rand() - 0.5) * 0.7;
      st.vy += 0.85 + rand() * 1.1;
    }
  }

  update(dt: number, elapsed: number): void {
    const cdt = Math.min(dt, 0.05);
    const rLimit = DOME_INNER_RADIUS * 0.94;

    for (let i = 0; i < this.activeCount; i++) {
      const st = this.states[i];

      if (this.mode === 'firefly') {
        const targetX = st.anchorX + Math.sin(elapsed * 0.9 + st.phase) * 0.09;
        const targetY = st.anchorY + Math.sin(elapsed * 1.35 + st.phase * 1.7) * 0.07;
        const targetZ = st.anchorZ + Math.cos(elapsed * 0.85 + st.phase * 1.3) * 0.09;
        st.vx = st.vx * 0.94 + (targetX - st.x) * 2.2 * cdt;
        st.vy = st.vy * 0.94 + (targetY - st.y) * 2.2 * cdt;
        st.vz = st.vz * 0.94 + (targetZ - st.z) * 2.2 * cdt;
        st.x += st.vx * cdt * 12;
        st.y += st.vy * cdt * 12;
        st.z += st.vz * cdt * 12;
      } else {
        st.vx *= Math.pow(0.28, cdt);
        st.vz *= Math.pow(0.28, cdt);
        st.vy = st.vy * Math.pow(0.24, cdt) - st.baseSpeed * (1 - Math.pow(0.24, cdt));

        const swayAmp = this.mode === 'rain' ? 0.02 : this.mode === 'flutter' ? 0.22 : 0.1;
        const windX = Math.sin(elapsed * 1.4 + st.phase) * swayAmp;
        const windZ = Math.cos(elapsed * 1.1 + st.phase * 1.3) * swayAmp;

        st.x += (st.vx + windX) * cdt;
        st.y += st.vy * cdt;
        st.z += (st.vz + windZ) * cdt;

        if (this.mode === 'flutter' || this.mode === 'fall') {
          st.rx += st.vrx * cdt;
          st.ry += st.vry * cdt;
          st.rz += st.vrz * cdt;
        }
      }

      // Constrain inside glass sphere
      const dy = st.y - DOME_CENTER_Y;
      const distSq = st.x * st.x + dy * dy + st.z * st.z;
      if (distSq > rLimit * rLimit) {
        const dist = Math.sqrt(distSq);
        const nx = st.x / dist;
        const ny = dy / dist;
        const nz = st.z / dist;
        st.x = nx * rLimit;
        st.y = DOME_CENTER_Y + ny * rLimit;
        st.z = nz * rLimit;
        const dot = st.vx * nx + st.vy * ny + st.vz * nz;
        if (dot > 0) {
          st.vx -= 1.4 * dot * nx;
          st.vy -= 1.4 * dot * ny;
          st.vz -= 1.4 * dot * nz;
        }
      }

      // Wrap falling particles back up to the top inner cap of the dome
      if (this.mode !== 'firefly' && st.y < FLOOR_Y) {
        const rHoriz = Math.sqrt(st.x * st.x + st.z * st.z);
        const maxR = DOME_INNER_RADIUS * 0.78;
        if (rHoriz > maxR) {
          const s = maxR / rHoriz;
          st.x *= s;
          st.z *= s;
        }
        const capH = Math.sqrt(Math.max(0.04, DOME_INNER_RADIUS * DOME_INNER_RADIUS - (st.x * st.x + st.z * st.z)));
        st.y = DOME_CENTER_Y + capH * (0.65 + 0.3 * ((Math.sin(st.phase + elapsed) + 1) * 0.5));
        st.vy = -st.baseSpeed;
      }
    }

    this.syncMatrices(elapsed);
  }

  private syncMatrices(elapsed: number): void {
    const dummy = this.dummy;
    for (let i = 0; i < this.activeCount; i++) {
      const st = this.states[i];
      dummy.position.set(st.x, st.y, st.z);
      if (this.mode === 'rain') {
        dummy.rotation.set(0.08, 0, -0.08);
        dummy.scale.setScalar(st.scale);
      } else if (this.mode === 'firefly') {
        const pulse = 0.65 + 0.45 * Math.sin(elapsed * 3.1 + st.phase);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(st.scale * pulse);
      } else {
        dummy.rotation.set(st.rx, st.ry, st.rz);
        dummy.scale.setScalar(st.scale);
      }
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class GlobeParticleSystem {
  readonly group = new THREE.Group();

  private springGroup = new THREE.Group();
  private summerGroup = new THREE.Group();
  private autumnGroup = new THREE.Group();
  private winterGroup = new THREE.Group();
  private rainGroup = new THREE.Group();
  private smokeMesh: THREE.InstancedMesh;
  private smokeMat: THREE.MeshStandardMaterial;

  private springPinkMat: THREE.MeshStandardMaterial;
  private springWhiteMat: THREE.MeshStandardMaterial;
  private summerFireflyMat: THREE.MeshStandardMaterial;
  private summerMoteMat: THREE.MeshStandardMaterial;
  private autumnMats: THREE.MeshStandardMaterial[];
  private winterOrbMat: THREE.MeshStandardMaterial;
  private winterCrystalMat: THREE.MeshStandardMaterial;

  private winterOrbBatch: ParticleBatch;
  private winterCrystalBatch: ParticleBatch;
  private batches: ParticleBatch[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  private season: SeasonId = 'winter';
  private weather: WeatherId = 'CLEAR';
  private shakeRand = seededRand(20261122);
  private smokeDummy = new THREE.Object3D();

  constructor() {
    this.group.name = 'globe_particles_root';

    const orbGeo = new THREE.IcosahedronGeometry(0.0075, 1);
    const fireflyGeo = new THREE.IcosahedronGeometry(0.0095, 1);
    const petalGeo = createPetalGeometry();
    const mapleGeo = createMapleLeafGeometry();
    const crystalGeo = createSnowCrystalGeometry();
    const rainGeo = new THREE.CylinderGeometry(0.0022, 0.0018, 0.078, 5);
    const smokeGeo = new THREE.IcosahedronGeometry(0.028, 1);
    this.geometries.push(orbGeo, fireflyGeo, petalGeo, mapleGeo, crystalGeo, rainGeo, smokeGeo);

    // Spring sakura petals
    this.springPinkMat = new THREE.MeshStandardMaterial({
      color: linColor(0.98, 0.62, 0.76),
      emissive: linColor(1.0, 0.62, 0.76),
      emissiveIntensity: 0.1,
      roughness: 0.35,
      side: THREE.DoubleSide,
    });
    this.springWhiteMat = new THREE.MeshStandardMaterial({
      color: linColor(1.0, 0.85, 0.91),
      emissive: linColor(1.0, 0.82, 0.89),
      emissiveIntensity: 0.05,
      roughness: 0.45,
      side: THREE.DoubleSide,
    });
    const springPink = new ParticleBatch(petalGeo, this.springPinkMat, 90, 90, 'flutter', 101);
    const springWhite = new ParticleBatch(petalGeo, this.springWhiteMat, 45, 45, 'flutter', 102);
    this.springGroup.add(springPink.mesh, springWhite.mesh);

    // Summer fireflies & motes
    this.summerFireflyMat = new THREE.MeshStandardMaterial({
      color: linColor(0.95, 1.0, 0.35),
      emissive: linColor(0.85, 1.0, 0.25),
      emissiveIntensity: 4.5,
      roughness: 0.2,
    });
    this.summerMoteMat = new THREE.MeshStandardMaterial({
      color: linColor(0.78, 1.0, 0.55),
      emissive: linColor(0.75, 1.0, 0.5),
      emissiveIntensity: 1.5,
      roughness: 0.4,
    });
    const summerFlies = new ParticleBatch(fireflyGeo, this.summerFireflyMat, 90, 90, 'firefly', 201);
    const summerMotes = new ParticleBatch(orbGeo, this.summerMoteMat, 50, 50, 'firefly', 202);
    this.summerGroup.add(summerFlies.mesh, summerMotes.mesh);

    // Autumn maple leaves
    const autRed = new THREE.MeshStandardMaterial({
      color: linColor(0.72, 0.07, 0.03),
      emissive: linColor(0.55, 0.05, 0.02),
      emissiveIntensity: 0.08,
      roughness: 0.52,
      side: THREE.DoubleSide,
    });
    const autOrg = new THREE.MeshStandardMaterial({
      color: linColor(0.88, 0.25, 0.03),
      emissive: linColor(0.72, 0.18, 0.02),
      emissiveIntensity: 0.08,
      roughness: 0.52,
      side: THREE.DoubleSide,
    });
    const autGold = new THREE.MeshStandardMaterial({
      color: linColor(0.94, 0.56, 0.05),
      emissive: linColor(0.82, 0.45, 0.04),
      emissiveIntensity: 0.08,
      roughness: 0.52,
      side: THREE.DoubleSide,
    });
    this.autumnMats = [autRed, autOrg, autGold];
    const autB1 = new ParticleBatch(mapleGeo, autRed, 40, 40, 'flutter', 301);
    const autB2 = new ParticleBatch(mapleGeo, autOrg, 40, 40, 'flutter', 302);
    const autB3 = new ParticleBatch(mapleGeo, autGold, 40, 40, 'flutter', 303);
    this.autumnGroup.add(autB1.mesh, autB2.mesh, autB3.mesh);

    // Winter snow orbs & 6-point crystal flakes (expand on PRECIP)
    this.winterOrbMat = new THREE.MeshStandardMaterial({
      color: linColor(0.96, 0.99, 1.0),
      emissive: linColor(0.85, 0.94, 1.0),
      emissiveIntensity: 0.18,
      roughness: 0.25,
    });
    this.winterCrystalMat = new THREE.MeshStandardMaterial({
      color: linColor(0.95, 0.99, 1.0),
      emissive: linColor(0.88, 0.96, 1.0),
      emissiveIntensity: 0.24,
      roughness: 0.14,
      side: THREE.DoubleSide,
    });
    this.winterOrbBatch = new ParticleBatch(orbGeo, this.winterOrbMat, 380, 190, 'fall', 401);
    this.winterCrystalBatch = new ParticleBatch(crystalGeo, this.winterCrystalMat, 220, 110, 'flutter', 402);
    this.winterGroup.add(this.winterOrbBatch.mesh, this.winterCrystalBatch.mesh);

    // Rain streaks (Spring / Summer / Autumn PRECIP)
    const rainMat = new THREE.MeshStandardMaterial({
      color: linColor(0.78, 0.9, 1.0),
      emissive: linColor(0.72, 0.86, 1.0),
      emissiveIntensity: 0.45,
      roughness: 0.08,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    const rainBatch = new ParticleBatch(rainGeo, rainMat, 160, 160, 'rain', 501);
    this.rainGroup.add(rainBatch.mesh);

    // Chimney smoke (Autumn & Winter)
    this.smokeMat = new THREE.MeshStandardMaterial({
      color: linColor(0.92, 0.94, 0.99),
      roughness: 0.95,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    });
    this.smokeMesh = new THREE.InstancedMesh(smokeGeo, this.smokeMat, 10);
    this.smokeMesh.frustumCulled = false;
    this.smokeMesh.renderOrder = 13;

    this.batches.push(
      springPink,
      springWhite,
      summerFlies,
      summerMotes,
      autB1,
      autB2,
      autB3,
      this.winterOrbBatch,
      this.winterCrystalBatch,
      rainBatch,
    );

    this.materials.push(
      this.springPinkMat,
      this.springWhiteMat,
      this.summerFireflyMat,
      this.summerMoteMat,
      ...this.autumnMats,
      this.winterOrbMat,
      this.winterCrystalMat,
      rainMat,
      this.smokeMat,
    );

    this.group.add(
      this.springGroup,
      this.summerGroup,
      this.autumnGroup,
      this.winterGroup,
      this.rainGroup,
      this.smokeMesh,
    );

    this.syncVisibility();
    this.updateSmoke(0);
  }

  setSeason(season: SeasonId): void {
    this.season = season;
    this.syncVisibility();
  }

  setWeather(weather: WeatherId): void {
    this.weather = weather;
    this.syncVisibility();
  }

  setTimeOfDay(t: number): void {
    const g = PARTICLE_GLOW[this.season];
    const pGlow = eval3ptScalar(g.primary[0], g.primary[1], g.primary[2], t);
    const sGlow = eval3ptScalar(g.secondary[0], g.secondary[1], g.secondary[2], t);

    if (this.season === 'spring') {
      this.springPinkMat.emissiveIntensity = pGlow;
      this.springWhiteMat.emissiveIntensity = sGlow;
    } else if (this.season === 'summer') {
      this.summerFireflyMat.emissiveIntensity = pGlow * 0.45;
      this.summerMoteMat.emissiveIntensity = sGlow * 0.45;
    } else if (this.season === 'autumn') {
      for (const m of this.autumnMats) m.emissiveIntensity = pGlow;
    } else {
      this.winterOrbMat.emissiveIntensity = pGlow;
      this.winterCrystalMat.emissiveIntensity = sGlow;
    }
  }

  triggerShake(): void {
    for (const batch of this.batches) {
      batch.injectShake(this.shakeRand);
    }
  }

  private syncVisibility(): void {
    this.springGroup.visible = this.season === 'spring';
    this.summerGroup.visible = this.season === 'summer';
    this.autumnGroup.visible = this.season === 'autumn';
    this.winterGroup.visible = this.season === 'winter';
    this.rainGroup.visible = this.season !== 'winter' && this.weather === 'PRECIP';
    this.smokeMesh.visible = this.season === 'autumn' || this.season === 'winter';

    const blizzard = this.season === 'winter' && this.weather === 'PRECIP';
    this.winterOrbBatch.setVisibleCount(blizzard ? 380 : 190);
    this.winterCrystalBatch.setVisibleCount(blizzard ? 220 : 110);
  }

  private updateSmoke(elapsed: number): void {
    if (!this.smokeMesh.visible) return;
    // Chimney base from Blender (-0.129, 1.164, -0.130 in Y-up) drifting slightly right/back
    const count = 10;
    for (let i = 0; i < count; i++) {
      const life = ((elapsed * 0.24 + i / count) % 1 + 1) % 1;
      const x = -0.129 + life * 0.072 + Math.sin(elapsed * 1.6 + i) * 0.012 * life;
      const y = 1.158 + life * 0.31;
      const z = -0.13 - life * 0.045 + Math.cos(elapsed * 1.3 + i) * 0.01 * life;
      const envelope = Math.sin(life * Math.PI);
      const sc = (0.48 + life * 0.95) * Math.max(0.05, envelope);
      this.smokeDummy.position.set(x, y, z);
      this.smokeDummy.scale.setScalar(sc);
      this.smokeDummy.updateMatrix();
      this.smokeMesh.setMatrixAt(i, this.smokeDummy.matrix);
    }
    this.smokeMesh.instanceMatrix.needsUpdate = true;
  }

  update(dt: number, elapsed: number): void {
    for (const batch of this.batches) {
      if (batch.mesh.parent?.visible) {
        batch.update(dt, elapsed);
      }
    }
    this.updateSmoke(elapsed);
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
