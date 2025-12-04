import type { User } from 'firebase/auth';

export class UIManager {
  private hud: HTMLElement;
  private hudFps!: HTMLElement;
  private hudSpeed!: HTMLElement;
  private hudDistance!: HTMLElement;
  private sensInput!: HTMLInputElement;
  private sensVal!: HTMLElement;
  private nickInput!: HTMLInputElement;
  private nickRow!: HTMLElement;

  public mainMenu!: HTMLElement;
  public settingsMenu!: HTMLElement;
  public authModal!: HTMLElement;
  public gameOverMenu!: HTMLElement;
  public leaderboardMenu!: HTMLElement;

  public returnBtn!: HTMLElement;
  public settingsBtn!: HTMLElement;
  public leaderboardBtn!: HTMLElement;
  public visualsBtn!: HTMLElement;

  public settingsBackBtn!: HTMLElement;
  public settingsApplyBtn!: HTMLElement;

  private lbList!: HTMLElement;
  private lbBackBtn!: HTMLElement;

  public onPlayAgain: (() => void) | null = null;
  public onShowLeaderboard: (() => void) | null = null;

  public userHeader!: HTMLElement;
  private userDropdown!: HTMLElement;
  private footer!: HTMLElement;

  private authError!: HTMLElement;

  public onResume: (() => void) | null = null;
  public onLoadLevel: ((type: 'playground' | 'infinite') => void) | null = null;

  public onLoginGoogleRequest: (() => void) | null = null;
  public onLogoutRequest: (() => void) | null = null;

  public onApplySettings: ((settings: { sensitivity: number, nickname?: string }) => Promise<void>) | null = null;

  private lastUpdate: number = 0;
  private lastColor: string = '';

  private pendingSensitivity: number;
  private pendingNickname: string = '';
  private isLoggedIn: boolean = false;
  private previousMenu: HTMLElement | null = null;

