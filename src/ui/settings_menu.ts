export class SettingsMenu {
  public element: HTMLElement;
  private settingsBackBtn!: HTMLElement;
  private settingsApplyBtn!: HTMLButtonElement;
  private sensInput!: HTMLInputElement;
  private sensVal!: HTMLElement;
  private vsyncOnBtn!: HTMLElement;
  private vsyncOffBtn!: HTMLElement;
  private fpsInput!: HTMLInputElement;
  private fpsVal!: HTMLElement;
  private nickRow!: HTMLElement;
  private nickInput!: HTMLInputElement;
  private bindButtons: HTMLElement[] = [];
  private bindWarning!: HTMLElement;
  private settingsError!: HTMLElement;

  private pendingSensitivity: number;
  private pendingFpsLimit: number = -1;
  private pendingNickname: string = '';
  private pendingKeybindings: { [action: string]: string[] } = {};
  private cleanKeybindings: { [action: string]: string[] } = {};

  private isVsyncEnabled: boolean = false;
  private isLoggedIn: boolean = false;

  public isBinding: boolean = false;
  public lastBindingTime: number = 0;
  private bindingCleanup: (() => void) | null = null;

  private onApplySettings: (settings: { sensitivity: number, nickname: string, fpsLimit: number, keybindings: { [action: string]: string[] } }, nicknameChanged: boolean) => Promise<void>;
  private onBack: () => void;

  constructor(defaultSensitivity: number, callbacks: {
    onApplySettings: (settings: { sensitivity: number, nickname: string, fpsLimit: number, keybindings: { [action: string]: string[] } }, nicknameChanged: boolean) => Promise<void>;
    onBack: () => void;
  }) {
    this.pendingSensitivity = defaultSensitivity;
    this.onApplySettings = callbacks.onApplySettings;
    this.onBack = callbacks.onBack;

    this.element = this.createMenu(defaultSensitivity);
    this.setupEventListeners();
  }

  private createMenu(defaultSensitivity: number): HTMLElement {
    const menu = document.createElement('div');
    menu.id = 'settings-menu';
    menu.className = 'menu-overlay hidden';

    menu.innerHTML = `
      <h1 class="menu-title">Settings</h1>

      <div class="settings-scroll-container">
        <div class="setting-row hidden" id="row-nickname">
          <label>Nickname</label>
          <input type="text" id="nickname-input" placeholder="Enter nickname" maxlength="12">
        </div>

        <div class="controls-section" id="section-graphics">
          <div class="controls-title">Graphics</div>

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

          <div class="setting-row" id="row-fps">
            <label>Max FPS</label>
            <input type="range" id="fps-cap" class="settings-slider" min="30" max="1000" step="10" value="1000">
            <span id="fps-val">Unlimited</span>
          </div>

          <div class="setting-row">
            <label>Sensitivity</label>
            <input type="range" id="sens" class="settings-slider" min="0.1" max="10.0" step="0.05" value="${defaultSensitivity}">
            <span id="sens-val">${defaultSensitivity}</span>
          </div>
        </div>

        <div class="controls-section">
          <div class="controls-title">Controls</div>
          
          <div class="control-row">
            <span>Move Forward</span>
            <div class="control-buttons">
              <button class="bind-btn" data-action="forward" data-index="0">W</button>
              <button class="bind-btn" data-action="forward" data-index="1">NONE</button>
            </div>
          </div>

          <div class="control-row">
            <span>Move Backward</span>
            <div class="control-buttons">
              <button class="bind-btn" data-action="backward" data-index="0">S</button>
              <button class="bind-btn" data-action="backward" data-index="1">NONE</button>
            </div>
          </div>

          <div class="control-row">
            <span>Move Left</span>
            <div class="control-buttons">
              <button class="bind-btn" data-action="left" data-index="0">A</button>
              <button class="bind-btn" data-action="left" data-index="1">NONE</button>
            </div>
          </div>

          <div class="control-row">
            <span>Move Right</span>
            <div class="control-buttons">
              <button class="bind-btn" data-action="right" data-index="0">D</button>
              <button class="bind-btn" data-action="right" data-index="1">NONE</button>
            </div>
          </div>

          <div class="control-row">
            <span>Reset</span>
            <div class="control-buttons">
              <button class="bind-btn" data-action="reset" data-index="0">R</button>
              <button class="bind-btn" data-action="reset" data-index="1">NONE</button>
            </div>
          </div>

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

    return menu;
  }

  private setupEventListeners() {
    this.settingsBackBtn = this.element.querySelector('#btn-settings-back') as HTMLElement;
    this.settingsApplyBtn = this.element.querySelector('#btn-settings-apply') as HTMLButtonElement;
    this.sensInput = this.element.querySelector('#sens') as HTMLInputElement;
    this.sensVal = this.element.querySelector('#sens-val') as HTMLElement;
    this.vsyncOnBtn = this.element.querySelector('#btn-vsync-on') as HTMLElement;
    this.vsyncOffBtn = this.element.querySelector('#btn-vsync-off') as HTMLElement;
    this.fpsInput = this.element.querySelector('#fps-cap') as HTMLInputElement;
    this.fpsVal = this.element.querySelector('#fps-val') as HTMLElement;
    this.nickRow = this.element.querySelector('#row-nickname') as HTMLElement;
    this.nickInput = this.element.querySelector('#nickname-input') as HTMLInputElement;
    this.bindButtons = Array.from(this.element.querySelectorAll('.bind-btn'));
    this.bindWarning = this.element.querySelector('#bind-warning') as HTMLElement;
    this.settingsError = this.element.querySelector('#settings-error') as HTMLElement;

    this.settingsBackBtn.addEventListener('click', () => {
      this.close();
      this.onBack();
    });

    this.settingsApplyBtn.addEventListener('click', async () => {
      const newSens = parseFloat(this.sensInput.value);
      const newNick = this.nickInput.value.trim();

      let newFps = parseInt(this.fpsInput.value, 10);
      if (this.isVsyncEnabled) newFps = -1;

      const nicknameChanged = newNick !== this.pendingNickname;
      this.pendingSensitivity = newSens;
      this.pendingNickname = newNick;
      this.pendingFpsLimit = newFps;
      this.cleanKeybindings = JSON.parse(JSON.stringify(this.pendingKeybindings));

      this.settingsApplyBtn.textContent = 'SAVING...';
      this.settingsApplyBtn.disabled = true;
      this.settingsApplyBtn.style.cursor = 'wait';

      try {
        await this.onApplySettings({
          sensitivity: newSens,
          nickname: newNick,
          fpsLimit: newFps,
          keybindings: { ...this.pendingKeybindings }
        }, nicknameChanged);
      } finally {
        this.settingsApplyBtn.textContent = 'APPLY';
        this.settingsApplyBtn.disabled = false;
        this.settingsApplyBtn.style.cursor = 'pointer';
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

    this.nickInput.addEventListener('input', () => this.settingsError.classList.add('hidden'));

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

  public setUserState(isLoggedIn: boolean) {
    this.isLoggedIn = isLoggedIn;
    this.updateVisibility();
  }

  private updateVisibility() {
    const graphicsSection = this.element.querySelector('#section-graphics');
    if (this.isLoggedIn) {
      this.nickRow.classList.remove('hidden');
      if (graphicsSection) graphicsSection.classList.add('force-border-top');
    } else {
      this.nickRow.classList.add('hidden');
      if (graphicsSection) graphicsSection.classList.remove('force-border-top');
    }
  }

  public show() {
    this.updateVisibility();
    this.element.classList.remove('hidden');
  }

  public hide() {
    this.element.classList.add('hidden');
  }

  public close() {
    if (this.bindingCleanup) {
      this.bindingCleanup();
      this.bindingCleanup = null;
    }
    this.revertSettings();
    this.hide();
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

  public showError(msg: string) {
    this.settingsError.textContent = msg;
    this.settingsError.classList.remove('hidden');
  }
}
