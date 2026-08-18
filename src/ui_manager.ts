import type { User } from 'firebase/auth';
import { GAME_STATE } from './config';
import type { Theme } from './config';
import { MainMenu } from './ui/main_menu';
import { LeaderboardMenu } from './ui/leaderboard_menu';
import { SettingsMenu } from './ui/settings_menu';
import { VisualsMenu } from './ui/visuals_menu';

export class UIManager {
  private hud!: HTMLElement;
  private hudFps!: HTMLElement;
  private hudSpeed!: HTMLElement;
  private hudScore!: HTMLElement;

  public mainMenu: MainMenu;
  public settingsMenu: SettingsMenu;
  public leaderboardMenu: LeaderboardMenu;
  public visualsMenu: VisualsMenu;

  public gameModeMenu!: HTMLElement;
  public authModal!: HTMLElement;
  public gameOverMenu!: HTMLElement;

  private gamemodeBackBtn!: HTMLElement;
  private gamemodeApplyBtn!: HTMLElement;
  private currentMode: string = 'bhop_surf';
  private currentDifficulty: string = 'normal';

  private pendingMode: string = 'bhop_surf';
  private pendingDifficulty: string = 'normal';

  public onPlayAgain: (() => void) | null = null;
  public onShowLeaderboard: ((mode: string, difficulty: string, requestId: number) => void) | null = null;

  public userHeader!: HTMLElement;
  private userDropdown!: HTMLElement;
  private footer!: HTMLElement;

  private authError!: HTMLElement;

  public onResume: (() => void) | null = null;
  public onLoadLevel: ((type: 'infinite') => void) | null = null;
  public onStartTutorial: (() => void) | null = null;

  public onLoginGoogleRequest: (() => void) | null = null;
  public onLogoutRequest: (() => void) | null = null;

  public onApplySettings: ((settings: { sensitivity: number, nickname?: string, fpsLimit: number, keybindings: { [action: string]: string[] } }, nicknameChanged: boolean) => Promise<void>) | null = null;

  public onApplyTheme: ((theme: Theme) => Promise<void>) | null = null;
  public onSelectTheme: ((theme: Theme) => Promise<void>) | null = null;
  public onLoadUserThemes: (() => Promise<Theme[]>) | null = null;
  public onDeleteTheme: ((themeId: string) => Promise<void>) | null = null;
  public onImportTheme: ((themeId: string) => Promise<Theme | null>) | null = null;
  public onBookmarkTheme: ((themeId: string) => Promise<void>) | null = null;

  private lastUpdate: number = 0;
  private lastColor: string = '';

  private isAuthModalOpen: boolean = false;
  private previousMenu: HTMLElement | null = null;

  private loadingScreen!: HTMLElement;
  private loadingBar!: HTMLElement;
  private loadingDetails!: HTMLElement;

  private tutorialOverlay!: HTMLElement;

  private hasModeChanged: boolean = false;

  public get activeTheme(): Theme {
    return this.visualsMenu.activeTheme;
  }

  public set activeTheme(theme: Theme) {
    this.visualsMenu.activeTheme = theme;
  }

