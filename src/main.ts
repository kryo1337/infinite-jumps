import './style.css';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PlayerController } from './player';

// --- CONFIG ---
const CONFIG = {
  fov: 90,
  defaultSensitivity: 1.0,
  gravity: { x: 0.0, y: -16.0, z: 0.0 }
};

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.FogExp2(0x87CEEB, 0.005);

const camera = new THREE.PerspectiveCamera(CONFIG.fov, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false,
  depth: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- LIGHTS ---
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 50, 10);
scene.add(dirLight);

// --- PHYSICS INIT ---
await RAPIER.init();
const world = new RAPIER.World(CONFIG.gravity);

// --- WORLD GEN ---
function createGround() {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x333333 }));
  mesh.rotation.x = -Math.PI / 2;
  scene.add(mesh);
  scene.add(new THREE.GridHelper(100, 100));

  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(50, 0.1, 50), body);
}

interface Block {
  pos: [number, number, number];
  size: [number, number, number];
  color: number;
}

function createBhopCourse() {
  const blocks: Block[] = [];

  const startPos = { x: 4, y: 0.5, z: -34 };

  blocks.push({
    pos: [startPos.x, startPos.y, startPos.z],
    size: [3, 1, 3],
    color: 0xe0b0ff
  });

  let currentPos = new THREE.Vector3(startPos.x, startPos.y, startPos.z);

  const jumpDist = 8.5;
  const heightGain = 0.2;

  const colors = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3, 0xe0b0ff];

  let dir = new THREE.Vector3(1, 0, 0);
  const limit = 45;

  for (let i = 0; i < 49; i++) {
    currentPos.addScaledVector(dir, jumpDist);
    currentPos.y += heightGain;

    if (dir.x > 0 && currentPos.x > limit) {
      dir.set(0, 0, 1);
    } else if (dir.z > 0 && currentPos.z > limit) {
      dir.set(-1, 0, 0);
    } else if (dir.x < 0 && currentPos.x < -limit) {
      dir.set(0, 0, -1);
    } else if (dir.z < 0 && currentPos.z < -limit) {
      dir.set(1, 0, 0);
    }

    blocks.push({
      pos: [currentPos.x, currentPos.y, currentPos.z],
      size: [3, 0.5, 3],
      color: colors[i % colors.length]
    });
  }

  blocks.forEach((b: Block) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...b.size), new THREE.MeshStandardMaterial({ color: b.color }));
    mesh.position.set(...b.pos);
    scene.add(mesh);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...b.pos));
    world.createCollider(RAPIER.ColliderDesc.cuboid(b.size[0] / 2, b.size[1] / 2, b.size[2] / 2), body);
  });
}

createGround();
createBhopCourse();

// --- PLAYER ---
const player = new PlayerController(camera, document.body, world, {
  mouseSensitivity: CONFIG.defaultSensitivity,
});

// --- HUD ---
const hud = document.createElement('div');
Object.assign(hud.style, { position: 'absolute', top: '20px', left: '20px', color: 'white', fontFamily: 'monospace', fontSize: '20px', fontWeight: 'bold', textShadow: '2px 2px 0 #000', whiteSpace: 'pre' });
document.body.appendChild(hud);

// --- SETTINGS UI ---
const settings = document.createElement('div');
Object.assign(settings.style, { position: 'absolute', bottom: '20px', left: '20px', color: 'white', fontFamily: 'monospace', background: 'rgba(0,0,0,0.5)', padding: '10px' });
settings.innerHTML = `
  <label>Sens: <input type="range" id="sens" min="0.1" max="10.0" step="0.05" value="${CONFIG.defaultSensitivity}"></label> <span id="sens-val">${CONFIG.defaultSensitivity}</span>
`;
document.body.appendChild(settings);

const sensInput = document.getElementById('sens') as HTMLInputElement;
const sensVal = document.getElementById('sens-val') as HTMLElement;

sensInput.addEventListener('input', (e) => {
  const val = parseFloat((e.target as HTMLInputElement).value);
  player.setSensitivity(val);
  sensVal.innerText = val.toFixed(2);
});

// --- LOOP ---
const clock = new THREE.Clock();
let frameCount = 0;
let lastTime = 0;
let fps = 0;

function gameLoop() {
  requestAnimationFrame(gameLoop);

  const dt = Math.min(clock.getDelta(), 0.1);

  world.timestep = dt;
  world.step();

  player.update(dt);
  player.syncCamera();

  frameCount++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    fps = frameCount;
    frameCount = 0;
    lastTime = now;
  }

  const speed = player.getSpeed();
  const color = speed > 20 ? '#f33' : speed > 12 ? '#ff3' : '#fff';
  hud.innerHTML = `FPS:   ${fps}\nSpeed: <span style="color:${color}">${speed.toFixed(2)}</span> u/s`;

  renderer.render(scene, camera);
}

gameLoop();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
