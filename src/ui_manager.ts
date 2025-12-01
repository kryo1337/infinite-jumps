import type { User } from 'firebase/auth';

export class UIManager {
  private hud: HTMLElement;
  private hudFps!: HTMLElement;
  private hudSpeed!: HTMLElement;
  private sensInput!: HTMLInputElement;
  private sensVal!: HTMLElement;
  private nickInput!: HTMLInputElement;
  private nickRow!: HTMLElement;

  public mainMenu!: HTMLElement;
  public settingsMenu!: HTMLElement;
  public authModal!: HTMLElement;

  public returnBtn!: HTMLElement;
  public settingsBtn!: HTMLElement;
  public leaderboardBtn!: HTMLElement;
  public visualsBtn!: HTMLElement;

  public settingsBackBtn!: HTMLElement;
  public settingsApplyBtn!: HTMLElement;

  public userHeader!: HTMLElement;
  private userDropdown!: HTMLElement;
  private footer!: HTMLElement;

  private authEmailInput!: HTMLInputElement;
  private authPassInput!: HTMLInputElement;
  private authError!: HTMLElement;

  public onResume: (() => void) | null = null;
  public onLoadLevel: ((type: 'playground' | 'infinite') => void) | null = null;

  public onLoginGoogleRequest: (() => void) | null = null;
  public onLoginEmailRequest: ((email: string, pass: string) => void) | null = null;
  public onRegisterEmailRequest: ((email: string, pass: string) => void) | null = null;
  public onLogoutRequest: (() => void) | null = null;

  public onApplySettings: ((settings: { sensitivity: number, nickname?: string }) => void) | null = null;

  private lastUpdate: number = 0;

  private pendingSensitivity: number;
  private pendingNickname: string = '';
  private isLoggedIn: boolean = false;

  constructor(defaultSensitivity: number) {
    this.pendingSensitivity = defaultSensitivity;

    // --- HUD ---
    this.hud = document.createElement('div');
    this.hud.className = 'hud';
    this.hud.innerHTML = 'FPS: <span id="hud-fps">0</span><br>Speed: <span id="hud-speed">0.00</span> u/s';
    document.body.appendChild(this.hud);

    this.hudFps = this.hud.querySelector('#hud-fps') as HTMLElement;
    this.hudSpeed = this.hud.querySelector('#hud-speed') as HTMLElement;

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

    document.body.appendChild(this.mainMenu);
    document.body.appendChild(this.settingsMenu);
    document.body.appendChild(this.authModal);

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
    content.style.width = '100%';
    content.innerHTML =
      '<h1 class="menu-title">Infinite Jumps</h1>' +
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
      <h1 class="menu-title">Login / Register</h1>
      <div class="auth-form">
        <div id="auth-error" class="auth-error hidden"></div>
        <input type="email" id="auth-email" class="auth-input" placeholder="Email" />
        <input type="password" id="auth-pass" class="auth-input" placeholder="Password" />
        <div class="auth-actions">
          <button id="btn-auth-login" class="menu-btn">Login</button>
          <button id="btn-auth-register" class="menu-btn">Register</button>
        </div>
      </div>
      <div class="divider"></div>
      <button id="btn-auth-google" class="menu-btn">Login with Google</button>
      <button id="btn-auth-back" class="menu-btn" style="margin-top: 10px;">Back</button>
    `;

    menu.addEventListener('click', (e) => e.stopPropagation());
    menu.addEventListener('mousedown', (e) => e.stopPropagation());

    this.authEmailInput = menu.querySelector('#auth-email') as HTMLInputElement;
    this.authPassInput = menu.querySelector('#auth-pass') as HTMLInputElement;
    this.authError = menu.querySelector('#auth-error') as HTMLElement;

    this.authEmailInput.addEventListener('input', () => this.hideAuthError());
    this.authPassInput.addEventListener('input', () => this.hideAuthError());

    const btnLogin = menu.querySelector('#btn-auth-login') as HTMLElement;
    const btnRegister = menu.querySelector('#btn-auth-register') as HTMLElement;
    const btnGoogle = menu.querySelector('#btn-auth-google') as HTMLElement;
    const btnBack = menu.querySelector('#btn-auth-back') as HTMLElement;

    btnLogin.addEventListener('click', () => {
      this.hideAuthError();
      const email = this.authEmailInput.value;
      const pass = this.authPassInput.value;

      if (!email || !pass) {
        this.showAuthError('Please fill in all fields');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        this.showAuthError('Invalid email address');
        return;
      }

      if (this.onLoginEmailRequest) this.onLoginEmailRequest(email, pass);
    });

    btnRegister.addEventListener('click', () => {
      this.hideAuthError();
      const email = this.authEmailInput.value;
      const pass = this.authPassInput.value;

      if (!email || !pass) {
        this.showAuthError('Please fill in all fields');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        this.showAuthError('Invalid email address');
        return;
      }
      if (pass.length < 6) {
        this.showAuthError('Password must be at least 6 characters');
        return;
      }

      if (this.onRegisterEmailRequest) this.onRegisterEmailRequest(email, pass);
    });

    btnGoogle.addEventListener('click', () => {
      this.hideAuthError();
      if (this.onLoginGoogleRequest) this.onLoginGoogleRequest();
    });

    btnBack.addEventListener('click', () => {
      this.toggleAuthModal(false);
    });

    return menu;
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

    return menu;
  }

  private setupEventListeners() {
    this.returnBtn.addEventListener('click', () => {
      if (this.onResume) this.onResume();
    });

    this.leaderboardBtn.addEventListener('click', () => console.log('Leaderboard: Not implemented'));
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
      this.footer.classList.remove('hidden');
      this.userHeader.classList.remove('hidden');
      this.hud.style.display = 'none';
      document.exitPointerLock();
    } else {
      this.mainMenu.classList.add('hidden');
      this.settingsMenu.classList.add('hidden');
      this.authModal.classList.add('hidden');
      this.footer.classList.add('hidden');
      this.userHeader.classList.add('hidden');

      if (this.userDropdown) this.userDropdown.classList.add('hidden');

      this.hud.style.display = 'block';
    }
  }

  public toggleAuthModal(isOpen: boolean) {
    if (isOpen) {
      this.hideAuthError();
      this.authEmailInput.value = '';
      this.authPassInput.value = '';
      this.mainMenu.classList.add('hidden');
      this.settingsMenu.classList.add('hidden');
      this.authModal.classList.remove('hidden');
    } else {
      this.authModal.classList.add('hidden');
      this.mainMenu.classList.remove('hidden');
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

  public update(fps: number, speed: number) {
    if (performance.now() - this.lastUpdate < 50) return;
    this.lastUpdate = performance.now();

    const color = speed > 20 ? '#f33' : speed > 12 ? '#ff3' : '#fff';
    this.hudFps.textContent = fps.toString();
    this.hudSpeed.textContent = speed.toFixed(2);
    this.hudSpeed.style.color = color;
  }
}
