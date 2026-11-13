// 3Dの世界。おへやとカフェを three.js で描く。
// 絵（相棒・お客さま・料理）は板に貼って、いつもカメラのほうを向かせる。
import * as THREE from './three.js';
import { onDrag } from './input.js';

const texCache = new Map();
function loadTexture(url) {
  if (texCache.has(url)) return texCache.get(url);
  const p = new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const max = 512, r = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * r));
      c.height = Math.max(1, Math.round(img.naturalHeight * r));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.userData.aspect = c.width / c.height;
      res(t);
    };
    img.onerror = rej;
    img.src = url;
  });
  texCache.set(url, p);
  if (texCache.size > 40) texCache.delete(texCache.keys().next().value);
  return p;
}

// 絵を貼る板。下端が足元になるように置く
class Card {
  constructor(height) {
    this.height = height;
    this.mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.05, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.group = new THREE.Group();
    this.group.add(this.mesh);
    this.url = null;
    this.group.visible = false;
  }
  async set(url) {
    if (!url) { this.group.visible = false; this.url = null; return; }
    if (url === this.url) return;
    this.url = url;
    const t = await loadTexture(url).catch(() => null);
    if (!t || this.url !== url) return;
    this.mat.map = t; this.mat.needsUpdate = true;
    const a = t.userData.aspect || 1;
    this.mesh.scale.set(this.height * a, this.height, 1);
    this.mesh.position.y = this.height / 2;
    this.group.visible = true;
  }
}

