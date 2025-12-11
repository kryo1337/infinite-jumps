import type { User } from 'firebase/auth';
import { GAME_STATE, SKYBOX_OPTIONS, DEFAULT_THEME } from './config';
import type { Theme, ThemeColors } from './config';

export class UIManager {
  private hud: HTMLElement;
  private hudFps!: HTMLElement;
  private hudSpeed!: HTMLElement;
  private hudScore!: HTMLElement;
  private nickInput!: HTMLInputElement;
  private nickRow!: HTMLElement;

  public mainMenu!: HTMLElement;
  public settingsMenu!: HTMLElement;
  public gameModeMenu!: HTMLElement;
  public authModal!: HTMLElement;
  public gameOverMenu!: HTMLElement;
  public leaderboardMenu!: HTMLElement;
  public visualsMenu!: HTMLElement;

  public returnBtn!: HTMLElement;
  public gamemodeBtn!: HTMLElement;
  public settingsBtn!: HTMLElement;
  public leaderboardBtn!: HTMLElement;
  public visualsBtn!: HTMLElement;

  public settingsBackBtn!: HTMLElement;
  public settingsApplyBtn!: HTMLElement;

  private gamemodeBackBtn!: HTMLElement;
  private gamemodeApplyBtn!: HTMLElement;
  private currentMode: string = 'bhop_surf';
  private currentDifficulty: string = 'normal';

  private pendingMode: string = 'bhop_surf';
  private pendingDifficulty: string = 'normal';

  private lbList!: HTMLElement;
  private lbBackBtn!: HTMLElement;

  public onPlayAgain: (() => void) | null = null;
  public onShowLeaderboard: ((mode: string, difficulty: string, requestId: number) => void) | null = null;

  public userHeader!: HTMLElement;
  private userDropdown!: HTMLElement;
  private footer!: HTMLElement;

  private authError!: HTMLElement;

  public onResume: (() => void) | null = null;
  public onLoadLevel: ((type: 'infinite') => void) | null = null;

  public onLoginGoogleRequest: (() => void) | null = null;
  public onLogoutRequest: (() => void) | null = null;

  public onApplySettings: ((settings: { sensitivity: number, nickname?: string, fpsLimit: number, keybindings: { [action: string]: string[] } }) => Promise<void>) | null = null;

  public onApplyTheme: ((theme: Theme) => Promise<void>) | null = null;
  public onSelectTheme: ((theme: Theme) => Promise<void>) | null = null;
  public onLoadUserThemes: (() => Promise<Theme[]>) | null = null;
  public onDeleteTheme: ((themeId: string) => Promise<void>) | null = null;
  public onImportTheme: ((themeId: string) => Promise<Theme | null>) | null = null;
  public onBookmarkTheme: ((themeId: string) => Promise<void>) | null = null;

  private lastUpdate: number = 0;
  private lastColor: string = '';

  private pendingSensitivity: number;
  private pendingFpsLimit: number = -1;
  private pendingNickname: string = '';
  private pendingKeybindings: { [action: string]: string[] } = {};
  private cleanKeybindings: { [action: string]: string[] } = {};
  private bindingCleanup: (() => void) | null = null;
  public isBinding: boolean = false;

  private viewedMode: string = GAME_STATE.currentMode;
  private viewedDifficulty: string = GAME_STATE.currentDifficulty;

  private isLoggedIn: boolean = false;
  private isAuthModalOpen: boolean = false;
  private previousMenu: HTMLElement | null = null;

  public lastBindingTime: number = 0;
  private vsyncOnBtn!: HTMLElement;
  private vsyncOffBtn!: HTMLElement;
  private fpsInput!: HTMLInputElement;
  private fpsVal!: HTMLElement;
  private sensInput!: HTMLInputElement;
  private sensVal!: HTMLElement;
  private bindButtons: HTMLElement[] = [];
  private bindWarning!: HTMLElement;

  private loadingScreen!: HTMLElement;
  private loadingBar!: HTMLElement;
  private loadingDetails!: HTMLElement;

  private isVsyncEnabled: boolean = false;

  private hasModeChanged: boolean = false;

  private visualsThemeList!: HTMLElement;
  private visualsError!: HTMLElement;
  private themeNameInput!: HTMLInputElement;
  private skyboxSelect!: HTMLSelectElement;
  private importInput!: HTMLInputElement;
  private colorPickers: Map<keyof ThemeColors, {
    swatch: HTMLElement;
    hexDisplay: HTMLElement;
    hexInput: HTMLInputElement;
    rSlider: HTMLInputElement;
    gSlider: HTMLInputElement;
    bSlider: HTMLInputElement;
    rValue: HTMLElement;
    gValue: HTMLElement;
    bValue: HTMLElement;
  }> = new Map();
  public editingThemeId: string | null = null;

  public activeTheme: Theme = DEFAULT_THEME;

