import './style.css';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PlayerController } from './player';
import { LevelLoader } from './level_loader';
import { UIManager } from './ui_manager';
import { AuthManager } from './auth_manager';
import { GameLoader } from './utils/game_loader';
import { GAME_CONFIG, DEFAULT_THEME } from './config';
import type { Theme } from './config';

// --- GLOBAL VARIABLES ---
let player: PlayerController;
let levelLoader: LevelLoader;
let authManager: AuthManager;
let isPaused = false;
let isGameOver = false;
let lastStateChangeTime = 0;
let listenersAttached = false;
let currentTheme: Theme = DEFAULT_THEME;

// --- SCENE SETUP ---
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(GAME_CONFIG.World.fov, window.innerWidth / window.innerHeight, 0.1, 1000);
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

// --- LIGHTS ---
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 50, 10);
scene.add(dirLight);

// --- PHYSICS INIT ---
await RAPIER.init();
const world = new RAPIER.World(GAME_CONFIG.World.gravity);

// --- UI INIT ---
const ui = new UIManager(GAME_CONFIG.World.defaultSensitivity);

// --- AUTH INIT ---
authManager = new AuthManager();
let isInitialLoad = true;

// --- STARTUP SEQUENCE ---
(async () => {
  if (authManager.isOfflineMode) {
    ui.setOfflineMode(true);
  }

  await authManager.waitForInitialAuth();

  let initialTheme = DEFAULT_THEME;
  if (authManager.currentUser) {
    const dbTheme = await authManager.syncActiveThemeFromDB();
    if (dbTheme) {
      initialTheme = dbTheme;
    } else {
      initialTheme = authManager.getActiveTheme() || DEFAULT_THEME;
    }
  } else {
    initialTheme = authManager.getActiveTheme() || DEFAULT_THEME;
  }

  // --- GAME LOADER ---
  const gameLoader = new GameLoader(scene);
  const isHardwareAccelerated = gameLoader.checkHardwareAcceleration(renderer);
  if (!isHardwareAccelerated) {
    console.warn("Hardware acceleration disabled or software renderer detected.");
    ui.showHardwareWarning();
  }

  gameLoader.load(
    initialTheme.skyboxPath,
    async () => {
      document.body.appendChild(renderer.domElement);
      await initGame(initialTheme, gameLoader);
      ui.hideLoadingScreen();
    },
    (item, percent) => {
      ui.updateLoading(item, percent);
    }
  );
})();

async function initGame(initialTheme: Theme, gameLoader: GameLoader) {
  // --- WORLD GEN ---
  levelLoader = new LevelLoader(scene, world);
  levelLoader.loadLevel(GAME_CONFIG.World.initialLevel);

  // --- PLAYER ---
  player = new PlayerController(camera, document.body, world, {
    mouseSensitivity: GAME_CONFIG.World.defaultSensitivity,
  });

  // --- UI WIRING ---
  ui.onLoadLevel = (type) => {
    if (type === 'infinite') {
      levelLoader.loadLevel(type);
      player.respawn();
      if (currentTheme) {
        levelLoader.updateChunkColors(currentTheme.colors);
      }
      document.body.requestPointerLock();
    }
  };

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

  ui.onApplySettings = async (settings, nicknameChanged) => {
    try {
      player.setSensitivity(settings.sensitivity);
      if (settings.keybindings) {
        player.setKeybindings(settings.keybindings);
      }

      const settingsToSave = {
        sensitivity: settings.sensitivity,
        nickname: (settings.nickname || '').trim() || 'Player',
        fpsLimit: settings.fpsLimit,
        keybindings: settings.keybindings
      };

      await authManager.saveSettings(settingsToSave, nicknameChanged);
      ui.updateUserHeader(authManager.currentUser, settingsToSave.nickname);
      ui.toggleSettings(false);
    } catch (e: any) {
      ui.showSettingsError(e.message || "Failed to save settings");
    }
  };

  authManager.onAuthStateChanged = async (user) => {
    ui.updateUserHeader(user, authManager.settings.nickname);
    ui.updateGameOverLoginMessage(!!user);
    if (user) {
      ui.toggleAuthModal(false);

      if (!isInitialLoad) {
        try {
          const dbTheme = await authManager.syncActiveThemeFromDB();
          if (dbTheme) {
            applyTheme(dbTheme, gameLoader);
            ui.updateCurrentThemeName(dbTheme.name);
            currentTheme = dbTheme;
          }
        } catch (e) {
          console.error("Failed to sync theme from DB:", e);
        }
      }
    } else {
      if (!isInitialLoad) {
        authManager.clearActiveTheme();
        const defaultTheme = DEFAULT_THEME;
        applyTheme(defaultTheme, gameLoader);
        ui.updateCurrentThemeName(defaultTheme.name);
        currentTheme = defaultTheme;
      }
    }
  };

  authManager.onSettingsLoaded = (settings) => {
    player.setSensitivity(settings.sensitivity);
    if (settings.keybindings) {
      player.setKeybindings(settings.keybindings);
    }
    ui.syncSettings(settings);
    ui.updateUserHeader(authManager.currentUser, settings.nickname);
  };

  authManager.onSettingsLoaded(authManager.settings);

  ui.onPlayAgain = performRestart;

  ui.onShowLeaderboard = async (mode, difficulty, requestId) => {
    const result = await authManager.getLeaderboard(mode, difficulty);
    ui.updateLeaderboard(result.entries, result.mode, result.difficulty, requestId);
  };

  // --- THEME ---
  ui.onApplyTheme = async (themeData) => {
    try {
      const savedId = await authManager.saveTheme({
        name: themeData.name,
        skyboxPath: themeData.skyboxPath,
        colors: themeData.colors
      });

      const fullTheme: Theme = {
        ...themeData,
        id: savedId,
        authorUid: authManager.currentUser?.uid || 'unknown'
      };

      authManager.setActiveTheme(fullTheme);
      applyTheme(fullTheme, gameLoader);
    } catch (e: any) {
      throw e;
    }
  };

  ui.onSelectTheme = async (theme) => {
    await authManager.setActiveTheme(theme);
    applyTheme(theme, gameLoader);
  };

  ui.onLoadUserThemes = async () => {
    return await authManager.getUserThemes();
  };

  ui.onDeleteTheme = async (themeId) => {
    await authManager.deleteTheme(themeId);
  };

  ui.onBookmarkTheme = async (themeId) => {
    await authManager.bookmarkTheme(themeId);
  };

  ui.onImportTheme = async (themeId) => {
    return await authManager.getThemeById(themeId);
  };

  currentTheme = initialTheme;
  applyTheme(currentTheme, gameLoader);

  setupEventListeners();

  isPaused = false;
  document.body.requestPointerLock();

  isInitialLoad = false;

  gameLoop();
}