  constructor(defaultSensitivity: number) {
    this.pendingSensitivity = defaultSensitivity;

    // --- HUD ---
    this.hud = document.createElement('div');
    this.hud.className = 'hud';
    this.hud.innerHTML = 'FPS: <span id="hud-fps">0</span><br>Speed: <span id="hud-speed">0.00</span> u/s<br>Dist: <span id="hud-dist">0.00</span>m';
    document.body.appendChild(this.hud);

    this.hudFps = this.hud.querySelector('#hud-fps') as HTMLElement;
    this.hudSpeed = this.hud.querySelector('#hud-speed') as HTMLElement;
    this.hudDistance = this.hud.querySelector('#hud-dist') as HTMLElement;

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

    this.updateUserHeader(null);

    // --- MENUS ---
    this.mainMenu = this.createMainMenu();
    this.settingsMenu = this.createSettingsMenu(defaultSensitivity);
    this.authModal = this.createAuthModal();
    this.gameOverMenu = this.createGameOverMenu();
    this.leaderboardMenu = this.createLeaderboardMenu();

    document.body.appendChild(this.mainMenu);
    document.body.appendChild(this.settingsMenu);
    document.body.appendChild(this.authModal);
    document.body.appendChild(this.gameOverMenu);
    document.body.appendChild(this.leaderboardMenu);

    // --- FOOTER ---
    this.createFooter();

    // --- CROSSHAIR ---
    const crosshair = document.createElement('div');
    crosshair.id = 'crosshair';
    document.body.appendChild(crosshair);

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
      '<button id="btn-return" class="menu-btn">Return</button>' +
      '<button id="btn-leaderboard" class="menu-btn">Leaderboard</button>' +
      '<button id="btn-settings" class="menu-btn">Settings</button>' +
      '<button id="btn-visuals" class="menu-btn">Visuals</button>';
    menu.appendChild(content);

    menu.addEventListener('click', (e) => e.stopPropagation());
    menu.addEventListener('mousedown', (e) => e.stopPropagation());

    this.returnBtn = menu.querySelector('#btn-return') as HTMLElement;
    this.leaderboardBtn = menu.querySelector('#btn-leaderboard') as HTMLElement;
    this.settingsBtn = menu.querySelector('#btn-settings') as HTMLElement;
    this.visualsBtn = menu.querySelector('#btn-visuals') as HTMLElement;

    return menu;
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
      <div id="go-login-msg" class="hidden">(LOG IN to be visible in leaderboard)</div>
      
      <button id="btn-play-again" class="menu-btn">PLAY AGAIN</button>
    `;

    menu.addEventListener('click', (e) => e.stopPropagation());
    menu.addEventListener('mousedown', (e) => e.stopPropagation());

    const btnPlayAgain = menu.querySelector('#btn-play-again') as HTMLElement;

    btnPlayAgain.addEventListener('click', () => {
      if (this.onPlayAgain) this.onPlayAgain();
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

    this.lbBackBtn.addEventListener('click', () => {
      this.leaderboardMenu.classList.add('hidden');
      this.mainMenu.classList.remove('hidden');
    });

    return menu;
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

  public showGameOver(score: number, highScore: number, isNewRecord: boolean, isLoggedIn: boolean) {
    const elNewRecord = this.gameOverMenu.querySelector('#go-new-record') as HTMLElement;
    const elScore = this.gameOverMenu.querySelector('#go-score') as HTMLElement;
    const elHighscore = this.gameOverMenu.querySelector('#go-highscore') as HTMLElement;

    elScore.textContent = `SCORE: ${score.toFixed(2)}`;
    elHighscore.textContent = `Highscore: ${highScore.toFixed(2)}`;

    if (isNewRecord) {
      elNewRecord.classList.remove('hidden');
    } else {
      elNewRecord.classList.add('hidden');
    }

    this.updateGameOverLoginMessage(isLoggedIn);
    this.toggleGameOver(true);
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
      this.gameOverMenu.classList.remove('hidden');
      
      this.footer.classList.remove('hidden');
      this.userHeader.classList.remove('hidden');
      this.hud.style.display = 'none';
      document.exitPointerLock();
    } else {
      this.gameOverMenu.classList.add('hidden');
    }
  }

  public updateLeaderboard(entries: any[]) {
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

  private createSettingsMenu(defaultSensitivity: number): HTMLElement {
    const menu = document.createElement('div');
    menu.id = 'settings-menu';
    menu.className = 'menu-overlay hidden';

    menu.innerHTML =
      '<h1 class="menu-title">Settings</h1>' +

      '<div class="setting-row hidden" id="row-nickname">' +
      '<label>Nickname</label>' +
      '<input type="text" id="nickname-input" placeholder="Enter nickname" maxlength="12">' +
      '</div>' +

      '<div class="setting-row">' +
      '<label>Sensitivity</label>' +
      '<input type="range" id="sens" min="0.1" max="10.0" step="0.05" value="' + defaultSensitivity + '">' +
      '<span id="sens-val">' + defaultSensitivity + '</span>' +
      '</div>' +

      '<div id="settings-error" class="settings-error hidden"></div>' +

      '<div class="settings-actions">' +
      '<button id="btn-settings-back" class="menu-btn">BACK</button>' +
      '<button id="btn-settings-apply" class="menu-btn btn-apply">APPLY</button>' +
      '</div>';

    menu.addEventListener('click', (e) => e.stopPropagation());
    menu.addEventListener('mousedown', (e) => e.stopPropagation());

    this.settingsBackBtn = menu.querySelector('#btn-settings-back') as HTMLElement;
    this.settingsApplyBtn = menu.querySelector('#btn-settings-apply') as HTMLElement;

    this.sensInput = menu.querySelector('#sens') as HTMLInputElement;
    this.sensVal = menu.querySelector('#sens-val') as HTMLElement;

    this.nickRow = menu.querySelector('#row-nickname') as HTMLElement;
    this.nickInput = menu.querySelector('#nickname-input') as HTMLInputElement;
    
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

    this.leaderboardBtn.addEventListener('click', () => {
      this.mainMenu.classList.add('hidden');
      this.leaderboardMenu.classList.remove('hidden');
      if (this.onShowLeaderboard) this.onShowLeaderboard();
    });
    this.settingsBtn.addEventListener('click', () => this.toggleSettings(true));
    this.visualsBtn.addEventListener('click', () => console.log('Visuals: Not implemented'));

    this.settingsBackBtn.addEventListener('click', () => {
      this.sensInput.value = this.pendingSensitivity.toString();
      this.sensVal.textContent = this.pendingSensitivity.toFixed(2);
      this.nickInput.value = this.pendingNickname;
      this.toggleSettings(false);
    });

    this.settingsApplyBtn.addEventListener('click', () => {
      const newSens = parseFloat(this.sensInput.value);
      const newNick = this.nickInput.value;

      this.pendingSensitivity = newSens;
      this.pendingNickname = newNick;

      if (this.onApplySettings) {
        this.onApplySettings({
          sensitivity: newSens,
          nickname: newNick
        });
      }
    });

    this.sensInput.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.sensVal.textContent = val.toFixed(2);
    });
  }

  public toggleMenu(isOpen: boolean) {
    if (isOpen) {
      this.mainMenu.classList.remove('hidden');
      this.settingsMenu.classList.add('hidden');
      this.authModal.classList.add('hidden');
      this.gameOverMenu.classList.add('hidden');
      this.leaderboardMenu.classList.add('hidden');
      this.footer.classList.remove('hidden');
      this.userHeader.classList.remove('hidden');
      this.hud.style.display = 'none';
      document.exitPointerLock();
    } else {
      this.mainMenu.classList.add('hidden');
      this.settingsMenu.classList.add('hidden');
      this.authModal.classList.add('hidden');
      this.gameOverMenu.classList.add('hidden');
      this.leaderboardMenu.classList.add('hidden');
      this.footer.classList.add('hidden');
      this.userHeader.classList.add('hidden');

      if (this.userDropdown) this.userDropdown.classList.add('hidden');

      this.hud.style.display = 'block';
    }
  }

  public toggleAuthModal(isOpen: boolean) {
    if (isOpen) {
      this.previousMenu = [
        this.mainMenu,
        this.gameOverMenu,
        this.settingsMenu,
        this.leaderboardMenu
      ].find(m => !m.classList.contains('hidden')) || this.mainMenu;

      this.hideAuthError();
      this.mainMenu.classList.add('hidden');
      this.settingsMenu.classList.add('hidden');
      this.gameOverMenu.classList.add('hidden');
      this.leaderboardMenu.classList.add('hidden');
      this.authModal.classList.remove('hidden');
    } else {
      this.authModal.classList.add('hidden');
      if (this.previousMenu) {
        if (this.previousMenu === this.settingsMenu) {
          this.toggleSettings(true);
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

  public toggleSettings(isOpen: boolean) {
    if (isOpen) {
      if (this.isLoggedIn) {
        this.nickRow.classList.remove('hidden');
      } else {
        this.nickRow.classList.add('hidden');
      }

      this.mainMenu.classList.add('hidden');
      this.gameOverMenu.classList.add('hidden');
      this.leaderboardMenu.classList.add('hidden');
      this.settingsMenu.classList.remove('hidden');
    } else {
      this.mainMenu.classList.remove('hidden');
      this.settingsMenu.classList.add('hidden');
    }
  }

  public syncSettings(settings: { sensitivity: number, nickname: string }) {
    this.pendingSensitivity = settings.sensitivity;
    this.pendingNickname = settings.nickname;

    this.sensInput.value = settings.sensitivity.toString();
    this.sensVal.textContent = settings.sensitivity.toFixed(2);
    this.nickInput.value = settings.nickname;
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
    
    this.hudDistance.textContent = distance.toFixed(2);
  }
}