  constructor(defaultSensitivity: number) {
    this.currentMode = GAME_STATE.currentMode;
    this.currentDifficulty = GAME_STATE.currentDifficulty;
    this.pendingMode = this.currentMode;
    this.pendingDifficulty = this.currentDifficulty;

    this.createLoadingScreen();
    this.createTutorialOverlay();

    this.createHUD();

    this.createUserHeader();

    this.mainMenu = new MainMenu({
      onResume: () => {
        if (this.onResume) this.onResume();
      },
      onOpenGameMode: () => {
        this.mainMenu.hide();
        this.gameModeMenu.classList.remove('hidden');
      },
      onOpenLeaderboard: () => {
        this.mainMenu.hide();
        this.leaderboardMenu.show();
      },
      onOpenSettings: () => {
        this.toggleSettings(true);
      },
      onOpenVisuals: () => {
        this.toggleVisuals(true);
      },
      onOpenTutorial: () => {
        if (this.onStartTutorial) this.onStartTutorial();
      }
    });

    this.settingsMenu = new SettingsMenu(defaultSensitivity, {
      onApplySettings: async (settings, nicknameChanged) => {
        if (this.onApplySettings) {
          await this.onApplySettings(settings, nicknameChanged);
        }
      },
      onBack: () => {
        this.toggleSettings(false);
      }
    });

    this.leaderboardMenu = new LeaderboardMenu({
      onBack: () => {
        this.leaderboardMenu.hide();
        this.mainMenu.show();
      },
      onShowLeaderboard: (mode, difficulty, requestId) => {
        if (this.onShowLeaderboard) {
          this.onShowLeaderboard(mode, difficulty, requestId);
        }
      }
    });

    this.visualsMenu = new VisualsMenu({
      onApplyTheme: async (theme) => { if (this.onApplyTheme) await this.onApplyTheme(theme); },
      onSelectTheme: async (theme) => { if (this.onSelectTheme) await this.onSelectTheme(theme); },
      onLoadUserThemes: async () => { return this.onLoadUserThemes ? await this.onLoadUserThemes() : []; },
      onDeleteTheme: async (id) => { if (this.onDeleteTheme) await this.onDeleteTheme(id); },
      onImportTheme: async (id) => { return this.onImportTheme ? await this.onImportTheme(id) : null; },
      onBookmarkTheme: async (id) => { if (this.onBookmarkTheme) await this.onBookmarkTheme(id); },
      onBack: () => {
        this.visualsMenu.hide();
        this.mainMenu.show();
      },
      onLoginRequest: () => {
        this.visualsMenu.hide();
        this.toggleAuthModal(true);
      }
    });

    this.gameModeMenu = this.createGameModeMenu();
    this.authModal = this.createAuthModal();
    this.gameOverMenu = this.createGameOverMenu();

    document.body.appendChild(this.mainMenu.element);
    document.body.appendChild(this.settingsMenu.element);
    document.body.appendChild(this.leaderboardMenu.element);
    document.body.appendChild(this.visualsMenu.element);

    document.body.appendChild(this.gameModeMenu);
    document.body.appendChild(this.authModal);
    document.body.appendChild(this.gameOverMenu);

    this.createFooter();

    const crosshair = document.createElement('div');
    crosshair.id = 'crosshair';
    document.body.appendChild(crosshair);

    this.updateUserHeader(null);
  }

  private createLoadingScreen() {
    this.loadingScreen = document.createElement('div');
    this.loadingScreen.id = 'loading-screen';
    this.loadingScreen.innerHTML = `
      <div class="loading-title brand">infinite<b>Jumps</b></div>
      <div id="loading-status" class="loading-status">Initializing...</div>
      <div class="loading-bar-container">
        <div id="loading-bar-fill" class="loading-bar-fill"></div>
      </div>
      <div id="hw-warning" class="hw-warning hidden">⚠ Turn on hardware acceleration for better experience</div>
    `;
    document.body.appendChild(this.loadingScreen);
    this.loadingBar = this.loadingScreen.querySelector('#loading-bar-fill') as HTMLElement;
    this.loadingDetails = this.loadingScreen.querySelector('#loading-status') as HTMLElement;
  }

  private createTutorialOverlay() {
    this.tutorialOverlay = document.createElement('div');
    this.tutorialOverlay.className = 'tutorial-overlay hidden';
    document.body.appendChild(this.tutorialOverlay);
  }

  public showTutorialOverlay(text: string) {
    this.tutorialOverlay.innerHTML = text;
    this.tutorialOverlay.classList.remove('hidden');
  }

  public hideTutorialOverlay() {
    this.tutorialOverlay.classList.add('hidden');
  }

  private createHUD() {
    this.hud = document.createElement('div');
    this.hud.className = 'hud';
    this.hud.innerHTML = 'FPS: <span id="hud-fps">0</span><br>Speed: <span id="hud-speed">0.00</span> u/s<br>Score: <span id="hud-score">0.00</span>';
    document.body.appendChild(this.hud);

    this.hudFps = this.hud.querySelector('#hud-fps') as HTMLElement;
    this.hudSpeed = this.hud.querySelector('#hud-speed') as HTMLElement;
    this.hudScore = this.hud.querySelector('#hud-score') as HTMLElement;
  }

