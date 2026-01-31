// Style imported in HTML now
import * as THREE from 'three';

/**
 * Teleporty! One
 * Retro 2D Edition - Directional Guide & Simplified Progression
 */

// --- CONFIGURATION ---
const BASE_GRAVITY = 50.0;
const MOVE_SPEED = 10.0;
const JUMP_SPEED = 20.0;
const FRICTION = 8.0;
const TELEPORT_RANGE = 12.0; // Restored range
const JUMP_PAD_FORCE = 30.0;
const BORDER_THICKNESS = 0.15;

// --- STATE ---
const state = {
  currentLevel: 1,
  orbs: 0,
  teleportCharges: 0,
  isFrozen: false,
  canTeleport: false,
  teleportBlocked: false, // New blockage state
  teleportTarget: new THREE.Vector3(),
  mouse: new THREE.Vector2(),
  lastTime: performance.now(),
  gameOver: false,
  tutorialStep: 0,
  gravityMultiplier: 1.0,
};

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const viewSize = 25;
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
  -viewSize * aspect / 2, viewSize * aspect / 2,
  viewSize / 2, -viewSize / 2,
  1, 1000
);
camera.position.set(0, 0, 50);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const gameUI = document.getElementById('game-ui');
const freezeOverlay = document.getElementById('freeze-overlay');
const cursorReticle = document.getElementById('reticle');
cursorReticle.style.display = 'none';

// --- PLAYER ---
const playerGroup = new THREE.Group();
scene.add(playerGroup);

const pBorderGeo = new THREE.PlaneGeometry(1 + BORDER_THICKNESS * 2, 1 + BORDER_THICKNESS * 2);
const pBorderMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const pBorder = new THREE.Mesh(pBorderGeo, pBorderMat);
pBorder.position.z = -0.01;
playerGroup.add(pBorder);

const pInnerGeo = new THREE.PlaneGeometry(1, 1);
const pInnerMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
const pInner = new THREE.Mesh(pInnerGeo, pInnerMat);
pInner.position.z = 0;
playerGroup.add(pInner);

// Guide Arrow
const guideArrow = new THREE.Group();
guideArrow.position.set(0, 1.2, 0);
playerGroup.add(guideArrow);
const gaHeadGeo = new THREE.CircleGeometry(0.3, 3);
const gaMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
const gaHead = new THREE.Mesh(gaHeadGeo, gaMat);
gaHead.position.y = 0.2;
guideArrow.add(gaHead);
const gaTailGeo = new THREE.PlaneGeometry(0.15, 0.4);
const gaTail = new THREE.Mesh(gaTailGeo, gaMat);
gaTail.position.y = -0.1;
guideArrow.add(gaTail);

playerGroup.userData = {
  velocity: new THREE.Vector3(),
  onGround: false,
  platform: null,
  isPlayer: true
};

// --- VISUALS ---
const rangeGeo = new THREE.RingGeometry(TELEPORT_RANGE - 0.1, TELEPORT_RANGE, 64);
const rangeMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, opacity: 0.3, transparent: true });
const rangeRing = new THREE.Mesh(rangeGeo, rangeMat);
scene.add(rangeRing);
rangeRing.visible = false;

// Teleport Marker
const markerGeo = new THREE.RingGeometry(0.5, 0.7, 4);
const markerMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
const teleportMarker = new THREE.Group();
const markerRing = new THREE.Mesh(markerGeo, markerMat);
markerRing.rotation.z = Math.PI / 4;
teleportMarker.add(markerRing);

// Blocked X
const xGeo = new THREE.PlaneGeometry(0.8, 0.15);
const xMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const x1 = new THREE.Mesh(xGeo, xMat); x1.rotation.z = Math.PI / 4;
const x2 = new THREE.Mesh(xGeo, xMat); x2.rotation.z = -Math.PI / 4;
const blockedMarker = new THREE.Group();
blockedMarker.add(x1);
blockedMarker.add(x2);
blockedMarker.visible = false;
teleportMarker.add(blockedMarker);

scene.add(teleportMarker);
teleportMarker.visible = false;

// Aim Line
const aimLineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)]);
const aimLineMat = new THREE.LineBasicMaterial({ color: 0x00ffff });
const aimLine = new THREE.Line(aimLineGeo, aimLineMat);
scene.add(aimLine);
aimLine.visible = false;


// --- INPUTS ---
const keys = { left: false, right: false, jump: false, down: false };