  constructor(defaultSensitivity: number) {
    this.pendingSensitivity = defaultSensitivity;

    this.currentMode = GAME_STATE.currentMode;
    this.currentDifficulty = GAME_STATE.currentDifficulty;
    this.pendingMode = this.currentMode;
    this.pendingDifficulty = this.currentDifficulty;

    // --- LOADING SCREEN ---
    this.loadingScreen = document.createElement('div');
    this.loadingScreen.id = 'loading-screen';
    this.loadingScreen.innerHTML = `
      <div class="loading-title">INFINITE JUMPS</div>
      <div id="loading-status" class="loading-status">Initializing...</div>
      <div class="loading-bar-container">
        <div id="loading-bar-fill" class="loading-bar-fill"></div>
      </div>
      <div id="hw-warning" class="hw-warning hidden">⚠ Turn on hardware acceleration for better experience</div>
    `;
    document.body.appendChild(this.loadingScreen);
    this.loadingBar = this.loadingScreen.querySelector('#loading-bar-fill') as HTMLElement;
    this.loadingDetails = this.loadingScreen.querySelector('#loading-status') as HTMLElement;

    // --- HUD ---
    this.hud = document.createElement('div');
    this.hud.className = 'hud';
    this.hud.innerHTML = 'FPS: <span id="hud-fps">0</span><br>Speed: <span id="hud-speed">0.00</span> u/s<br>Score: <span id="hud-score">0.00</span>';
    document.body.appendChild(this.hud);

    this.hudFps = this.hud.querySelector('#hud-fps') as HTMLElement;
    this.hudSpeed = this.hud.querySelector('#hud-speed') as HTMLElement;
    this.hudScore = this.hud.querySelector('#hud-score') as HTMLElement;

    // --- USER HEADER ---
    this.userHeader = document.createElement('div');
    this.userHeader.id = 'user-header';
    this.userHeader.classList.add('hidden');

    this.userHeader.addEventListener('click', (e) => e.stopPropagation());
    this.userHeader.addEventListener('mousedown', (e) => e.stopPropagation());

    document.body.appendChild(this.userHeader);

    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (this.userDropdown && !this.userDropdown.classList.contains('hidden')) {
        if (!this.userHeader.contains(target)) {
          this.userDropdown.classList.add('hidden');
        }
      }
    });

    // --- MENUS ---
    this.mainMenu = this.createMainMenu();
    this.settingsMenu = this.createSettingsMenu(defaultSensitivity);
    this.gameModeMenu = this.createGameModeMenu();
    this.authModal = this.createAuthModal();
    this.gameOverMenu = this.createGameOverMenu();
    this.leaderboardMenu = this.createLeaderboardMenu();
    this.visualsMenu = this.createVisualsMenu();

    document.body.appendChild(this.mainMenu);
    document.body.appendChild(this.settingsMenu);
    document.body.appendChild(this.gameModeMenu);
    document.body.appendChild(this.authModal);
    document.body.appendChild(this.gameOverMenu);
    document.body.appendChild(this.leaderboardMenu);
    document.body.appendChild(this.visualsMenu);

    // --- FOOTER ---
    this.createFooter();

    // --- CROSSHAIR ---
    const crosshair = document.createElement('div');
    crosshair.id = 'crosshair';
    document.body.appendChild(crosshair);

    this.updateUserHeader(null);

    this.setupEventListeners();
  }

  private createFooter() {
    this.footer = document.createElement('footer');
    this.footer.classList.add('hidden');

    this.footer.addEventListener('click', (e) => e.stopPropagation());
    this.footer.addEventListener('mousedown', (e) => e.stopPropagation());

    this.footer.innerHTML = `
      <div class="footer-left">
          <span>Developed by <a href="https://kryo.dev" target="_blank">kryo</a></span>
          <span class="separator">|</span>
          <span>&copy; 2025 Infinite Jumps</span>
      </div>
      <div class="footer-right">
           <a href="https://buymeacoffee.com/kryo" target="_blank" aria-label="Buy Me a Coffee">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 5h-2V5h2v3M4 19h16v2H4z"/></svg>
           </a>
           <a href="https://github.com/kryo1337/infinite-jumps" target="_blank" aria-label="GitHub">
             <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
           </a>
      </div>
    `;
    document.body.appendChild(this.footer);
  }

  private createMainMenu(): HTMLElement {
    const menu = document.createElement('div');
    menu.id = 'game-menu';
    menu.className = 'menu-overlay hidden';

    const content = document.createElement('div');
    content.innerHTML =
      '<h1 class="menu-title">Infinite Jumps</h1>' +
      '<div id="offline-indicator" class="offline-indicator hidden">ONLINE SERVICES UNAVAILABLE</div>' +
      '<button id="btn-return" class="menu-btn">Resume</button>' +
      '<button id="btn-gamemode" class="menu-btn">Change Game Mode</button>' +
      '<button id="btn-leaderboard" class="menu-btn">Leaderboard</button>' +
      '<button id="btn-settings" class="menu-btn">Settings</button>' +
      '<button id="btn-visuals" class="menu-btn">Visuals</button>';
    menu.appendChild(content);

    menu.addEventListener('click', (e) => e.stopPropagation());
    menu.addEventListener('mousedown', (e) => e.stopPropagation());

    this.returnBtn = menu.querySelector('#btn-return') as HTMLElement;
    this.gamemodeBtn = menu.querySelector('#btn-gamemode') as HTMLElement;
    this.leaderboardBtn = menu.querySelector('#btn-leaderboard') as HTMLElement;
    this.settingsBtn = menu.querySelector('#btn-settings') as HTMLElement;
    this.visualsBtn = menu.querySelector('#btn-visuals') as HTMLElement;

    return menu;
  }

  private createGameModeMenu(): HTMLElement {
    const menu = document.createElement('div');
    menu.id = 'gamemode-menu';
    menu.className = 'menu-overlay hidden';

    menu.innerHTML = `
      <h1 class="menu-title">Game Modes</h1>
      <div class="settings-scroll-container">
        
        <div class="mode-section">
          <div class="mode-header">Only Bhop</div>
          <div class="mode-toggle-group">
            <button class="toggle-btn" data-mode="only_bhop" data-diff="easy">Easy</button>
            <button class="toggle-btn" data-mode="only_bhop" data-diff="normal">Normal</button>
            <button class="toggle-btn" data-mode="only_bhop" data-diff="hard">Hard</button>
          </div>
        </div>

        <div class="mode-section">
          <div class="mode-header">Only Surf</div>
          <div class="mode-toggle-group">
             <button class="toggle-btn" data-mode="only_surf" data-diff="easy">Easy</button>
             <button class="toggle-btn" data-mode="only_surf" data-diff="normal">Normal</button>
             <button class="toggle-btn" data-mode="only_surf" data-diff="hard">Hard</button>
          </div>
        </div>

        <div class="mode-section">
          <div class="mode-header">Bhop & Surf</div>
          <div class="mode-toggle-group">
             <button class="toggle-btn" data-mode="bhop_surf" data-diff="easy">Easy</button>
             <button class="toggle-btn active" data-mode="bhop_surf" data-diff="normal">Normal</button>
             <button class="toggle-btn" data-mode="bhop_surf" data-diff="hard">Hard</button>
          </div>
        </div>

        <div class="mode-section">
          <div class="mode-header">Challenge</div>
          <div class="mode-toggle-group">
            <button id="btn-obstacles" class="toggle-btn" data-mode="obstacles" data-diff="normal">Obstacles</button>
          </div>
        </div>

      </div>
      <div class="settings-actions">
        <button id="btn-gamemode-back" class="menu-btn">Back</button>
        <button id="btn-gamemode-apply" class="menu-btn btn-apply">Apply</button>
      </div>
    `;

    menu.addEventListener('click', (e) => e.stopPropagation());
    menu.addEventListener('mousedown', (e) => e.stopPropagation());

    this.gamemodeBackBtn = menu.querySelector('#btn-gamemode-back') as HTMLElement;
    this.gamemodeApplyBtn = menu.querySelector('#btn-gamemode-apply') as HTMLElement;

    const btns = menu.querySelectorAll('.toggle-btn');
    btns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const mode = target.getAttribute('data-mode');
        const diff = target.getAttribute('data-diff');

        if (mode && diff) {
          this.pendingMode = mode;
          this.pendingDifficulty = diff;

          btns.forEach(b => b.classList.remove('active'));
          target.classList.add('active');
        }
      });
    });

    this.gamemodeApplyBtn.addEventListener('click', () => {
      if (this.pendingMode !== this.currentMode || this.pendingDifficulty !== this.currentDifficulty) {
        this.currentMode = this.pendingMode;
        this.currentDifficulty = this.pendingDifficulty;

        GAME_STATE.currentMode = this.pendingMode;
        GAME_STATE.currentDifficulty = this.pendingDifficulty;
        this.hasModeChanged = true;
      }

      this.closeGameModeMenu();
    });

    this.gamemodeBackBtn.addEventListener('click', () => {
      this.closeGameModeMenu();
    });

    return menu;
  }

  private closeGameModeMenu(showMain: boolean = true) {
    this.pendingMode = this.currentMode;
    this.pendingDifficulty = this.currentDifficulty;

    const btns = this.gameModeMenu.querySelectorAll('.toggle-btn');
    btns.forEach(b => {
      b.classList.remove('active');
      const mode = b.getAttribute('data-mode');
      const diff = b.getAttribute('data-diff');
      if (mode === this.currentMode && diff === this.currentDifficulty) {
        b.classList.add('active');
      }
    });

    this.gameModeMenu.classList.add('hidden');
    if (showMain) {
      this.mainMenu.classList.remove('hidden');
    }
  }

  private createAuthModal(): HTMLElement {
    const menu = document.createElement('div');
    menu.id = 'auth-modal';
    menu.className = 'menu-overlay hidden';

    menu.innerHTML = `
      <h1 class="menu-title">Login</h1>
      <div id="auth-error" class="auth-error hidden"></div>
      <button id="btn-auth-google" class="menu-btn">Login with Google</button>
      <button id="btn-auth-back" class="menu-btn btn-top-margin">Back</button>
    `;

    menu.addEventListener('click', (e) => e.stopPropagation());
    menu.addEventListener('mousedown', (e) => e.stopPropagation());

    this.authError = menu.querySelector('#auth-error') as HTMLElement;

    const btnGoogle = menu.querySelector('#btn-auth-google') as HTMLElement;
    const btnBack = menu.querySelector('#btn-auth-back') as HTMLElement;

    btnGoogle.addEventListener('click', () => {
      this.hideAuthError();
      if (this.onLoginGoogleRequest) this.onLoginGoogleRequest();
    });

    btnBack.addEventListener('click', () => {
      this.toggleAuthModal(false);
    });

    return menu;
  }

  private createGameOverMenu(): HTMLElement {
    const menu = document.createElement('div');
    menu.id = 'game-over-menu';
    menu.className = 'menu-overlay hidden';

    menu.innerHTML = `
      <h1 class="menu-title">GAME OVER</h1>
      
      <div id="go-new-record" class="hidden">NEW HIGHSCORE!</div>
      <div id="go-score">SCORE: 0.00</div>
      <div id="go-highscore">Highscore: 0.00</div>
      <div id="go-login-msg" class="hidden" style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
        <span>(LOG IN to be visible in leaderboard)</span>
        <button id="btn-go-login" class="visuals-login-btn">LOG IN</button>
      </div>
      
      <button id="btn-play-again" class="menu-btn">PLAY AGAIN</button>
    `;

    menu.addEventListener('click', (e) => e.stopPropagation());
    menu.addEventListener('mousedown', (e) => e.stopPropagation());

    const btnPlayAgain = menu.querySelector('#btn-play-again') as HTMLElement;
    const btnGoLogin = menu.querySelector('#btn-go-login') as HTMLElement;

    btnPlayAgain.addEventListener('click', () => {
      if (this.onPlayAgain) this.onPlayAgain();
    });

    btnGoLogin.addEventListener('click', () => {
      this.toggleAuthModal(true);
    });

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' && !this.gameOverMenu.classList.contains('hidden')) {
        if (this.onPlayAgain) this.onPlayAgain();
      }
    });

    return menu;
  }

  private createLeaderboardMenu(): HTMLElement {
    const menu = document.createElement('div');
    menu.id = 'leaderboard-menu';
    menu.className = 'menu-overlay hidden';

    menu.innerHTML = `
      <h1 class="menu-title">Leaderboard</h1>

      <div class="mode-section">
        <div class="mode-toggle-group">
          <button class="toggle-btn" data-lb-mode="only_bhop">Bhop</button>
          <button class="toggle-btn" data-lb-mode="only_surf">Surf</button>
          <button class="toggle-btn active" data-lb-mode="bhop_surf">BHOP & SURF</button>
          <button class="toggle-btn" data-lb-mode="obstacles">Obstacles</button>
        </div>
      </div>
      
      <div class="mode-section">
        <div class="mode-toggle-group">
          <button class="toggle-btn" data-lb-diff="easy">Easy</button>
          <button class="toggle-btn active" data-lb-diff="normal">Normal</button>
          <button class="toggle-btn" data-lb-diff="hard">Hard</button>
        </div>
      </div>

      <div class="leaderboard-container">
        <div class="lb-header">
          <span>Rank</span>
          <span>Nickname</span>
          <span>Score</span>
        </div>
        <div id="lb-list" class="lb-list">
          <!-- Entries injected here -->
        </div>
      </div>
      <button id="btn-lb-back" class="menu-btn btn-top-margin">BACK</button>
    `;

    menu.addEventListener('click', (e) => e.stopPropagation());
    menu.addEventListener('mousedown', (e) => e.stopPropagation());

    this.lbList = menu.querySelector('#lb-list') as HTMLElement;
    this.lbBackBtn = menu.querySelector('#btn-lb-back') as HTMLElement;

    const modeBtns = menu.querySelectorAll('button[data-lb-mode]');
    const diffBtns = menu.querySelectorAll('button[data-lb-diff]');

    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-lb-mode')!;
        this.viewedMode = mode;

        if (mode === 'obstacles') {
          this.viewedDifficulty = 'normal';
        }

        this.refreshLeaderboard();
      });
    });

    diffBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('disabled')) return;

        this.viewedDifficulty = btn.getAttribute('data-lb-diff')!;
        this.refreshLeaderboard();
      });
    });

    this.lbBackBtn.addEventListener('click', () => {
      this.leaderboardMenu.classList.add('hidden');
      this.mainMenu.classList.remove('hidden');
    });

    return menu;
  }

  private currentLeaderboardRequestId: number = 0;

  private refreshLeaderboard() {
    this.updateLeaderboardUIState();
    this.lbList.innerHTML = '<div class="lb-empty">Loading...</div>';

    const requestId = ++this.currentLeaderboardRequestId;

    if (this.onShowLeaderboard) {
      this.onShowLeaderboard(this.viewedMode, this.viewedDifficulty, requestId);
    }
  }

  private updateLeaderboardUIState() {
    const modeBtns = this.leaderboardMenu.querySelectorAll('button[data-lb-mode]');
    modeBtns.forEach(b => {
      const mode = b.getAttribute('data-lb-mode');

      if (mode === this.viewedMode) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }

      if (mode === GAME_STATE.currentMode) {
        b.classList.add('current-game-state');
      } else {
        b.classList.remove('current-game-state');
      }
    });

    const diffBtns = this.leaderboardMenu.querySelectorAll('button[data-lb-diff]');
    const isObstacles = (this.viewedMode === 'obstacles');

    diffBtns.forEach(b => {
      const diff = b.getAttribute('data-lb-diff');

      if (diff === this.viewedDifficulty) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }

      if (diff === GAME_STATE.currentDifficulty) {
        b.classList.add('current-game-state');
      } else {
        b.classList.remove('current-game-state');
      }

      if (isObstacles) {
        if (diff !== 'normal') {
          b.classList.add('disabled');
        } else {
          b.classList.remove('disabled');
        }
      } else {
        b.classList.remove('disabled');
      }
    });
  }

  public setOfflineMode(isOffline: boolean) {
    const indicator = this.mainMenu.querySelector('#offline-indicator');
    if (indicator) {
      if (isOffline) {
        indicator.classList.remove('hidden');
      } else {
        indicator.classList.add('hidden');
      }
    }
  }

  public showGameOver(score: number) {
    const elNewRecord = this.gameOverMenu.querySelector('#go-new-record') as HTMLElement;
    const elScore = this.gameOverMenu.querySelector('#go-score') as HTMLElement;
    const elHighscore = this.gameOverMenu.querySelector('#go-highscore') as HTMLElement;

    elScore.textContent = `SCORE: ${score.toFixed(2)}`;
    elHighscore.textContent = `Highscore: ...`;
    elNewRecord.classList.add('hidden');

    this.toggleGameOver(true);
  }

  public updateGameOverHighscore(highScore: number, isNewRecord: boolean, isLoggedIn: boolean) {
    const elNewRecord = this.gameOverMenu.querySelector('#go-new-record') as HTMLElement;
    const elHighscore = this.gameOverMenu.querySelector('#go-highscore') as HTMLElement;

    elHighscore.textContent = `Highscore: ${highScore.toFixed(2)}`;

    if (isNewRecord) {
      elNewRecord.classList.remove('hidden');
    } else {
      elNewRecord.classList.add('hidden');
    }

    this.updateGameOverLoginMessage(isLoggedIn);
  }

  public updateGameOverLoginMessage(isLoggedIn: boolean) {
    const elLoginMsg = this.gameOverMenu.querySelector('#go-login-msg') as HTMLElement;
    if (isLoggedIn) {
      elLoginMsg.classList.add('hidden');
    } else {
      elLoginMsg.classList.remove('hidden');
    }
  }

  public toggleGameOver(isOpen: boolean) {
    if (isOpen) {
      this.mainMenu.classList.add('hidden');
      this.settingsMenu.classList.add('hidden');
      this.authModal.classList.add('hidden');
      this.leaderboardMenu.classList.add('hidden');
      this.gameModeMenu.classList.add('hidden');
      this.gameOverMenu.classList.remove('hidden');

      this.footer.classList.remove('hidden');
      this.userHeader.classList.remove('hidden');
      this.hud.style.display = 'none';
      document.exitPointerLock();
    } else {
      this.gameOverMenu.classList.add('hidden');
    }
  }

  public updateLeaderboard(entries: any[], mode: string, difficulty: string, requestId: number) {
    if (requestId !== this.currentLeaderboardRequestId) {
      return;
    }

    if (mode !== this.viewedMode || difficulty !== this.viewedDifficulty) {
      return;
    }

    this.lbList.innerHTML = '';

    if (entries.length === 0) {
      this.lbList.innerHTML = '<div class="lb-empty">No records yet. Be the first!</div>';
      return;
    }

    entries.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'lb-row';

      if (this.isLoggedIn && this.userHeader.querySelector('#user-nickname')?.textContent === entry.nickname) {
        row.classList.add('lb-highlight');
      }

      const rankSpan = document.createElement('span');
      rankSpan.className = 'lb-rank';
      rankSpan.textContent = `#${entry.rank}`;

      const nickSpan = document.createElement('span');
      nickSpan.className = 'lb-nick';
      nickSpan.textContent = entry.nickname;

      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'lb-score';
      scoreSpan.textContent = entry.score.toFixed(2);

      row.appendChild(rankSpan);
      row.appendChild(nickSpan);
      row.appendChild(scoreSpan);

      this.lbList.appendChild(row);
    });
  }

  public updateUserHeader(user: User | null, nickname?: string) {
    this.isLoggedIn = !!user;
    this.updateSettingsVisibility();
    this.userHeader.innerHTML = '';
    if (user) {
      const displayName = nickname || user.displayName || 'Player';

      const nameSpan = document.createElement('span');
      nameSpan.id = 'user-nickname';
      nameSpan.textContent = displayName;

      this.userDropdown = document.createElement('div');
      this.userDropdown.className = 'user-dropdown hidden';
      this.userDropdown.innerHTML = `<button id="btn-logout">LOG OUT</button>`;

      this.userHeader.appendChild(nameSpan);
      this.userHeader.appendChild(this.userDropdown);

      nameSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        this.userDropdown.classList.toggle('hidden');
      });

      const logoutBtn = this.userDropdown.querySelector('#btn-logout') as HTMLElement;
      logoutBtn.addEventListener('click', () => {
        if (this.onLogoutRequest) this.onLogoutRequest();
        this.userDropdown.classList.add('hidden');
      });

    } else {
      this.userHeader.innerHTML = `<button id="btn-login">LOG IN</button>`;
      const loginBtn = this.userHeader.querySelector('#btn-login') as HTMLElement;
      loginBtn.addEventListener('click', () => {
        this.toggleAuthModal(true);
      });
    }
  }

  private updateSettingsVisibility() {
    const graphicsSection = this.settingsMenu.querySelector('#section-graphics');
    if (this.isLoggedIn) {
      this.nickRow.classList.remove('hidden');
      if (graphicsSection) graphicsSection.classList.add('force-border-top');
    } else {
      this.nickRow.classList.add('hidden');
      if (graphicsSection) graphicsSection.classList.remove('force-border-top');
    }
  }

  private createSettingsMenu(defaultSensitivity: number): HTMLElement {
    const menu = document.createElement('div');
    menu.id = 'settings-menu';
    menu.className = 'menu-overlay hidden';

    menu.innerHTML = `
      <h1 class="menu-title">Settings</h1>

      <div class="settings-scroll-container">
        <!-- Nickname -->
        <div class="setting-row hidden" id="row-nickname">
          <label>Nickname</label>
          <input type="text" id="nickname-input" placeholder="Enter nickname" maxlength="12">
        </div>

        <div class="controls-section" id="section-graphics">
          <div class="controls-title">Graphics</div>

          <!-- VSync -->
          <div class="setting-row">
            <label>VSync</label>
            <div style="flex-grow: 1; display: flex; justify-content: flex-start;">
               <div class="toggle-group">
                 <button id="btn-vsync-on" class="toggle-btn">ON</button>
                 <button id="btn-vsync-off" class="toggle-btn">OFF</button>
               </div>
            </div>
            <span></span>
          </div>

          <!-- FPS Limit -->
          <div class="setting-row" id="row-fps">
            <label>Max FPS</label>
            <input type="range" id="fps-cap" class="settings-slider" min="30" max="1000" step="10" value="1000">
            <span id="fps-val">Unlimited</span>
          </div>

          <!-- Sensitivity -->
          <div class="setting-row">
            <label>Sensitivity</label>
            <input type="range" id="sens" class="settings-slider" min="0.1" max="10.0" step="0.05" value="${defaultSensitivity}">
            <span id="sens-val">${defaultSensitivity}</span>
          </div>
        </div>

        <!-- Controls -->
        <div class="controls-section">
          <div class="controls-title">Controls</div>
          
          <!-- Forward -->
          <div class="control-row">
            <span>Move Forward</span>
            <div class="control-buttons">
              <button class="bind-btn" data-action="forward" data-index="0">W</button>
              <button class="bind-btn" data-action="forward" data-index="1">NONE</button>
            </div>
          </div>

          <!-- Backward -->
          <div class="control-row">
            <span>Move Backward</span>
            <div class="control-buttons">
              <button class="bind-btn" data-action="backward" data-index="0">S</button>
              <button class="bind-btn" data-action="backward" data-index="1">NONE</button>
            </div>
          </div>

          <!-- Left -->
          <div class="control-row">
            <span>Move Left</span>
            <div class="control-buttons">
              <button class="bind-btn" data-action="left" data-index="0">A</button>
              <button class="bind-btn" data-action="left" data-index="1">NONE</button>
            </div>
          </div>

          <!-- Right -->
          <div class="control-row">
            <span>Move Right</span>
            <div class="control-buttons">
              <button class="bind-btn" data-action="right" data-index="0">D</button>
              <button class="bind-btn" data-action="right" data-index="1">NONE</button>
            </div>
          </div>

           <!-- Reset -->
          <div class="control-row">
            <span>Reset</span>
            <div class="control-buttons">
              <button class="bind-btn" data-action="reset" data-index="0">R</button>
              <button class="bind-btn" data-action="reset" data-index="1">NONE</button>
            </div>
          </div>

           <!-- Jump -->
          <div class="control-row">
            <span>Jump</span>
            <div class="control-buttons">
              <button class="bind-btn" data-action="jump" data-index="0">Space</button>
              <button class="bind-btn" data-action="jump" data-index="1">WheelUp</button>
              <button class="bind-btn" data-action="jump" data-index="2">WheelDown</button>
            </div>
          </div>

          <div id="bind-warning"></div>
        </div>
      </div>

      <div id="settings-error" class="settings-error hidden"></div>

      <div class="settings-actions">
        <button id="btn-settings-back" class="menu-btn">BACK</button>
        <button id="btn-settings-apply" class="menu-btn btn-apply">APPLY</button>
      </div>
    `;

    menu.addEventListener('click', (e) => e.stopPropagation());
    menu.addEventListener('mousedown', (e) => e.stopPropagation());

    this.settingsBackBtn = menu.querySelector('#btn-settings-back') as HTMLElement;
    this.settingsApplyBtn = menu.querySelector('#btn-settings-apply') as HTMLElement;

    this.sensInput = menu.querySelector('#sens') as HTMLInputElement;
    this.sensVal = menu.querySelector('#sens-val') as HTMLElement;

    this.vsyncOnBtn = menu.querySelector('#btn-vsync-on') as HTMLElement;
    this.vsyncOffBtn = menu.querySelector('#btn-vsync-off') as HTMLElement;

    this.fpsInput = menu.querySelector('#fps-cap') as HTMLInputElement;
    this.fpsVal = menu.querySelector('#fps-val') as HTMLElement;

    this.nickRow = menu.querySelector('#row-nickname') as HTMLElement;
    this.nickInput = menu.querySelector('#nickname-input') as HTMLInputElement;

    this.bindButtons = Array.from(menu.querySelectorAll('.bind-btn'));
    this.bindWarning = menu.querySelector('#bind-warning') as HTMLElement;

    const settingsError = menu.querySelector('#settings-error') as HTMLElement;
    this.nickInput.addEventListener('input', () => settingsError.classList.add('hidden'));

    return menu;
  }

  public showSettingsError(msg: string) {
    const el = this.settingsMenu.querySelector('#settings-error') as HTMLElement;
    if (el) {
      el.textContent = msg;
      el.classList.remove('hidden');
    }
  }

  private setupEventListeners() {
    this.returnBtn.addEventListener('click', () => {
      if (this.onResume) this.onResume();
    });

    this.gamemodeBtn.addEventListener('click', () => {
      this.mainMenu.classList.add('hidden');
      this.gameModeMenu.classList.remove('hidden');
    });

    this.leaderboardBtn.addEventListener('click', () => {
      this.mainMenu.classList.add('hidden');
      this.leaderboardMenu.classList.remove('hidden');

      this.viewedMode = GAME_STATE.currentMode;
      this.viewedDifficulty = GAME_STATE.currentDifficulty;

      this.refreshLeaderboard();
    });
    this.settingsBtn.addEventListener('click', () => this.toggleSettings(true));
    this.visualsBtn.addEventListener('click', () => this.toggleVisuals(true));

    this.settingsBackBtn.addEventListener('click', () => {
      this.toggleSettings(false);
    });

    this.settingsApplyBtn.addEventListener('click', () => {
      const newSens = parseFloat(this.sensInput.value);
      const newNick = this.nickInput.value;

      let newFps = parseInt(this.fpsInput.value, 10);
      if (this.isVsyncEnabled) newFps = -1;

      this.pendingSensitivity = newSens;
      this.pendingNickname = newNick;
      this.pendingFpsLimit = newFps;
      this.cleanKeybindings = JSON.parse(JSON.stringify(this.pendingKeybindings));

      if (this.onApplySettings) {
        this.onApplySettings({
          sensitivity: newSens,
          nickname: newNick,
          fpsLimit: this.pendingFpsLimit,
          keybindings: { ...this.pendingKeybindings }
        });
      }
    });

    this.sensInput.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.sensVal.textContent = val.toFixed(2);
    });

    this.vsyncOnBtn.addEventListener('click', () => {
      this.setVsyncState(true);
      this.toggleFpsSlider(false);
    });

    this.vsyncOffBtn.addEventListener('click', () => {
      this.setVsyncState(false);
      this.toggleFpsSlider(true);
    });

    this.fpsInput.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      this.updateFpsDisplay(val);
    });

    this.bindButtons.forEach(btn => {
      btn.addEventListener('click', () => this.startBinding(btn));
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.clearBinding(btn);
      });
    });
  }

  private setVsyncState(enabled: boolean) {
    this.isVsyncEnabled = enabled;
    if (enabled) {
      this.vsyncOnBtn.classList.add('active');
      this.vsyncOffBtn.classList.remove('active');
    } else {
      this.vsyncOnBtn.classList.remove('active');
      this.vsyncOffBtn.classList.add('active');
    }
  }

  private toggleFpsSlider(enabled: boolean) {
    this.fpsInput.disabled = !enabled;
    const row = this.fpsInput.parentElement;
    if (row) {
      if (!enabled) {
        row.style.opacity = '0.5';
        this.fpsVal.textContent = 'Monitor';
      } else {
        row.style.opacity = '1';
        this.updateFpsDisplay(parseInt(this.fpsInput.value, 10));
      }
    }
  }

  private updateFpsDisplay(val: number) {
    if (val >= 1000) {
      this.fpsVal.textContent = 'Unlimited';
      this.fpsVal.style.fontSize = '0.8em';
    } else {
      this.fpsVal.textContent = val.toString();
      this.fpsVal.style.fontSize = '1em';
    }
  }

  private startBinding(btn: HTMLElement) {
    if (btn.classList.contains('recording')) return;

    this.isBinding = true;
    const originalText = btn.textContent;
    btn.textContent = '> PRESS KEY <';
    btn.classList.add('recording');

    const action = btn.getAttribute('data-action')!;
    const index = parseInt(btn.getAttribute('data-index')!, 10);

    const cleanup = () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onMouse);
      window.removeEventListener('wheel', onWheel);
      btn.classList.remove('recording');
      this.isBinding = false;
    };

    this.bindingCleanup = () => {
      cleanup();
      btn.textContent = originalText;
    };

    const finish = (code: string | null) => {
      if (this.bindingCleanup) {
        this.bindingCleanup();
        this.bindingCleanup = null;
      }

      this.lastBindingTime = performance.now();

      if (code) {
        if (code === 'Escape') {
          this.clearBinding(btn);
        } else {
          this.setBinding(action, index, code);
        }
      } else {
        btn.textContent = originalText;
      }
    };

    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      finish(e.code);
    };

    const onMouse = () => {
      finish(null);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const code = e.deltaY < 0 ? 'WheelUp' : 'WheelDown';
      finish(code);
    };

    setTimeout(() => {
      window.addEventListener('keydown', onKey);
      window.addEventListener('mousedown', onMouse);
      window.addEventListener('wheel', onWheel, { passive: false });
    }, 50);
  }

  private setBinding(action: string, index: number, code: string) {
    if (!this.pendingKeybindings[action]) {
      this.pendingKeybindings[action] = [];
    }
    while (this.pendingKeybindings[action].length <= index) {
      this.pendingKeybindings[action].push('NONE');
    }

    this.pendingKeybindings[action][index] = code;
    this.updateBindButtons(this.pendingKeybindings);
  }

  private clearBinding(btn: HTMLElement) {
    const action = btn.getAttribute('data-action')!;
    const index = parseInt(btn.getAttribute('data-index')!, 10);

    if (this.pendingKeybindings[action] && this.pendingKeybindings[action][index]) {
      this.pendingKeybindings[action][index] = 'NONE';
      this.updateBindButtons(this.pendingKeybindings);
    }
  }

  private updateBindButtons(bindings: { [action: string]: string[] }) {
    const keyUsage: Map<string, string[]> = new Map();

    for (const action in bindings) {
      bindings[action].forEach(key => {
        if (key && key !== 'NONE') {
          if (!keyUsage.has(key)) keyUsage.set(key, []);
          keyUsage.get(key)!.push(action);
        }
      });
    }

    let conflicts: string[] = [];
    const conflictingKeys = new Set<string>();

    keyUsage.forEach((actions, key) => {
      if (actions.length > 1) {
        const uniqueActions = [...new Set(actions)];
        if (uniqueActions.length > 1) {
          conflictingKeys.add(key);
          conflicts.push(`${key.replace('Key', '')} is bound to: ${uniqueActions.join(', ').toUpperCase()}`);
        }
      }
    });

    if (conflicts.length > 0) {
      this.bindWarning.innerText = conflicts.join('\n');
    } else {
      this.bindWarning.textContent = '';
    }

    this.bindButtons.forEach(btn => {
      const action = btn.getAttribute('data-action')!;
      const index = parseInt(btn.getAttribute('data-index')!, 10);

      let code = 'NONE';
      if (bindings[action] && bindings[action][index]) {
        code = bindings[action][index];
      }

      btn.className = 'bind-btn';
      if (code === 'NONE') btn.classList.add('empty');

      if (code !== 'NONE') {
        btn.textContent = code.replace('Key', '');
        if (conflictingKeys.has(code)) {
          btn.classList.add('conflict');
        }
      } else {
        btn.textContent = 'NONE';
      }
    });
  }

  public toggleMenu(isOpen: boolean) {
    if (isOpen) {
      this.mainMenu.classList.remove('hidden');
      this.settingsMenu.classList.add('hidden');
      this.authModal.classList.add('hidden');
      this.gameOverMenu.classList.add('hidden');
      this.leaderboardMenu.classList.add('hidden');
      this.gameModeMenu.classList.add('hidden');
      this.visualsMenu.classList.add('hidden');
      this.footer.classList.remove('hidden');
      this.userHeader.classList.remove('hidden');
      this.hud.style.display = 'none';
      document.exitPointerLock();
    } else {
      this.mainMenu.classList.add('hidden');

      if (!this.settingsMenu.classList.contains('hidden')) {
        this.closeSettingsInternal();
      }
      this.settingsMenu.classList.add('hidden');

      this.authModal.classList.add('hidden');
      this.gameOverMenu.classList.add('hidden');
      this.leaderboardMenu.classList.add('hidden');
      this.visualsMenu.classList.add('hidden');

      if (!this.gameModeMenu.classList.contains('hidden')) {
        this.closeGameModeMenu(false);
      } else {
        this.gameModeMenu.classList.add('hidden');
      }

      this.footer.classList.add('hidden');
      this.userHeader.classList.add('hidden');

      if (this.userDropdown) this.userDropdown.classList.add('hidden');

      this.hud.style.display = 'block';
    }
  }

  private closeSettingsInternal() {
    if (this.bindingCleanup) {
      this.bindingCleanup();
      this.bindingCleanup = null;
    }
    this.revertSettings();
    this.settingsMenu.classList.add('hidden');
  }

  public toggleAuthModal(isOpen: boolean) {
    if (isOpen) {
      this.previousMenu = [
        this.mainMenu,
        this.gameOverMenu,
        this.settingsMenu,
        this.leaderboardMenu,
        this.gameModeMenu,
        this.visualsMenu
      ].find(m => !m.classList.contains('hidden')) || this.mainMenu;

      this.hideAuthError();
      this.mainMenu.classList.add('hidden');
      this.settingsMenu.classList.add('hidden');
      this.gameOverMenu.classList.add('hidden');
      this.leaderboardMenu.classList.add('hidden');
      this.gameModeMenu.classList.add('hidden');
      this.visualsMenu.classList.add('hidden');
      this.authModal.classList.remove('hidden');
      this.isAuthModalOpen = true;
    } else {
      if (!this.isAuthModalOpen) return;

      this.isAuthModalOpen = false;
      this.authModal.classList.add('hidden');
      if (this.previousMenu) {
        if (this.previousMenu === this.settingsMenu) {
          this.toggleSettings(true);
        } else if (this.previousMenu === this.visualsMenu) {
          this.toggleVisuals(true);
        } else {
          this.previousMenu.classList.remove('hidden');
        }
      } else {
        this.mainMenu.classList.remove('hidden');
      }
    }
  }

  public showAuthError(msg: string) {
    if (this.authError) {
      this.authError.textContent = msg;
      this.authError.classList.remove('hidden');
    }
  }

  private hideAuthError() {
    if (this.authError) {
      this.authError.textContent = '';
      this.authError.classList.add('hidden');
    }
  }

  public revertSettings() {
    this.sensInput.value = this.pendingSensitivity.toString();
    this.sensVal.textContent = this.pendingSensitivity.toFixed(2);

    this.fpsInput.value = (this.pendingFpsLimit === -1 ? 1000 : this.pendingFpsLimit).toString();
    this.updateFpsDisplay(this.pendingFpsLimit === -1 ? 1000 : this.pendingFpsLimit);

    this.setVsyncState(this.pendingFpsLimit === -1);
    this.toggleFpsSlider(!this.isVsyncEnabled);

    this.nickInput.value = this.pendingNickname;

    this.pendingKeybindings = JSON.parse(JSON.stringify(this.cleanKeybindings));
    this.updateBindButtons(this.pendingKeybindings);
  }

  public handleEscape(): boolean {
    if (this.isBinding) return false;

    if (!this.authModal.classList.contains('hidden')) {
      this.toggleAuthModal(false);
      return false;
    }

    if (!this.settingsMenu.classList.contains('hidden')) {
      this.toggleSettings(false);
      return false;
    }

    if (!this.leaderboardMenu.classList.contains('hidden')) {
      this.leaderboardMenu.classList.add('hidden');
      this.mainMenu.classList.remove('hidden');
      return false;
    }

    if (!this.gameModeMenu.classList.contains('hidden')) {
      this.closeGameModeMenu();
      return false;
    }

    if (!this.visualsMenu.classList.contains('hidden')) {
      this.toggleVisuals(false);
      return false;
    }

    return true;
  }

  public toggleSettings(isOpen: boolean) {
    if (isOpen) {
      this.updateSettingsVisibility();

      this.mainMenu.classList.add('hidden');
      this.gameOverMenu.classList.add('hidden');
      this.leaderboardMenu.classList.add('hidden');
      this.gameModeMenu.classList.add('hidden');
      this.settingsMenu.classList.remove('hidden');
    } else {
      this.closeSettingsInternal();
      this.mainMenu.classList.remove('hidden');
    }
  }

  public syncSettings(settings: { sensitivity: number, nickname: string, fpsLimit?: number, keybindings?: { [action: string]: string[] } }) {
    this.pendingSensitivity = settings.sensitivity;
    this.pendingNickname = settings.nickname;
    this.pendingFpsLimit = settings.fpsLimit ?? -1;

    if (settings.keybindings) {
      this.cleanKeybindings = JSON.parse(JSON.stringify(settings.keybindings));
    } else {
      this.cleanKeybindings = {};
    }

    this.revertSettings();
  }

  public update(fps: number, speed: number, distance: number) {
    if (performance.now() - this.lastUpdate < 50) return;
    this.lastUpdate = performance.now();

    const color = speed > 20 ? '#f33' : speed > 12 ? '#ff3' : '#fff';
    this.hudFps.textContent = fps.toString();
    this.hudSpeed.textContent = speed.toFixed(2);

    if (color !== this.lastColor) {
      this.hudSpeed.style.color = color;
      this.lastColor = color;
    }

    this.hudScore.textContent = distance.toFixed(2);
  }

  public updateLoading(item: string, percent: number) {
    this.loadingBar.style.width = `${percent}%`;
    this.loadingDetails.textContent = `Loading: ${item}`;
  }

  public showHardwareWarning() {
    const warning = this.loadingScreen.querySelector('#hw-warning');
    if (warning) {
      warning.classList.remove('hidden');
    }
  }

  public hideLoadingScreen() {
    this.loadingScreen.classList.add('fade-out');
    setTimeout(() => {
      this.loadingScreen.classList.add('hidden');
      this.loadingScreen.style.pointerEvents = 'none';
    }, 100);
  }

  public checkModeChanged(): boolean {
    if (this.hasModeChanged) {
      this.hasModeChanged = false;
      return true;
    }
    return false;
  }

  // ===== VISUALS MENU =====

  private createVisualsMenu(): HTMLElement {
    const menu = document.createElement('div');
    menu.id = 'visuals-menu';
    menu.className = 'menu-overlay hidden';

    menu.innerHTML = `
      <h1 class="menu-title">Visuals</h1>
      <div class="visuals-scroll-container">
        <div id="visuals-login-required" class="visuals-login-required hidden">
          <p>Log in to create and share custom themes</p>
          <button class="visuals-login-btn">LOG IN</button>
        </div>

        <div id="visuals-editor-content">
          <!-- Your Themes Section -->
          <div class="visuals-section">
            <div class="visuals-section-title" id="visuals-current-theme-header">Your Themes / Current Theme: Default</div>
            <div id="visuals-theme-list" class="theme-list">
              <div class="theme-list-empty">Loading...</div>
            </div>
          </div>

          <div class="visuals-section">
            <div class="visuals-section-title">Create / Edit Theme</div>
            <div class="theme-editor">
              <div class="theme-editor-row">
                <label>Name</label>
                <input type="text" id="theme-name-input" class="theme-name-input" placeholder="My Theme" maxlength="30">
              </div>
              <div class="theme-editor-row">
                <label>Skybox</label>
                <select id="skybox-select" class="skybox-select">
                  ${SKYBOX_OPTIONS.map(s => {
      const name = s.replace('.hdr', '').replace(/4k$/i, '').replace(/([A-Z])/g, ' $1').trim();
      return `<option value="/textures/skybox/${s}">${name}</option>`;
    }).join('')}
                </select>
              </div>
              <div class="color-pickers-container" id="color-pickers">
              </div>
            </div>
          </div>

          <div class="visuals-section">
            <div class="visuals-section-title">Import Theme</div>
            <div class="import-section">
              <input type="text" id="import-input" class="import-input" placeholder="Enter Share Code">
              <button id="btn-import-theme" class="import-btn">Import</button>
            </div>
          </div>
        </div>
      </div>

      <div id="visuals-error" class="visuals-error hidden"></div>

      <div class="settings-actions">
        <button id="btn-visuals-back" class="menu-btn">BACK</button>
        <button id="btn-visuals-apply" class="menu-btn btn-apply-theme">APPLY</button>
      </div>
    `;

    menu.addEventListener('click', (e) => e.stopPropagation());
    menu.addEventListener('mousedown', (e) => e.stopPropagation());

    this.visualsThemeList = menu.querySelector('#visuals-theme-list') as HTMLElement;
    this.visualsError = menu.querySelector('#visuals-error') as HTMLElement;
    this.themeNameInput = menu.querySelector('#theme-name-input') as HTMLInputElement;
    this.skyboxSelect = menu.querySelector('#skybox-select') as HTMLSelectElement;
    this.importInput = menu.querySelector('#import-input') as HTMLInputElement;

    const colorPickersContainer = menu.querySelector('#color-pickers') as HTMLElement;
    const colorKeys: { key: keyof ThemeColors; label: string }[] = [
      { key: 'primary', label: 'Primary (UI)' },
      { key: 'bhop', label: 'Bhop Blocks' },
      { key: 'surf', label: 'Surf Ramps' },
      { key: 'teleport', label: 'Teleport' },
      { key: 'damage', label: 'Damage' },
      { key: 'crosshairOutline', label: 'Crosshair Outline' },
      { key: 'crosshairInner', label: 'Crosshair Inner' }
    ];

    colorKeys.forEach(({ key, label }) => {
      const picker = this.createColorPicker(key, label, DEFAULT_THEME.colors[key]);
      colorPickersContainer.appendChild(picker);
    });

    const backBtn = menu.querySelector('#btn-visuals-back') as HTMLElement;
    const applyBtn = menu.querySelector('#btn-visuals-apply') as HTMLElement;
    const importBtn = menu.querySelector('#btn-import-theme') as HTMLElement;
    const loginBtn = menu.querySelector('.visuals-login-btn') as HTMLElement;

    backBtn.addEventListener('click', () => this.toggleVisuals(false));

    applyBtn.addEventListener('click', () => this.handleApplyTheme());

    importBtn.addEventListener('click', () => this.handleImportTheme());

    loginBtn.addEventListener('click', () => {
      this.visualsMenu.classList.add('hidden');
      this.toggleAuthModal(true);
    });

    this.themeNameInput.addEventListener('input', () => this.hideVisualsError());
    this.importInput.addEventListener('input', () => this.hideVisualsError());

    return menu;
  }

  private createColorPicker(key: keyof ThemeColors, label: string, defaultColor: string): HTMLElement {
    const container = document.createElement('div');
    container.className = 'color-picker-container';
    container.dataset.colorKey = key;

    const rgb = this.hexToRgb(defaultColor);

    container.innerHTML = `
      <div class="color-picker-header">
        <div class="color-picker-header-left">
          <span class="color-picker-arrow">▶</span>
          <span class="color-picker-label">${label}</span>
        </div>
        <div class="color-picker-header-right">
          <div class="color-swatch" style="background-color: ${defaultColor}"></div>
          <span class="color-picker-hex-display">${defaultColor.toUpperCase()}</span>
        </div>
      </div>
      <div class="color-picker-panel">
        <div class="rgb-slider-row">
          <span class="rgb-slider-label r">R</span>
          <input type="range" class="rgb-slider" data-channel="r" min="0" max="255" value="${rgb.r}">
          <span class="rgb-slider-value" data-channel="r">${rgb.r}</span>
        </div>
        <div class="rgb-slider-row">
          <span class="rgb-slider-label g">G</span>
          <input type="range" class="rgb-slider" data-channel="g" min="0" max="255" value="${rgb.g}">
          <span class="rgb-slider-value" data-channel="g">${rgb.g}</span>
        </div>
        <div class="rgb-slider-row">
          <span class="rgb-slider-label b">B</span>
          <input type="range" class="rgb-slider" data-channel="b" min="0" max="255" value="${rgb.b}">
          <span class="rgb-slider-value" data-channel="b">${rgb.b}</span>
        </div>
        <div class="hex-input-row">
          <span class="hex-input-label">HEX:</span>
          <input type="text" class="hex-input" value="${defaultColor.toUpperCase()}" maxlength="7">
          <button class="hex-set-btn">SET</button>
        </div>
      </div>
    `;

    const header = container.querySelector('.color-picker-header') as HTMLElement;
    const swatch = container.querySelector('.color-swatch') as HTMLElement;
    const hexDisplay = container.querySelector('.color-picker-hex-display') as HTMLElement;
    const hexInput = container.querySelector('.hex-input') as HTMLInputElement;
    const hexSetBtn = container.querySelector('.hex-set-btn') as HTMLElement;
    const rSlider = container.querySelector('input[data-channel="r"]') as HTMLInputElement;
    const gSlider = container.querySelector('input[data-channel="g"]') as HTMLInputElement;
    const bSlider = container.querySelector('input[data-channel="b"]') as HTMLInputElement;
    const rValue = container.querySelector('span[data-channel="r"]') as HTMLElement;
    const gValue = container.querySelector('span[data-channel="g"]') as HTMLElement;
    const bValue = container.querySelector('span[data-channel="b"]') as HTMLElement;

    this.colorPickers.set(key, {
      swatch, hexDisplay, hexInput,
      rSlider, gSlider, bSlider,
      rValue, gValue, bValue
    });

    header.addEventListener('click', () => {
      container.classList.toggle('expanded');
    });

    const updateFromSliders = () => {
      const r = parseInt(rSlider.value, 10);
      const g = parseInt(gSlider.value, 10);
      const b = parseInt(bSlider.value, 10);
      const hex = this.rgbToHex(r, g, b);

      rValue.textContent = r.toString();
      gValue.textContent = g.toString();
      bValue.textContent = b.toString();

      swatch.style.backgroundColor = hex;
      hexDisplay.textContent = hex.toUpperCase();
      hexInput.value = hex.toUpperCase();
    };

    rSlider.addEventListener('input', updateFromSliders);
    gSlider.addEventListener('input', updateFromSliders);
    bSlider.addEventListener('input', updateFromSliders);

    hexSetBtn.addEventListener('click', () => {
      const hexValue = hexInput.value.trim();
      if (this.isValidHex(hexValue)) {
        const rgb = this.hexToRgb(hexValue);
        rSlider.value = rgb.r.toString();
        gSlider.value = rgb.g.toString();
        bSlider.value = rgb.b.toString();
        updateFromSliders();
      } else {
        this.showVisualsError('Invalid HEX color format');
      }
    });

    hexInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        hexSetBtn.click();
      }
    });

    return container;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
      const hex = Math.max(0, Math.min(255, x)).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  private isValidHex(hex: string): boolean {
    return /^#[0-9A-Fa-f]{6}$/.test(hex);
  }

  public toggleVisuals(isOpen: boolean) {
    if (isOpen) {
      this.mainMenu.classList.add('hidden');
      this.settingsMenu.classList.add('hidden');
      this.gameOverMenu.classList.add('hidden');
      this.leaderboardMenu.classList.add('hidden');
      this.gameModeMenu.classList.add('hidden');
      this.visualsMenu.classList.remove('hidden');

      this.updateVisualsVisibility();
      this.loadThemeList();
      this.resetThemeEditor();
    } else {
      this.visualsMenu.classList.add('hidden');
      this.mainMenu.classList.remove('hidden');
    }
  }

  private updateVisualsVisibility() {
    const loginRequired = this.visualsMenu.querySelector('#visuals-login-required') as HTMLElement;
    const editorContent = this.visualsMenu.querySelector('#visuals-editor-content') as HTMLElement;
    const applyBtn = this.visualsMenu.querySelector('#btn-visuals-apply') as HTMLElement;

    if (this.isLoggedIn) {
      loginRequired.classList.add('hidden');
      editorContent.classList.remove('hidden');
      applyBtn.classList.remove('hidden');
    } else {
      loginRequired.classList.remove('hidden');
      editorContent.classList.add('hidden');
      applyBtn.classList.add('hidden');
    }
  }

  private async loadThemeList() {
    if (!this.isLoggedIn || !this.onLoadUserThemes) {
      this.visualsThemeList.innerHTML = '<div class="theme-list-empty">Log in to see your themes</div>';
      return;
    }

    this.visualsThemeList.innerHTML = '<div class="theme-list-empty">Loading...</div>';

    try {
      const themes = await this.onLoadUserThemes();

      if (themes.length === 0) {
        this.visualsThemeList.innerHTML = '<div class="theme-list-empty">No themes yet. Create one below!</div>';
        return;
      }

      this.visualsThemeList.innerHTML = '';
      themes.forEach(theme => {
        const item = this.createThemeListItem(theme);
        this.visualsThemeList.appendChild(item);
      });
    } catch (error) {
      this.visualsThemeList.innerHTML = '<div class="theme-list-empty">Failed to load themes</div>';
    }
  }

  private createThemeListItem(theme: Theme): HTMLElement {
    const item = document.createElement('div');
    item.className = 'theme-item';

    item.innerHTML = `
      <div class="theme-item-header">
        <span class="theme-item-name">${this.escapeHtml(theme.name)}</span>
        <div class="theme-item-actions">
          <button class="copy-btn" title="Copy Share Code">COPY</button>
          <button class="load-btn">Load</button>
          <button class="delete-btn">Delete</button>
        </div>
      </div>
      <div class="theme-item-share">
        <span>Share: ${this.escapeHtml(theme.id || 'N/A')}</span>
        <span class="theme-author">Author: ${this.escapeHtml(theme.author || 'Unknown')}</span>
      </div>
    `;

    const loadBtn = item.querySelector('.load-btn') as HTMLElement;
    const deleteBtn = item.querySelector('.delete-btn') as HTMLElement;
    const copyBtn = item.querySelector('.copy-btn') as HTMLElement;

    loadBtn.addEventListener('click', async () => {
      this.loadThemeToEditor(theme);
      if (this.onSelectTheme) {
        try {
          await this.onSelectTheme(theme);
        } catch (e) {
          console.error(e);
        }
      }
    });

    copyBtn.addEventListener('click', async () => {
      if (theme.id) {
        try {
          await navigator.clipboard.writeText(theme.id);
          copyBtn.textContent = 'COPIED';
          setTimeout(() => copyBtn.textContent = 'COPY', 2000);
        } catch (err) {
          console.error('Failed to copy: ', err);
        }
      }
    });

    deleteBtn.addEventListener('click', async () => {
      if (!theme.id || !this.onDeleteTheme) return;

      try {
        await this.onDeleteTheme(theme.id);
        this.loadThemeList();
      } catch (error: any) {
        this.showVisualsError(error.message || 'Failed to delete theme');
      }
    });

    return item;
  }

  private loadThemeToEditor(theme: Theme) {
    this.editingThemeId = theme.id || null;
    this.skyboxSelect.value = theme.skyboxPath;

    for (const [key, picker] of this.colorPickers) {
      const color = theme.colors[key];
      const rgb = this.hexToRgb(color);

      picker.rSlider.value = rgb.r.toString();
      picker.gSlider.value = rgb.g.toString();
      picker.bSlider.value = rgb.b.toString();

      picker.rValue.textContent = rgb.r.toString();
      picker.gValue.textContent = rgb.g.toString();
      picker.bValue.textContent = rgb.b.toString();

      picker.swatch.style.backgroundColor = color;
      picker.hexDisplay.textContent = color.toUpperCase();
      picker.hexInput.value = color.toUpperCase();
    }
  }

  private resetThemeEditor() {
    this.editingThemeId = null;
    this.themeNameInput.value = '';
    this.skyboxSelect.value = this.activeTheme.skyboxPath;
    this.hideVisualsError();

    for (const [key, picker] of this.colorPickers) {
      const color = this.activeTheme.colors[key];
      const rgb = this.hexToRgb(color);

      picker.rSlider.value = rgb.r.toString();
      picker.gSlider.value = rgb.g.toString();
      picker.bSlider.value = rgb.b.toString();

      picker.rValue.textContent = rgb.r.toString();
      picker.gValue.textContent = rgb.g.toString();
      picker.bValue.textContent = rgb.b.toString();

      picker.swatch.style.backgroundColor = color;
      picker.hexDisplay.textContent = color.toUpperCase();
      picker.hexInput.value = color.toUpperCase();
    }
  }

  private getEditorThemeData(): Omit<Theme, 'id' | 'authorUid'> {
    const colors: ThemeColors = {
      primary: '#e0b0ff',
      bhop: '#e0b0ff',
      surf: '#e0b0ff',
      teleport: '#ffff00',
      damage: '#ff0000',
      crosshairOutline: '#000000',
      crosshairInner: '#ffffff'
    };

    for (const [key, picker] of this.colorPickers) {
      colors[key] = picker.hexInput.value.toUpperCase();
    }

    return {
      name: this.themeNameInput.value.trim(),
      skyboxPath: this.skyboxSelect.value,
      colors
    };
  }

  public updateCurrentThemeName(name: string) {
    const header = this.visualsMenu.querySelector('#visuals-current-theme-header');
    if (header) {
      header.textContent = `Your Themes / Current Theme: ${name}`;
    }
  }

  private async handleApplyTheme() {
    if (!this.onApplyTheme) return;

    const themeData = this.getEditorThemeData();

    if (!themeData.name) {
      this.showVisualsError('Theme name is required');
      return;
    }

    for (const [key, color] of Object.entries(themeData.colors)) {
      if (!this.isValidHex(color)) {
        this.showVisualsError(`Invalid color for ${key}`);
        return;
      }
    }

    const primaryRgb = this.hexToRgb(themeData.colors.primary);
    if (primaryRgb.r > 200 && primaryRgb.g > 200 && primaryRgb.b > 200) {
      this.showVisualsError('Primary color is too light. Please ensure at least one RGB value is lower than 200.');
      return;
    }
    if (primaryRgb.r <= 50 && primaryRgb.g <= 50 && primaryRgb.b <= 50) {
      this.showVisualsError('Primary color is too dark. Please ensure at least one RGB value is higher than 50.');
      return;
    }

    try {
      await this.onApplyTheme(themeData as Theme);
      this.loadThemeList();
      this.showVisualsSuccess('Theme saved and applied!');
      this.updateCurrentThemeName(themeData.name);
    } catch (error: any) {
      this.showVisualsError(error.message || 'Failed to save theme');
    }
  }

  private async handleImportTheme() {
    if (!this.onImportTheme || !this.onBookmarkTheme) return;

    const shareCode = this.importInput.value.trim();
    if (!shareCode) {
      this.showVisualsError('Enter a share code');
      return;
    }

    try {
      const theme = await this.onImportTheme(shareCode);
      if (theme && theme.id) {
        await this.onBookmarkTheme(theme.id);

        this.importInput.value = '';
        await this.loadThemeList();

        if (this.onSelectTheme) {
          await this.onSelectTheme(theme);
        }

        this.loadThemeToEditor(theme);

        this.showVisualsSuccess('Theme imported and applied!');
      } else {
        this.showVisualsError('Theme not found');
      }
    } catch (error: any) {
      this.showVisualsError(error.message || 'Failed to import theme');
    }
  }

  private showVisualsError(msg: string) {
    this.visualsError.textContent = msg;
    this.visualsError.className = 'visuals-error';
    this.visualsError.classList.remove('hidden');
  }

  private showVisualsSuccess(msg: string) {
    this.visualsError.textContent = msg;
    this.visualsError.className = 'visuals-success';
    this.visualsError.classList.remove('hidden');

    setTimeout(() => {
      this.hideVisualsError();
    }, 3000);
  }

  private hideVisualsError() {
    this.visualsError.classList.add('hidden');
    this.visualsError.textContent = '';
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
