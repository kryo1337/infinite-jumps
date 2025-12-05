import './style.css';
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { PlayerController } from './player';
import { LevelLoader } from './level_loader';
import { UIManager } from './ui_manager';
import { AuthManager } from './auth_manager';
import { ModelLoader } from './utils/model_loader';

// --- CONFIG ---
const CONFIG = {
  initialLevel: 'infinite' as 'infinite',
  fov: 90,
  defaultSensitivity: 1.0,
  gravity: { x: 0.0, y: -16.0, z: 0.0 },
  deathThreshold: -20.0,
  skyboxPath: '/textures/skybox/DayInTheClouds4k.hdr',
  physicsStep: 1 / 60
};

// --- SCENE SETUP ---
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(CONFIG.fov, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.y = Math.PI;

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false,
  depth: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
document.body.appendChild(renderer.domElement);

// --- SKYBOX ---
new HDRLoader().load(
  CONFIG.skyboxPath,
  (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    scene.environment = texture;
  },
  undefined,
  (error) => {
    console.error('An error occurred loading the skybox:', error);
    scene.background = new THREE.Color(0x87CEEB);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  }
);

// --- LIGHTS ---
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 50, 10);
scene.add(dirLight);

// --- PHYSICS INIT ---
await RAPIER.init();
const world = new RAPIER.World(CONFIG.gravity);

// --- PRELOAD MODELS ---
try {
  await ModelLoader.load('/models/rampdown.glb');
} catch (error) {
  console.error('Failed to preload rampdown model:', error);
}

// --- WORLD GEN ---
const levelLoader = new LevelLoader(scene, world);
levelLoader.loadLevel(CONFIG.initialLevel);

// --- PLAYER ---
const player = new PlayerController(camera, document.body, world, {
  mouseSensitivity: CONFIG.defaultSensitivity,
});

// --- UI ---
const ui = new UIManager(CONFIG.defaultSensitivity);

ui.onLoadLevel = (type) => {
  if (type === 'infinite') {
    levelLoader.loadLevel(type);
    player.respawn();
    document.body.requestPointerLock();
  }
};

// --- AUTH ---
const authManager = new AuthManager();
if (authManager.isOfflineMode) {
  ui.setOfflineMode(true);
}

function getFriendlyErrorMessage(code: string): string | null {
  switch (code) {
    case 'auth/user-disabled': return 'This account has been banned.';
    case 'auth/popup-closed-by-user': return 'Sign-in popup was closed.';
    default: return null;
  }
}

ui.onLoginGoogleRequest = async () => {
  try {
    await authManager.loginWithGoogle();
  } catch (e: any) {
    ui.showAuthError(getFriendlyErrorMessage(e.code) || e.message || 'Google login failed');
  }
};

ui.onLogoutRequest = () => {
  authManager.logout();
};

ui.onApplySettings = async (settings) => {
  try {
    player.setSensitivity(settings.sensitivity);

    const settingsToSave = {
      sensitivity: settings.sensitivity,
      nickname: (settings.nickname || '').trim() || 'Player'
    };

    await authManager.saveSettings(settingsToSave);
    ui.updateUserHeader(authManager.currentUser, settingsToSave.nickname);
    ui.toggleSettings(false);
  } catch (e: any) {
    ui.showSettingsError(e.message || "Failed to save settings");
  }
};

authManager.onAuthStateChanged = (user) => {
  ui.updateUserHeader(user);
  ui.updateGameOverLoginMessage(!!user);
  if (user) {
    ui.toggleAuthModal(false);
  }
};

authManager.onSettingsLoaded = (settings) => {
  player.setSensitivity(settings.sensitivity);
  ui.syncSettings(settings);
  ui.updateUserHeader(authManager.currentUser, settings.nickname);
};

let isPaused = false;
let lastStateChangeTime = 0;
let isGameOver = false;

const performRestart = () => {
  isGameOver = false;
  ui.toggleGameOver(false);

  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  player.respawn();
  levelLoader.loadLevel('infinite');
  document.body.requestPointerLock();
};

ui.onPlayAgain = performRestart;

ui.leaderboardBtn.addEventListener('click', async () => {
  const entries = await authManager.getLeaderboard();
  ui.updateLeaderboard(entries);
});

let listenersAttached = false;

function setupEventListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  ui.onResume = () => {
    document.body.requestPointerLock();
  };

  document.addEventListener('click', () => {
    if (!isGameOver) {
      document.body.requestPointerLock();
    }
  });

  document.addEventListener('pointerlockchange', () => {
    lastStateChangeTime = performance.now();
    if (document.pointerLockElement === document.body) {
      isPaused = false;
      ui.toggleMenu(false);
      if (!isGameOver) ui.toggleGameOver(false);
    } else {
      if (!isGameOver) {
        isPaused = true;
        ui.toggleMenu(true);
      }
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR') {
      performRestart();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Escape' && isPaused && !isGameOver) {
      if (performance.now() - lastStateChangeTime > 100) {
        document.body.requestPointerLock();
      }
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

setupEventListeners();

// --- LOOP ---
const clock = new THREE.Clock();
let frameCount = 0;
let lastTime = 0;
let fps = 0;

const PHYSICS_STEP = CONFIG.physicsStep;
let accumulator = 0;

function gameLoop() {
  requestAnimationFrame(gameLoop);

  const dt = Math.min(clock.getDelta(), 0.1);

  if (!isPaused && !isGameOver) {
    accumulator += dt;
    while (accumulator >= PHYSICS_STEP) {
      player.savePreviousPosition();
      world.timestep = PHYSICS_STEP;
      world.step();
      player.updatePhysics(PHYSICS_STEP);
      levelLoader.update(player.body.translation().z, player.getSpeed(), player.body.translation().y);

      const isDeadlyCollision = player.groundColliderHandle !== undefined && levelLoader.checkDeathCollision(player.groundColliderHandle);
      const isFallen = player.body.translation().y < (levelLoader.getMinY() + CONFIG.deathThreshold);

      if (player.groundColliderHandle !== undefined) {
        const teleportOffset = levelLoader.getTeleportOffset(player.groundColliderHandle);
        if (teleportOffset) {
          const currentPos = player.body.translation();
          const newPos = {
            x: currentPos.x + teleportOffset.x,
            y: currentPos.y + teleportOffset.y,
            z: currentPos.z + teleportOffset.z
          };
          player.teleport(newPos);
          levelLoader.setMinYThreshold(newPos.y - 50);
        }
      }

      if (isDeadlyCollision || isFallen) {
        if (!isGameOver) {
          isGameOver = true;
          document.exitPointerLock();

          const score = Math.max(0, player.body.translation().z);
          authManager.saveScore(score).then((result) => {
            ui.showGameOver(score, result.currentHighScore, result.isNewHighScore, !!authManager.currentUser);
          });
        }
      } accumulator -= PHYSICS_STEP;
    }
  }

  const alpha = accumulator / PHYSICS_STEP;
  if (!isPaused && !isGameOver) {
    player.updateVisuals(dt);
    player.syncCamera(alpha);
  }

  frameCount++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    fps = frameCount;
    frameCount = 0;
    lastTime = now;
  }

  const speed = player.getSpeed();
  const distance = Math.max(0, player.body.translation().z);
  ui.update(fps, speed, distance);

  renderer.render(scene, camera);
}

gameLoop();