document.addEventListener('keydown', (event) => {
  if (state.gameOver) {
    if (event.code === 'KeyR') loadLevel(state.currentLevel);
    return;
  }

  if (state.currentLevel === 1 && state.tutorialStep === 0) {
    if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(event.code)) {
      updateTutorial(1);
    }
  }

  if (event.code === 'KeyT') {
    if (state.orbs > 0 || state.teleportCharges > 0) {
      if (state.teleportCharges > 0) {
        state.isFrozen = !state.isFrozen;
        if (state.isFrozen) {
          freezeOverlay.classList.add('freeze-active');
          rangeRing.visible = true;
          rangeRing.position.copy(playerGroup.position);
          aimLine.visible = true;
          if (state.currentLevel === 1 && state.tutorialStep === 3) updateTutorial(4);
        } else {
          freezeOverlay.classList.remove('freeze-active');
          teleportMarker.visible = false;
          rangeRing.visible = false;
          aimLine.visible = false;
        }
      }
    }
    return;
  }

  switch (event.code) {
    case 'KeyW':
    case 'ArrowUp':
    case 'Space':
      if (!keys.jump && !state.isFrozen) {
        if (playerGroup.userData.onGround) {
          playerGroup.userData.velocity.y = JUMP_SPEED * state.gravityMultiplier;
          playerGroup.userData.onGround = false;
          playerGroup.userData.platform = null;
          if (state.currentLevel === 1 && state.tutorialStep === 1) updateTutorial(2);
        }
      }
      keys.jump = true;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      keys.left = true;
      break;
    case 'KeyD':
    case 'ArrowRight':
      keys.right = true;
      break;
    case 'KeyR':
    case 'KeyL':
      loadLevel(state.currentLevel);
      break;
  }
});

document.addEventListener('keyup', (event) => {
  switch (event.code) {
    case 'KeyW':
    case 'ArrowUp':
    case 'Space':
      keys.jump = false;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      keys.left = false;
      break;
    case 'KeyD':
    case 'ArrowRight':
      keys.right = false;
      break;
  }
});