function getFriendlyErrorMessage(code: string): string | null {
  switch (code) {
    case 'auth/user-disabled': return 'This account has been banned.';
    case 'auth/popup-closed-by-user': return 'Sign-in popup was closed.';
    default: return null;
  }
}

function applyTheme(theme: Theme, gameLoader: GameLoader) {
  currentTheme = theme;
  ui.activeTheme = theme;
  ui.updateCurrentThemeName(theme.name);

  if (levelLoader) {
    levelLoader.updateChunkColors(theme.colors);
  }

  if (theme.skyboxPath !== gameLoader.getCurrentSkyboxPath()) {
    gameLoader.loadSkyboxFromPath(theme.skyboxPath);
  }

  document.documentElement.style.setProperty('--theme-color-mauve', theme.colors.primary);

  const crosshair = document.getElementById('crosshair');
  if (crosshair) {
    crosshair.style.borderColor = theme.colors.crosshairOutline;
    crosshair.style.backgroundColor = theme.colors.crosshairInner;
  }
}

const performRestart = () => {
  isGameOver = false;
  ui.toggleGameOver(false);

  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  player.respawn();
  levelLoader.loadLevel('infinite');

  if (currentTheme) {
    levelLoader.updateChunkColors(currentTheme.colors);
  }

  document.body.requestPointerLock();
};

function setupEventListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  ui.onResume = () => {
    if (ui.checkModeChanged()) {
      performRestart();
    } else {
      document.body.requestPointerLock();
    }
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

      if (ui.checkModeChanged()) {
        performRestart();
      }

    } else {
      if (!isGameOver) {
        isPaused = true;
        ui.toggleMenu(true);
      }
    }
  });

  window.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    if (ui.isBinding) return;

    const bindings = authManager.settings.keybindings;
    if (bindings && bindings.reset && bindings.reset.includes(e.code)) {
      performRestart();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Escape' && isPaused && !isGameOver) {
      if (performance.now() - ui.lastBindingTime < 200) return;

      if (ui.handleEscape()) {
        if (performance.now() - lastStateChangeTime > 100) {
          document.body.requestPointerLock();
        }
      }
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// --- LOOP ---
let frameCount = 0;
let lastTime = 0;
let fps = 0;

const PHYSICS_STEP = GAME_CONFIG.World.physicsStep;
let accumulator = 0;
let loopLastTime = performance.now();

function gameLoop() {
  const settings = authManager ? authManager.settings : null;
  const fpsLimit = settings ? (settings.fpsLimit === undefined ? -1 : settings.fpsLimit) : -1;

  if (fpsLimit === -1) {
    requestAnimationFrame(gameLoop);
  } else {
    const safeFps = Math.max(30, fpsLimit);
    const delay = safeFps >= 1000 ? 0 : (1000 / safeFps);
    setTimeout(gameLoop, delay);
  }

  const now = performance.now();

  const dt = Math.min((now - loopLastTime) / 1000, 0.1);
  loopLastTime = now;

  if (!isPaused && !isGameOver && player && levelLoader) {
    accumulator += dt;
    while (accumulator >= PHYSICS_STEP) {
      player.savePreviousPosition();
      world.timestep = PHYSICS_STEP;
      world.step();
      player.updatePhysics(PHYSICS_STEP);
      levelLoader.update(player.body.translation().z, player.getSpeed(), player.body.translation().y);

      const isDeadlyCollision = player.groundColliderHandle !== undefined && levelLoader.checkDeathCollision(player.groundColliderHandle);
      const isFallen = player.body.translation().y < (levelLoader.getMinY() + GAME_CONFIG.World.deathThreshold);

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

          ui.showGameOver(score);

          authManager.saveScore(score).then((result) => {
            ui.updateGameOverHighscore(result.currentHighScore, result.isNewHighScore, !!authManager.currentUser);
          }).catch((error) => {
            console.error("Failed to save score:", error);
            ui.updateGameOverHighscore(score, false, !!authManager.currentUser);
          });
        }
      } accumulator -= PHYSICS_STEP;
    }
  }

  const alpha = accumulator / PHYSICS_STEP;
  if (!isPaused && !isGameOver && player) {
    player.updateVisuals(dt);
    player.syncCamera(alpha);
  }

  frameCount++;
  if (now - lastTime >= 1000) {
    fps = frameCount;
    frameCount = 0;
    lastTime = now;
  }

  if (player) {
    const speed = player.getSpeed();
    const distance = Math.max(0, player.body.translation().z);
    ui.update(fps, speed, distance);
  }

  renderer.render(scene, camera);
}