export class World {
  constructor(el, { onPet, onAnchor }) {
    this.el = el;
    this.onPet = onPet;
    this.onAnchor = onAnchor;
    this.yaw = 0;
    this.mode = 'room';
    this.clock = new THREE.Clock();
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      this.failed = true;
      el.classList.add('no-3d');
      return;
    }
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.scene.add(new THREE.HemisphereLight(0xfff8ee, 0xcbb89a, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(3, 6, 4);
    this.scene.add(sun);
    this.stage = new THREE.Group();
    this.scene.add(this.stage);

    this.pet = new Card(1.3);
    this.guest = new Card(1.2);
    this.dish = new Card(0.55);
    this.food = new Card(0.45);
    this.scene.add(this.pet.group, this.guest.group, this.dish.group, this.food.group);
    this.petPos = new THREE.Vector3(0, 0, 0.5);
    this.petTarget = this.petPos.clone();
    this.wait = 1;
    this.personality = { speed: 1, wait: [2, 4] };
    this.happyUntil = 0;

    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    let startX = 0, lastX = 0, overPet = false, strokes = 0, dir = 0, lastYaw = 0;
    onDrag(this.renderer.domElement, {
      start: e => {
        startX = lastX = e.clientX; strokes = 0; dir = 0; lastYaw = this.yaw;
        overPet = this.hitPet(e);
      },
      move: e => {
        const dx = e.clientX - lastX;
        if (overPet) {
          // なでる：左右にこする。向きが変わるたびに1回
          const d = Math.sign(dx);
          if (d && d !== dir && Math.abs(e.clientX - startX) > 12) { dir = d; strokes++; if (strokes % 2 === 0) this.onPet?.('stroke'); }
        } else {
          this.yaw = Math.max(-0.45, Math.min(0.45, lastYaw - (e.clientX - startX) * 0.004));
        }
        lastX = e.clientX;
      },
      end: e => {
        if (overPet && strokes < 2 && Math.abs(e.clientX - startX) < 10) this.onPet?.('tap');
      },
    });
    this.resize();
    new ResizeObserver(() => this.resize()).observe(el);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  hitPet(e) {
    if (!this.pet.group.visible) return false;
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    return this.ray.intersectObject(this.pet.mesh).length > 0;
  }

  resize() {
    if (this.failed) return;
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  clearStage() {
    for (const o of [...this.stage.children]) {
      this.stage.remove(o);
      o.traverse(m => { m.geometry?.dispose(); if (m.material && !m.material.map?.isCanvasTexture) m.material.dispose?.(); });
    }
  }

  box(w, h, d, color, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    m.position.set(x, y, z);
    this.stage.add(m);
    return m;
  }
  cyl(r, h, color, x, y, z) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    m.position.set(x, y, z);
    this.stage.add(m);
    return m;
  }

  // ---- おへや ----
  showRoom(house, posterUrl) {
    if (this.failed) return;
    this.mode = 'room';
    this.clearStage();
    const s = house.size, half = s / 2;
    this.bounds = half - 0.9;
    this.scene.background = new THREE.Color(house.wall);
    this.box(s, 0.1, s, house.floor, 0, -0.05, 0);
    this.box(s, 3.2, 0.1, house.wall, 0, 1.6, -half);
    this.box(0.1, 3.2, s, house.wall, -half, 1.6, 0);
    this.box(s, 0.25, 0.12, house.accent, 0, 0.12, -half + 0.08);
    this.box(1.8, 1.3, 0.06, '#dbe8ef', 1.1, 1.8, -half + 0.08);
    this.box(1.95, 0.08, 0.1, '#fbf6ec', 1.1, 1.13, -half + 0.1);
    this.cyl(0.6, 0.18, '#c8b4d6', -half + 1.3, 0.09, half - 1.6);
    this.box(1.1, 0.5, 0.7, house.accent, half - 1.2, 0.25, -half + 1.0);
    // ポスター
    const backing = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.15), new THREE.MeshBasicMaterial({ color: '#fbf6ec' }));
    backing.position.set(-1.1, 1.8, -half + 0.065);
    this.stage.add(backing);
    this.posterBacking = backing;
    this.posterMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.05), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true }));
    this.posterMesh.position.set(-1.1, 1.8, -half + 0.075);
    this.stage.add(this.posterMesh);
    this.setPoster(posterUrl);
    this.guest.set(null);
    this.dish.set(null);
    this.camBase = { pos: new THREE.Vector3(0, 2.6, s * 0.95), look: new THREE.Vector3(0, 0.8, -0.2) };
    this.petPos.set(0, 0, 0.3);
    this.petTarget.copy(this.petPos);
  }
  async setPoster(url) {
    if (!this.posterMesh) return;
    this.posterMesh.visible = this.posterBacking.visible = !!url;
    if (!url) return;
    const t = await loadTexture(url).catch(() => null);
    if (t) { this.posterMesh.material.map = t; this.posterMesh.material.color.set('#ffffff'); this.posterMesh.material.needsUpdate = true; }
  }

  // ---- カフェ ----
  // 店全体ではなく、いま対応しているお客さまの席と相棒だけを映す（4.4）
  showCafe(level) {
    if (this.failed) return;
    this.mode = 'cafe';
    this.clearStage();
    this.scene.background = new THREE.Color('#e6eadb');
    this.box(12, 0.1, 12, '#c9a77f', 0, -0.05, 0);
    this.box(12, 3.4, 0.1, '#e6eadb', 0, 1.7, -2.6);
    this.box(3.2, 1.0, 0.8, '#a9795a', -2.2, 0.5, -1.9);
    this.box(3.3, 0.08, 0.9, '#e8d6bb', -2.2, 1.04, -1.9);
    // テーブルは小さく低めに。お客さまはテーブルの横に立って全身が見えるようにする
    this.cyl(0.5, 0.05, '#f3ead9', 0.15, 0.55, -0.35);
    this.cyl(0.06, 0.53, '#5b4a3e', 0.15, 0.27, -0.35);
    if (level >= 1) this.box(1.4, 1.6, 0.2, '#b9cfae', 2.6, 0.8, -2.4);
    if (level >= 2) { this.cyl(0.9, 0.05, '#e1b7a8', 3.2, 2.6, -1.8); this.cyl(0.04, 2.6, '#5b4a3e', 3.2, 1.3, -1.8); }
    this.guest.group.position.set(1.15, 0, -0.55);
    this.dish.group.position.set(0.15, 0.57, -0.3);
    this.food.set(null);
    this.camBase = { pos: new THREE.Vector3(0.3, 2.0, 4.3), look: new THREE.Vector3(0.25, 0.75, -0.4) };
    this.petPos.set(-0.9, 0, 0.7);
    this.petTarget.copy(this.petPos);
  }
  // ---- コンビニ ----
  showShop() {
    if (this.failed) return;
    this.mode = 'shop';
    this.clearStage();
    this.scene.background = new THREE.Color('#eef1ea');
    this.box(12, 0.1, 12, '#d9d4c6', 0, -0.05, 0);
    this.box(12, 3.4, 0.1, '#f3f4ee', 0, 1.7, -2.6);
    this.box(12, 0.35, 0.12, '#7fae6a', 0, 3.0, -2.5);
    // 棚と商品
    const colors = ['#e2603f', '#f1c45a', '#5f8fc4', '#c48ab8', '#7fae6a', '#e9a985'];
    for (const x of [-2.6, -1.0]) {
      this.box(1.4, 2.0, 0.6, '#c9b79c', x, 1.0, -2.1);
      for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++)
        this.box(0.24, 0.3, 0.24, colors[(row * 4 + i + (x > -2 ? 2 : 0)) % colors.length], x - 0.48 + i * 0.32, 0.45 + row * 0.6, -1.95);
    }
    this.box(1.4, 0.75, 0.7, '#a7c4d6', 1.5, 0.375, -1.8);
    this.box(1.5, 0.08, 0.8, '#f3f4ee', 1.5, 0.79, -1.8);
    this.guest.group.position.set(0.75, 0, -1.0); // 店員さんはカウンターの手前に立つ
    this.dish.set(null); this.food.set(null);
    this.camBase = { pos: new THREE.Vector3(0, 2.2, 4.4), look: new THREE.Vector3(0, 0.9, -0.8) };
    this.petPos.set(-0.4, 0, 0.6);
    this.petTarget.copy(this.petPos);
  }
  setGuest(url) { return this.guest.set(url); }
  setDish(url, where) {
    this.dish.set(url);
    this.dishWhere = where; // 'pet' | 'table'
  }
  walkPetTo(x, z) { this.petTarget.set(x, 0, z); this.forcedWalk = true; }

  // ---- 相棒 ----
  setPet(url, personality) { this.pet.set(url); if (personality) this.personality = personality; }
  setFood(url) { this.food.set(url); this.foodUntil = this.clock.elapsedTime + 3; }
  happy() { this.happyUntil = this.clock.elapsedTime + 1.2; }
  hidePet(hidden) { this.pet.group.visible = !hidden && !!this.pet.url; }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta()), t = this.clock.elapsedTime;
    if (!this.camBase) return;
    // カメラ
    const base = this.camBase, off = base.pos.clone().sub(base.look), look = base.look.clone();
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const portrait = this.camera.aspect < 0.9;
    if (portrait) { off.multiplyScalar(this.mode === 'cafe' ? 1.95 : 1.25); if (this.mode === 'cafe') look.x -= 0.1;
      if (this.mode === 'shop') off.multiplyScalar(1.2); }
    this.camera.position.copy(look).add(off);
    this.camera.lookAt(look);

    // 相棒のうろうろ（性格で動き方が変わる）
    if (this.mode === 'room' && !this.forcedWalk) {
      this.wait -= dt;
      if (this.wait <= 0 && this.petPos.distanceTo(this.petTarget) < 0.05) {
        const b = this.bounds || 2, [a, c] = this.personality.wait;
        const near = this.personality.id === 'clingy' ? 0.45 : 1, narrow = portrait ? Math.min(1, 0.8 / b) : 1;
        this.petTarget.set((Math.random() * 2 - 1) * b * near * narrow, 0, (Math.random() * 2 - 1) * b * 0.7 * near + 0.4);
        this.wait = a + Math.random() * (c - a);
      }
    }
    const to = this.petTarget.clone().sub(this.petPos), dist = to.length();
    const moving = dist > 0.03;
    if (moving) this.petPos.add(to.multiplyScalar(Math.min(1, (dt * 1.2 * (this.personality.speed || 1)) / dist)));
    else this.forcedWalk = false;
    const hop = t < this.happyUntil ? Math.abs(Math.sin(t * 14)) * 0.25 : moving ? Math.abs(Math.sin(t * 9)) * 0.08 : Math.sin(t * 2) * 0.015;
    this.pet.group.position.set(this.petPos.x, hop, this.petPos.z);
    this.face(this.pet.group); this.face(this.guest.group); this.face(this.dish.group); this.face(this.food.group);
    this.pet.mesh.scale.y = this.pet.height * (1 + Math.sin(t * 2.4) * 0.015);

    if (this.food.group.visible) {
      this.food.group.position.set(this.petPos.x + 0.6, 0, this.petPos.z + 0.2);
      if (t > this.foodUntil) this.food.set(null);
    }
    if (this.dish.group.visible && this.dishWhere === 'pet') this.dish.group.position.set(this.petPos.x + 0.35, 1.05 + hop, this.petPos.z + 0.1);
    if (this.dish.group.visible && this.dishWhere === 'table') this.dish.group.position.set(0.15, 0.58, -0.3);

    this.renderer.render(this.scene, this.camera);

    // 吹き出しの位置
    if (this.onAnchor) {
      const head = (who) => {
        const g = who.group, v = new THREE.Vector3(g.position.x, g.position.y + who.height * 1.02, g.position.z).project(this.camera);
        return { x: (v.x + 1) / 2 * this.el.clientWidth, y: (1 - v.y) / 2 * this.el.clientHeight, visible: g.visible };
      };
      this.onAnchor({ pet: head(this.pet), guest: head(this.guest) });
    }
  }
  face(g) { g.rotation.y = Math.atan2(this.camera.position.x - g.position.x, this.camera.position.z - g.position.z); }
}