document.addEventListener('mousemove', (event) => {
  state.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  state.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

document.addEventListener('mousedown', (event) => {
  if (state.isFrozen && state.canTeleport && !state.teleportBlocked && event.button === 0) {
    teleportPlayer(state.teleportTarget);
    state.teleportCharges--;
    updateHUD();
    state.isFrozen = false;
    freezeOverlay.classList.remove('freeze-active');
    teleportMarker.visible = false;
    rangeRing.visible = false;
    aimLine.visible = false;
    if (state.currentLevel === 1 && state.tutorialStep === 4) updateTutorial(5);
  }
});
document.addEventListener('contextmenu', event => event.preventDefault());

function checkLaserBlock(start, end) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const dist = direction.length();
  direction.normalize();
  const ray = new THREE.Ray(start, direction);
  const target = new THREE.Vector3();

  for (const l of lasers) {
    if (l.isHollow) continue; // Allow shooting through hollow lasers
    const box = new THREE.Box3().setFromObject(l.mesh);
    box.min.z = -1; box.max.z = 1;
    if (ray.intersectBox(box, target)) {
      if (target.distanceTo(start) < dist) {
        return true;
      }
    }
  }
  return false;
}

function teleportPlayer(targetPos) {
  playerGroup.position.copy(targetPos);
  playerGroup.userData.velocity.set(0, 0, 0);
  playerGroup.userData.platform = null;

  const pBox = new THREE.Box3().setFromCenterAndSize(playerGroup.position, new THREE.Vector3(0.8, 0.8, 1));
  for (const plat of platforms) {
    if (pBox.intersectsBox(plat.userData.aabb)) {
      if (state.gravityMultiplier > 0) {
        playerGroup.position.y = plat.userData.aabb.max.y + 0.6;
      } else {
        playerGroup.position.y = plat.userData.aabb.min.y - 0.6;
      }
      break;
    }
  }
}

function updateTutorial(step) {
  state.tutorialStep = step;
  const msg = document.getElementById('tutorial-message');
  if (!msg) return;
  switch (step) {
    case 0: msg.innerText = "Use ARROW KEYS or WASD to Move."; break;
    case 1: msg.innerText = "Great! Press SPACE or UP to Jump."; break;
    case 2: msg.innerText = "Collect the Yellow Orb above."; break;
    case 3: msg.innerText = "Orb Collected! Press 'T' to Aim Teleport."; break;
    case 4: msg.innerText = "Mouse over the platform and CLICK to Warp."; break;
    case 5: msg.innerText = "Teleport Successful! Follow the Arrow."; break;
  }
}

// --- OBJECT LISTS ---
let platforms = [];
let movingPlatforms = [];
let jumpPads = [];
let orbs = [];
let enemies = [];
let lasers = [];
let flags = [];
let crates = [];
let buttons = [];
let gates = [];
let inverters = [];
let shooters = [];
let fireballs = [];
let exitZone = null;

function clearLevel() {
  [...platforms, ...jumpPads, ...orbs, ...lasers, ...enemies, ...flags, ...crates, ...buttons, ...gates, ...inverters, ...shooters, ...fireballs]
    .forEach(obj => {
      if (obj.mesh) scene.remove(obj.mesh);
      else scene.remove(obj);
    });

  platforms = []; movingPlatforms = []; jumpPads = []; orbs = []; lasers = [];
  enemies = []; flags = []; crates = []; buttons = []; gates = [];
  inverters = []; shooters = []; fireballs = [];
  exitZone = null;

  playerGroup.userData.velocity.set(0, 0, 0);
  playerGroup.userData.onGround = false;
  playerGroup.userData.platform = null;
  state.gameOver = false;
  state.orbs = 0;
  state.teleportCharges = 0;
  state.tutorialStep = 0;
  state.gravityMultiplier = 1.0;
  playerGroup.scale.y = 1;
  state.isFrozen = false;
  freezeOverlay.classList.remove('freeze-active');
  rangeRing.visible = false;
  aimLine.visible = false;
  teleportMarker.visible = false;

  updateHUD();
}

// --- CREATION HELPERS ---
function createBorderedRect(w, h, color, z = 0) {
  const group = new THREE.Group();
  const bGeo = new THREE.PlaneGeometry(w + BORDER_THICKNESS * 2, h + BORDER_THICKNESS * 2);
  const bMat = new THREE.MeshBasicMaterial({ color: color });
  const bMesh = new THREE.Mesh(bGeo, bMat);
  bMesh.position.z = -0.01;
  group.add(bMesh);
  const iGeo = new THREE.PlaneGeometry(w, h);
  const iMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const iMesh = new THREE.Mesh(iGeo, iMat);
  group.add(iMesh);
  group.position.z = z;
  return group;
}

function createPlatform(x, y, w, h, color) {
  const mesh = createBorderedRect(w, h, color);
  mesh.position.set(x, y, 0);
  scene.add(mesh);
  const bbox = new THREE.Box3();
  bbox.setFromCenterAndSize(new THREE.Vector3(x, y, 0), new THREE.Vector3(w, h, 1));
  mesh.userData = { isPlatform: true, aabb: bbox, originalColor: color };
  platforms.push(mesh);
  return mesh;
}

function createFragilePlatform(x, y, w, h) {
  const p = createPlatform(x, y, w, h, 0xff5555); // Reddish
  p.userData.isFragile = true;
  p.userData.decay = 0;
}

function createMovingPlatform(x, y, w, h, color, axis, range, speed, offset = 0) {
  const mesh = createPlatform(x, y, w, h, color);
  movingPlatforms.push({
    mesh: mesh,
    startPos: new THREE.Vector3(x, y, 0),
    axis: axis,
    range: range,
    speed: speed,
    offset: offset
  });
}

function createJumpPad(x, y, size) {
  const w = size, h = 0.5;
  const mesh = createBorderedRect(w, h, 0x00ff00);
  mesh.position.set(x, y, 0);
  scene.add(mesh);
  const bbox = new THREE.Box3();
  bbox.setFromCenterAndSize(new THREE.Vector3(x, y, 0), new THREE.Vector3(w, h, 1));
  mesh.userData = { isJumpPad: true, aabb: bbox };
  jumpPads.push(mesh);
}

function createOrb(id, x, y) {
  const group = new THREE.Group();
  const bGeo = new THREE.CircleGeometry(0.5, 8);
  const bMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  const bMesh = new THREE.Mesh(bGeo, bMat);
  bMesh.position.z = -0.01;
  group.add(bMesh);
  const iGeo = new THREE.CircleGeometry(0.35, 8);
  const iMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const iMesh = new THREE.Mesh(iGeo, iMat);
  group.add(iMesh);
  group.position.set(x, y, 0);
  scene.add(group);
  group.userData = { id: id, isOrb: true };
  orbs.push(group);
}

function createLaser(x, y, height, axis, range, speed, offset, isHollow = false) {
  const w = 0.3;
  const h = height;

  const group = new THREE.Group();

  // Border/Glow
  const bGeo = new THREE.PlaneGeometry(w + BORDER_THICKNESS * 2, h + BORDER_THICKNESS * 2);
  const bMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const bMesh = new THREE.Mesh(bGeo, bMat);
  bMesh.position.z = -0.01;
  group.add(bMesh);

  // Inner Core
  const iGeo = new THREE.PlaneGeometry(w, h);
  // Filled Red if solid, Black if hollow
  const iMat = new THREE.MeshBasicMaterial({ color: isHollow ? 0x000000 : 0xff4444 });
  const iMesh = new THREE.Mesh(iGeo, iMat);
  group.add(iMesh);

  group.position.set(x, y, 0);
  scene.add(group);
  lasers.push({
    mesh: group,
    startPos: new THREE.Vector3(x, y, 0),
    axis: axis,
    range: range,
    speed: speed,
    offset: offset || 0,
    isHollow: isHollow
  });
}

function createEnemy(x, y, range, speed, offset = 0) {
  const size = 0.8;
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(size, size);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.z = Math.PI / 4;
  group.add(mesh);
  group.position.set(x, y, 0);
  scene.add(group);
  enemies.push({
    mesh: group,
    startPos: new THREE.Vector3(x, y, 0),
    range: range,
    speed: speed,
    offset: offset
  });
}

function createCrate(x, y) {
  const s = 1.0;
  const group = createBorderedRect(s, s, 0x00aa00, 0.05);
  group.position.set(x, y, 0);
  scene.add(group);

  const bbox = new THREE.Box3();
  bbox.setFromCenterAndSize(new THREE.Vector3(x, y, 0), new THREE.Vector3(s, s, 1));

  group.userData = {
    isCrate: true,
    velocity: new THREE.Vector3(),
    aabb: bbox,
    onGround: false
  };
  crates.push(group);
}

function createButton(x, y, gateId) {
  const w = 1.5, h = 0.2;
  const group = createBorderedRect(w, h, 0xff0000, 0.02); // Start Red
  group.position.set(x, y, 0);
  scene.add(group);

  const bbox = new THREE.Box3();
  bbox.setFromCenterAndSize(new THREE.Vector3(x, y, 0), new THREE.Vector3(w, h, 1));

  buttons.push({ mesh: group, aabb: bbox, gateId: gateId, pressed: false });
}

function createGate(x, y, w, h, id) {
  const group = createBorderedRect(w, h, 0x888888);
  group.position.set(x, y, 0);
  scene.add(group);

  const bbox = new THREE.Box3();
  bbox.setFromCenterAndSize(new THREE.Vector3(x, y, 0), new THREE.Vector3(w, h, 1));
  const gate = { mesh: group, aabb: bbox, id: id, isOpen: false, startY: y };
  group.userData = { isGate: true, aabb: bbox, gateRef: gate };
  gates.push(gate);
  platforms.push(group);
}

function createGravityInverter(x, y) {
  const group = new THREE.Group();
  const geo = new THREE.RingGeometry(0.4, 0.6, 6);
  const mat = new THREE.MeshBasicMaterial({ color: 0x9900ff });
  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);
  group.position.set(x, y, 0);
  scene.add(group);
  inverters.push({ mesh: group });
}