  private createUserHeader() {
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
          <span class="brand">&copy; 2026 infinite<b>Jumps</b></span>
      </div>
      <div class="footer-right">
           <a href="https://x.com/kryoxd" target="_blank" aria-label="X">
             <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l11.733 16h4.267l-11.733 -16z" /><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" /></svg>
           </a>
           <a href="https://github.com/kryo1337/infinitejumps" target="_blank" aria-label="GitHub">
             <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5" /></svg>
           </a>
      </div>
    `;
    document.body.appendChild(this.footer);
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
        <div class="mode-section">
          <div class="mode-header">Learn</div>
          <div class="mode-toggle-group">
            <button id="btn-tutorial-mode" class="toggle-btn" data-mode="tutorial" data-diff="normal">Tutorial</button>
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

          this.updateActiveGameModeButton(mode, diff, menu);
        }
      });
    });

    this.gamemodeApplyBtn.addEventListener('click', async () => {
      if (this.pendingMode !== this.currentMode || this.pendingDifficulty !== this.currentDifficulty) {

        this.gamemodeApplyBtn.textContent = 'APPLYING...';
        (this.gamemodeApplyBtn as HTMLButtonElement).disabled = true;
        this.gamemodeApplyBtn.style.cursor = 'wait';

        await new Promise(resolve => setTimeout(resolve, 500));

        this.currentMode = this.pendingMode;
        this.currentDifficulty = this.pendingDifficulty;

        GAME_STATE.currentMode = this.pendingMode;
        GAME_STATE.currentDifficulty = this.pendingDifficulty;
        this.hasModeChanged = true;

        this.gamemodeApplyBtn.textContent = 'APPLY';
        (this.gamemodeApplyBtn as HTMLButtonElement).disabled = false;
        this.gamemodeApplyBtn.style.cursor = 'pointer';
      }

      this.closeGameModeMenu();
    });

    this.gamemodeBackBtn.addEventListener('click', () => {
      this.closeGameModeMenu();
    });

    return menu;
  }

  private closeGameModeMenu(showMain: boolean = true) {
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
      this.mainMenu.show();
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

  public setOfflineMode(isOffline: boolean) {
    this.mainMenu.setOfflineMode(isOffline);
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
      this.mainMenu.hide();
      this.settingsMenu.hide();
      this.authModal.classList.add('hidden');
      this.leaderboardMenu.hide();
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

  public updateUserHeader(user: User | null, nickname?: string) {
    this.settingsMenu.setUserState(!!user);
    this.leaderboardMenu.setUserState(!!user, nickname);
    this.visualsMenu.setUserState(!!user);

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

  public updateLeaderboard(entries: any[], mode: string, difficulty: string, requestId: number) {
    this.leaderboardMenu.updateLeaderboard(entries, mode, difficulty, requestId);
  }

  public get isBinding(): boolean {
    return this.settingsMenu.isBinding;
  }

  public get lastBindingTime(): number {
    return this.settingsMenu.lastBindingTime;
  }

  public toggleMenu(isOpen: boolean) {
    if (isOpen) {
      this.mainMenu.show();
      if (this.currentMode === 'tutorial') {
        this.mainMenu.hideTutorialButton();
      } else {
        this.mainMenu.showTutorialButton();
      }
      this.settingsMenu.hide();
      this.authModal.classList.add('hidden');
      this.gameOverMenu.classList.add('hidden');
      this.leaderboardMenu.hide();
      this.gameModeMenu.classList.add('hidden');
      this.visualsMenu.hide();
      this.footer.classList.remove('hidden');
      this.userHeader.classList.remove('hidden');
      this.hud.style.display = 'none';
      document.exitPointerLock();
    } else {
      this.mainMenu.hide();

      if (!this.settingsMenu.element.classList.contains('hidden')) {
        this.settingsMenu.close();
      } else {
        this.settingsMenu.hide();
      }

      this.authModal.classList.add('hidden');
      this.gameOverMenu.classList.add('hidden');
      this.leaderboardMenu.hide();
      this.visualsMenu.hide();

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

  public toggleAuthModal(isOpen: boolean) {
    if (isOpen) {
      const visibleMenu = [
        this.mainMenu.element,
        this.gameOverMenu,
        this.settingsMenu.element,
        this.leaderboardMenu.element,
        this.gameModeMenu,
        this.visualsMenu.element
      ].find(m => !m.classList.contains('hidden'));

      this.previousMenu = visibleMenu || this.mainMenu.element;

      this.hideAuthError();
      this.mainMenu.hide();
      this.settingsMenu.hide();
      this.gameOverMenu.classList.add('hidden');
      this.leaderboardMenu.hide();
      this.gameModeMenu.classList.add('hidden');
      this.visualsMenu.hide();
      this.authModal.classList.remove('hidden');
      this.isAuthModalOpen = true;
    } else {
      if (!this.isAuthModalOpen) return;

      this.isAuthModalOpen = false;
      this.authModal.classList.add('hidden');
      if (this.previousMenu) {
        if (this.previousMenu === this.settingsMenu.element) {
          this.toggleSettings(true);
        } else if (this.previousMenu === this.visualsMenu.element) {
          this.toggleVisuals(true);
        } else {
          this.previousMenu.classList.remove('hidden');
        }
      } else {
        this.mainMenu.show();
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

  public handleEscape(): boolean {
    if (this.settingsMenu.isBinding) return false;

    if (!this.authModal.classList.contains('hidden')) {
      this.toggleAuthModal(false);
      return false;
    }

    if (!this.settingsMenu.element.classList.contains('hidden')) {
      this.toggleSettings(false);
      return false;
    }

    if (!this.leaderboardMenu.element.classList.contains('hidden')) {
      this.leaderboardMenu.hide();
      this.mainMenu.show();
      return false;
    }

    if (!this.gameModeMenu.classList.contains('hidden')) {
      this.closeGameModeMenu();
      return false;
    }

    if (!this.visualsMenu.element.classList.contains('hidden')) {
      this.toggleVisuals(false);
      return false;
    }

    return true;
  }

  public toggleSettings(isOpen: boolean) {
    if (isOpen) {
      this.mainMenu.hide();
      this.gameOverMenu.classList.add('hidden');
      this.leaderboardMenu.hide();
      this.gameModeMenu.classList.add('hidden');
      this.settingsMenu.show();
    } else {
      this.settingsMenu.close();
      this.mainMenu.show();
    }
  }

  public toggleVisuals(isOpen: boolean) {
    if (isOpen) {
      this.mainMenu.hide();
      this.settingsMenu.hide();
      this.gameOverMenu.classList.add('hidden');
      this.leaderboardMenu.hide();
      this.gameModeMenu.classList.add('hidden');
      this.visualsMenu.show();
    } else {
      this.visualsMenu.hide();
      this.mainMenu.show();
    }
  }

  public syncSettings(settings: { sensitivity: number, nickname: string, fpsLimit?: number, keybindings?: { [action: string]: string[] } }) {
    this.settingsMenu.syncSettings(settings);
  }

  public showSettingsError(msg: string) {
    this.settingsMenu.showError(msg);
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

  public setGameMode(mode: string, difficulty: string) {
    this.currentMode = mode;
    this.currentDifficulty = difficulty;
    this.pendingMode = mode;
    this.pendingDifficulty = difficulty;

    this.updateActiveGameModeButton(mode, difficulty);

    if (mode === 'tutorial') {
      this.mainMenu.hideTutorialButton();
    } else {
      this.mainMenu.showTutorialButton();
    }
  }

  private updateActiveGameModeButton(mode: string, difficulty: string, container?: HTMLElement) {
    const root = container || this.gameModeMenu;
    const btns = root.querySelectorAll('.toggle-btn');
    btns.forEach(b => {
      b.classList.remove('active');
      const bMode = b.getAttribute('data-mode');
      const bDiff = b.getAttribute('data-diff');
      if (bMode === mode && bDiff === difficulty) {
        b.classList.add('active');
      }
    });
  }

  public checkModeChanged(): boolean {
    if (this.hasModeChanged) {
      this.hasModeChanged = false;
      return true;
    }
    return false;
  }

  public updateCurrentThemeName(name: string) {
    this.visualsMenu.updateCurrentThemeName(name);
  }
}