function createFireballShooter(x, y, dirX, dirY, interval) {
  const w = 0.8, h = 0.8;
  const group = createBorderedRect(w, h, 0xff4400);
  group.position.set(x, y, 0);
  scene.add(group);
  shooters.push({ x, y, dir: new THREE.Vector3(dirX, dirY, 0).normalize(), interval, timer: 0 });
}

function spawnFireball(x, y, dir) {
  const geo = new THREE.CircleGeometry(0.3, 6);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, 0);
  scene.add(mesh);
  fireballs.push({ mesh: mesh, velocity: dir.clone().multiplyScalar(8.0), life: 5.0 });
}

function createFinishFlag(x, y) {
  const group = new THREE.Group();
  const pGeo = new THREE.PlaneGeometry(0.2, 3);
  const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pole = new THREE.Mesh(pGeo, pMat);
  pole.position.y = 1.5;
  group.add(pole);
  const fGeo = new THREE.CircleGeometry(0.8, 3);
  const fMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
  const flag = new THREE.Mesh(fGeo, fMat);
  flag.position.set(0.6, 2.5, 0);
  flag.rotation.z = -Math.PI / 2;
  group.add(flag);
  group.position.set(x, y, 0);
  scene.add(group);
  flags.push(group);
}


// --- LEVElS ---
function loadLevel(level) {
  clearLevel();
  state.currentLevel = level;
  state.isFrozen = false; // FORCE UNFREEZE
  freezeOverlay.classList.remove('freeze-active');

  const msg = document.getElementById('tutorial-message');
  document.getElementById('instructions').innerHTML = `<h2>LEVEL ${level}</h2>`;
  msg.innerText = "";

  const map = {
    1: loadLevel1,
    2: loadLevel2,
    3: loadLevel3,
    4: loadLevel4,
    5: loadLevel5,
    6: loadLevel6,
    7: loadLevel7,
    8: loadLevel8,
    9: loadLevel9,
    10: loadLevel10
  };

  if (map[level]) map[level]();
  else {
    document.getElementById('instructions').innerHTML = "<h2 style='color:#0f0'>COMPLETED!</h2>";
    msg.innerText = "You have conquered all dimensions.";
    playerGroup.visible = false;
  }
}

function loadLevel1() {
  updateTutorial(0);
  createPlatform(0, 0, 4, 1, 0xff00ff);
  createPlatform(10, 0, 4, 1, 0x00ffff);
  createOrb(1, 4, 2);
  createPlatform(12, 10, 2, 10, 0xffff00);
  createOrb(2, 12, 5);
  createPlatform(26, 10, 2, 2, 0xffa500);
  createOrb(3, 18, 11);
  createOrb(4, 22, 11);
  createPlatform(40, 0, 6, 1, 0xffffff);
  createOrb(5, 34, 5);
  exitZone = { x: 40, y: 1, size: 2 };
  createFinishFlag(40, 1);
  playerGroup.position.set(0, 2, 0);
}

function loadLevel2() {
  createPlatform(0, 0, 6, 1, 0xff00ff);
  createOrb(1, 4, 2);
  // Easy lasers
  createLaser(10, 2, 4, 'static');
  createLaser(10, 4, 4, 'static');

  // Reduced gap: 15 -> 12. Range 12. 
  createPlatform(12, 0, 8, 1, 0x00ffff); // Widened
  createPlatform(26, 0, 10, 1, 0xffff00);
  createOrb(2, 18, 2);
  // Long moving laser is now hollow (teleport allowed)
  createLaser(18, 2, 8, 'x', 4, 2.0, 0, true);
  createPlatform(26, 20, 8, 1, 0xffa500); // Widened
  createOrb(3, 26, 10);
  createLaser(26, 10, 4, 'x', 2, 3.0);
  createPlatform(39, 20, 8, 1, 0xffffff); // Widened
  createOrb(4, 35, 20);
  exitZone = { x: 39, y: 21, size: 2 };
  createFinishFlag(39, 21);
  playerGroup.position.set(0, 2, 0);
}

function loadLevel3() {
  createPlatform(0, 0, 6, 1, 0xff00ff);
  createOrb(5, 0, 3);
  createJumpPad(6, 0.5, 2);
  createLaser(9, 6, 4, 'static');
  createPlatform(12, 11, 4, 1, 0x00ffff);
  // REMOVED Orb 1 to force reliance on Orb 2

  createJumpPad(16, 11.5, 2);
  createLaser(12, 8, 3, 'x', 2, 1.5);
  createLaser(16, 14, 3, 'static');

  createPlatform(28, 18, 6, 1, 0xffff00);

  // This Orb is now ESSENTIAL. 
  // Laser guarding it makes it risky.
  createOrb(2, 22, 16);
  createLaser(22, 14, 6, 'y', 3, 2.0);

  createJumpPad(32, 18.5, 2);
  createOrb(3, 38, 28);
  createLaser(36, 20, 4, 'static');
  createLaser(30, 8, 8, 'x', 4, 1.0);

  // Moved Final Platform much further (44 -> 55)
  // Jump pad at 32 launches you, but you won't make horizontal distance to 55.
  // You MUST teleport mid-air.
  createPlatform(55, 10, 6, 1, 0xffffff);
  createLaser(50, 12, 4, 'static'); // Guarding the landing
  exitZone = { x: 55, y: 11, size: 2 };
  createFinishFlag(55, 11);
  playerGroup.position.set(0, 2, 0);
}

function loadLevel4() {
  createPlatform(0, 0, 6, 1, 0xff00ff);
  createOrb(0, 0, 3);
  createJumpPad(6, 0.5, 2);
  createPlatform(20, 0, 20, 1, 0x00ffff);
  createLaser(15, 2, 4, 'static');
  createLaser(25, 2, 4, 'static');
  createEnemy(15, 1.5, 4, 2.0);
  createEnemy(18, 1.5, 2, 3.5);
  createOrb(1, 15, 4);
  createEnemy(25, 1.5, 4, 2.5);
  createEnemy(28, 1.5, 2, 4.0);
  createOrb(2, 25, 4);
  createJumpPad(28, 0.6, 2);
  createPlatform(40, 5, 6, 1, 0xffa500);
  createEnemy(40, 6.5, 2, 3.0);
  createOrb(3, 40, 9);
  createLaser(48, 5, 6, 'y', 2, 3.0);
  createPlatform(55, 5, 6, 1, 0xffffff);
  exitZone = { x: 55, y: 6, size: 2 };
  createFinishFlag(55, 6);
  playerGroup.position.set(0, 2, 0);
}

function loadLevel5() {
  createPlatform(0, 0, 6, 1, 0xff00ff);
  createMovingPlatform(9, 0, 4, 1, 0x00ffff, 'x', 4, 1.5, 0);
  createOrb(1, 9, 4);
  createLaser(14, 2, 6, 'y', 3, 2.0);
  createPlatform(18, 0, 4, 1, 0xff00ff);
  createEnemy(18, 1.5, 2, 4.0);
  createJumpPad(18, 0.6, 2);
  createMovingPlatform(26, 5, 4, 1, 0xffff00, 'y', 5, 1.0, 0);
  createOrb(2, 26, 13);
  createPlatform(34, 10, 4, 1, 0xffa500);
  createLaser(39, 10, 4, 'static');
  createMovingPlatform(44, 10, 4, 1, 0x00ff00, 'x', 5, 2.0, Math.PI);
  createEnemy(54, 11, 2, 2.0);
  createPlatform(54, 10, 4, 1, 0xffffff);
  exitZone = { x: 54, y: 11, size: 2 };
  createFinishFlag(54, 11);
  playerGroup.position.set(0, 2, 0);
}

function loadLevel6() {
  // 6: Phase Walls Intro
  createPlatform(0, 0, 8, 1, 0xff00ff);
  createOrb(1, 0, 3); // Start charge

  // Phase Wall 1: Simple barrier
  createPlatform(10, 0, 6, 1, 0x00ffff);
  createLaser(7, 3, 6, 'static', 0, 0, 0, true); // Hollow Laser Wall

  // Phase Wall 2: Double Wall
  createPlatform(20, 0, 8, 1, 0xffff00);
  createLaser(18, 3, 6, 'static', 0, 0, 0, true); // Wall
  createOrb(2, 20, 3); // Refill inside
  createLaser(22, 3, 6, 'static', 0, 0, 0, true); // Wall

  // The Teleport Leap through moving hollow lasers
  createPlatform(35, 5, 8, 1, 0xffffff);
  createLaser(30, 5, 8, 'x', 2, 1.0, 0, true);

  exitZone = { x: 35, y: 6, size: 2 };
  createFinishFlag(35, 6);
  playerGroup.position.set(0, 2, 0);

  // Hint Banner
  const msg = document.getElementById('tutorial-message');
  if (msg) msg.innerText = "HINT: DROP OFF AND TELEPORT INTO THE PLATFORM FROM UNDERNEATH";
}

function loadLevel7() {
  // 7: Improved Crate Puzzle
  createPlatform(0, 0, 8, 1, 0xff00ff);
  createOrb(1, 0, 3);

  // The Gate
  createGate(12, 3, 1, 6, 99);

  // Platform for Button
  createPlatform(5, 5, 8, 1, 0x00ffff);
  createButton(6, 5.6, 99);

  // Platform for Crate (Higher)
  createPlatform(-8, 6, 6, 1, 0xffff00);
  // Crate spawns safely
  createCrate(-8, 9);

  // Player Goal
  createPlatform(20, 0, 6, 1, 0xffffff);
  exitZone = { x: 20, y: 1, size: 2 };
  createFinishFlag(20, 1);
  playerGroup.position.set(0, 2, 0);
}

function loadLevel8() {
  createPlatform(0, 0, 6, 1, 0xff00ff);
  createOrb(1, 0, 3);
  createFragilePlatform(8, 0, 3, 1);
  createFragilePlatform(14, 2, 3, 1);
  createFragilePlatform(20, 0, 3, 1);
  createFragilePlatform(26, 4, 3, 1);
  createPlatform(34, 4, 6, 1, 0xffffff);
  exitZone = { x: 34, y: 5, size: 2 };
  createFinishFlag(34, 5);
  playerGroup.position.set(0, 2, 0);
}

function loadLevel9() {
  createPlatform(0, 0, 8, 1, 0xff00ff);
  createOrb(1, 0, 3);
  createGravityInverter(6, 2);
  createPlatform(15, 10, 10, 1, 0x00ffff);
  createOrb(2, 15, 8);
  createGravityInverter(22, 8);
  createPlatform(30, 0, 6, 1, 0xffffff);
  exitZone = { x: 30, y: 1, size: 2 };
  createFinishFlag(30, 1);
  playerGroup.position.set(0, 2, 0);
}

function loadLevel10() {
  createPlatform(0, 0, 6, 1, 0xff00ff);
  createOrb(1, 0, 3);
  createPlatform(15, 0, 20, 1, 0x550000);
  createFireballShooter(25, 5, -1, 0, 2.0);
  createFireballShooter(5, 2, 1, 0, 2.5);
  createPlatform(30, 10, 10, 1, 0x00ffff);
  createGate(40, 13, 1, 6, 100);
  createCrate(30, 15);
  createButton(32, 10.6, 100);
  createGravityInverter(42, 10);
  createPlatform(50, 20, 6, 1, 0xff00ff);
  createFragilePlatform(60, 20, 4, 1);
  createFragilePlatform(68, 18, 4, 1);
  createPlatform(80, 0, 8, 1, 0xffffff);
  createFireballShooter(85, 5, -1, 0, 1.0);
  exitZone = { x: 80, y: 1, size: 2 };
  createFinishFlag(80, 1);
  playerGroup.position.set(0, 2, 0);
}


function animate() {
  try {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const timeScale = state.isFrozen ? 0.0 : 1.0;
    // Clamp dt to prevent physics explosions on frame hiccups
    const dt = Math.min(delta * timeScale, 0.1);
    const realDt = delta;

    state.lastTime += dt;

    lasers.forEach(l => {
      if (l.axis === 'x') l.mesh.position.x = l.startPos.x + Math.sin(state.lastTime * l.speed + l.offset) * l.range;
      if (l.axis === 'y') l.mesh.position.y = l.startPos.y + Math.sin(state.lastTime * l.speed + l.offset) * l.range;
    });

    enemies.forEach(e => {
      e.mesh.position.x = e.startPos.x + Math.sin(state.lastTime * e.speed + e.offset) * e.range;
      e.mesh.position.y = e.startPos.y + Math.abs(Math.cos(state.lastTime * 5)) * 0.5;
    });

    movingPlatforms.forEach(mp => {
      const oldPos = mp.mesh.position.clone();
      if (mp.axis === 'x') mp.mesh.position.x = mp.startPos.x + Math.sin(state.lastTime * mp.speed + mp.offset) * mp.range;
      if (mp.axis === 'y') mp.mesh.position.y = mp.startPos.y + Math.sin(state.lastTime * mp.speed + mp.offset) * mp.range;
      const dPos = new THREE.Vector3().subVectors(mp.mesh.position, oldPos);
      mp.mesh.userData.aabb.translate(dPos);

      if (playerGroup.userData.onGround && playerGroup.userData.platform === mp.mesh && !state.isFrozen) {
        playerGroup.position.add(dPos);
      }
      crates.forEach(c => {
        if (c.userData.onGround && c.userData.platform === mp.mesh) c.position.add(dPos);
      });
    });

    shooters.forEach(s => {
      s.timer += dt;
      if (s.timer > s.interval) {
        spawnFireball(s.x, s.y, s.dir);
        s.timer = 0;
      }
    });

    for (let i = fireballs.length - 1; i >= 0; i--) {
      const f = fireballs[i];
      f.life -= dt;
      f.mesh.position.add(f.velocity.clone().multiplyScalar(dt));
      if (f.life <= 0) {
        scene.remove(f.mesh);
        fireballs.splice(i, 1);
      }
    }

    platforms.forEach(p => {
      if (p.userData.isFragile && playerGroup.userData.platform === p) {
        p.userData.decay += dt;
        if (p.userData.decay < 2.0) p.position.x += (Math.random() - 0.5) * 0.1;
        else { scene.remove(p); p.position.y = -9999; }
      }
    });

    crates.forEach(c => {
      c.userData.velocity.y -= BASE_GRAVITY * state.gravityMultiplier * dt;
      // Basic Friction
      c.userData.velocity.x -= c.userData.velocity.x * 5.0 * dt;

      c.position.y += c.userData.velocity.y * dt;
      c.position.x += c.userData.velocity.x * dt;

      const res = resolvePlatformCollisions(c, 1, 1, false);
      c.userData.onGround = res.onGround;
      c.userData.platform = res.platform;
    });

    const val = playerGroup.userData.velocity;
    val.y -= BASE_GRAVITY * state.gravityMultiplier * dt;
    val.x -= val.x * FRICTION * dt;

    if (!state.isFrozen) {
      if (keys.left) val.x -= MOVE_SPEED * 5 * dt;
      if (keys.right) val.x += MOVE_SPEED * 5 * dt;
    }

    playerGroup.position.x += val.x * dt;

    // Crate Push Logic
    const pBox = new THREE.Box3().setFromCenterAndSize(playerGroup.position, new THREE.Vector3(1, 1, 1));
    crates.forEach(c => {
      const cBox = new THREE.Box3().setFromCenterAndSize(c.position, new THREE.Vector3(1, 1, 1));
      if (pBox.intersectsBox(cBox)) {
        // Push
        const dx = c.position.x - playerGroup.position.x;
        // Only push if somewhat aligned horizontally
        if (Math.abs(c.position.y - playerGroup.position.y) < 0.8) {
          if (dx > 0 && val.x > 0) c.userData.velocity.x = 5.0; // Fixed push speed
          else if (dx < 0 && val.x < 0) c.userData.velocity.x = -5.0;
        }
      }
    });

    playerGroup.position.y += val.y * dt;
    const res = resolvePlatformCollisions(playerGroup, 1, 1, true);
    playerGroup.userData.onGround = res.onGround;
    playerGroup.userData.platform = res.platform;

    gates.forEach(g => {
      const btn = buttons.find(b => b.gateId === g.id);
      if (!btn) return; // Safety check to prevent crash if button missing

      let pressed = false;
      // Update Crate AABBs for intersection check
      crates.forEach(c => c.userData.aabb.setFromCenterAndSize(c.position, new THREE.Vector3(1, 1, 1)));

      for (const c of crates) { if (c.userData.aabb.intersectsBox(btn.aabb)) pressed = true; }
      const pBoxGate = new THREE.Box3().setFromCenterAndSize(playerGroup.position, new THREE.Vector3(1, 1, 1));
      if (pBoxGate.intersectsBox(btn.aabb)) pressed = true;

      if (pressed) {
        btn.mesh.material.color.setHex(0x00ff00);
        if (g.mesh.position.y !== -100) {
          const dy = -100 - g.mesh.position.y;
          g.mesh.position.y = -100;
          g.mesh.userData.aabb.translate(new THREE.Vector3(0, dy, 0));
        }
      } else {
        btn.mesh.material.color.setHex(0xff0000);
        if (g.mesh.position.y === -100) {
          const dy = g.startY - g.mesh.position.y;
          g.mesh.position.y = g.startY;
          g.mesh.userData.aabb.translate(new THREE.Vector3(0, dy, 0));
        }
      }
    });

    inverters.forEach(inv => {
      const dist = playerGroup.position.distanceTo(inv.mesh.position);
      inv.mesh.rotation.z += dt * 2;
      if (dist < 1.0) {
        if (!playerGroup.userData.inverterCooldown) {
          state.gravityMultiplier *= -1;
          playerGroup.scale.y *= -1;
          playerGroup.userData.inverterCooldown = 1.0;
        }
      }
    });
    if (playerGroup.userData.inverterCooldown > 0) playerGroup.userData.inverterCooldown -= dt;

    if (Math.abs(playerGroup.position.y) > 40) state.gameOver = true;

    const playerBox = new THREE.Box3().setFromCenterAndSize(playerGroup.position, new THREE.Vector3(0.8, 0.8, 1));
    [...fireballs, ...enemies].forEach(h => {
      const hb = new THREE.Box3().setFromCenterAndSize(h.mesh.position, new THREE.Vector3(0.5, 0.5, 1));
      if (playerBox.intersectsBox(hb)) state.gameOver = true;
    });
    lasers.forEach(l => {
      const lb = new THREE.Box3().setFromObject(l.mesh);
      lb.expandByScalar(-0.2);
      if (playerBox.intersectsBox(lb)) state.gameOver = true;
    });

    if (state.gameOver) loadLevel(state.currentLevel);

    for (let i = orbs.length - 1; i >= 0; i--) {
      if (playerGroup.position.distanceTo(orbs[i].position) < 1.5) {
        scene.remove(orbs[i]);
        orbs.splice(i, 1);
        state.orbs++;
        state.teleportCharges++;
        updateHUD();
      }
    }

    if (exitZone && playerGroup.position.distanceTo(new THREE.Vector3(exitZone.x, exitZone.y, 0)) < 2) {
      loadLevel(state.currentLevel + 1);
    }

    const targetX = playerGroup.position.x;
    const targetY = playerGroup.position.y;
    camera.position.x += (targetX - camera.position.x) * 5 * realDt;
    camera.position.y += (targetY - camera.position.y) * 5 * realDt;

    if (exitZone) {
      const dx = exitZone.x - playerGroup.position.x;
      const dy = exitZone.y - playerGroup.position.y;
      guideArrow.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
    }

    // Aiming Logic
    if (state.isFrozen) {
      raycaster.setFromCamera(state.mouse, camera);
      const target = new THREE.Vector3();
      const intersection = raycaster.ray.intersectPlane(planeZ, target);

      if (intersection) {
        if (target.distanceTo(playerGroup.position) <= TELEPORT_RANGE) {
          state.canTeleport = true;
          state.teleportTarget.copy(target);
        } else {
          const dir = target.clone().sub(playerGroup.position).normalize();
          state.teleportTarget.copy(playerGroup.position).add(dir.multiplyScalar(TELEPORT_RANGE));
          state.canTeleport = true;
        }
      }

      teleportMarker.visible = true;
      teleportMarker.position.copy(state.teleportTarget);

      const pts = [playerGroup.position.clone(), state.teleportTarget.clone()];
      aimLine.geometry.setFromPoints(pts);
      aimLine.visible = true;

      if (checkLaserBlock(playerGroup.position, state.teleportTarget)) {
        state.teleportBlocked = true;
        blockedMarker.visible = true;
        markerRing.material.color.setHex(0xff0000);
        aimLine.material.color.setHex(0xff0000);
      } else {
        state.teleportBlocked = false;
        blockedMarker.visible = false;
        const col = state.teleportCharges > 0 ? 0x00ff00 : 0xaaaaaa;
        markerRing.material.color.setHex(col);
        aimLine.material.color.setHex(0x00ffff);
      }

    } else {
      teleportMarker.visible = false;
      aimLine.visible = false;
    }

    orbs.forEach(o => { o.rotation.z += 2 * dt; });
    renderer.render(scene, camera);
  } catch (err) {
    console.error(err);
    const msg = document.getElementById('tutorial-message');
    if (msg) msg.innerText = "CRASH: " + err.message;
  }
}

// ... Resolve Collisions same as before ...
const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();
const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

function resolvePlatformCollisions(obj, width, height, isPlayer) {
  let onGround = false;
  let platform = null;
  const feetY = state.gravityMultiplier > 0 ? obj.position.y - height / 2 : obj.position.y + height / 2;
  const velY = obj.userData.velocity.y;

  // Ensure Gates (which are in platforms array) and everything else is included.
  // Note: gates are added to platforms array in createGate, so they should be covered there.
  // BUT, let's be explicit to avoid "glitching" if filtering is weird.
  const relevantPlatforms = [...platforms, ...jumpPads, ...movingPlatforms.map(m => m.mesh), ...crates.filter(c => c !== obj)];

  crates.forEach(c => c.userData.aabb.setFromCenterAndSize(c.position, new THREE.Vector3(1, 1, 1)));

  for (const plat of relevantPlatforms) {
    const b = plat.userData.aabb;
    if (obj.position.x + width / 2 > b.min.x && obj.position.x - width / 2 < b.max.x) {
      if (state.gravityMultiplier > 0) {
        if (feetY <= b.max.y + 0.2 && feetY >= b.min.y - 2.0 && velY <= 0.2) {
          obj.position.y = b.max.y + height / 2;
          obj.userData.velocity.y = 0;
          onGround = true;
          platform = plat;
          if (plat.userData.isJumpPad && isPlayer) {
            obj.userData.velocity.y = JUMP_SPEED * 1.5;
            onGround = false;
          }
        }
      } else {
        if (feetY >= b.min.y - 0.2 && feetY <= b.max.y + 2.0 && velY >= -0.2) {
          obj.position.y = b.min.y - height / 2;
          obj.userData.velocity.y = 0;
          onGround = true;
          platform = plat;
          if (plat.userData.isJumpPad && isPlayer) {
            obj.userData.velocity.y = -JUMP_SPEED * 1.5;
            onGround = false;
          }
        }
      }
    }
  }
  return { onGround, platform };
}

loadLevel(1);
animate();

function updateHUD() {
  document.getElementById('orb-count').innerText = state.teleportCharges;
}

window.addEventListener('resize', () => {
  const aspect = window.innerWidth / window.innerHeight;
  camera.left = -viewSize * aspect / 2;
  camera.right = viewSize * aspect / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
