import { SKYBOX_OPTIONS, DEFAULT_THEME } from '../config';
import type { Theme, ThemeColors } from '../config';

export class VisualsMenu {
  public element: HTMLElement;
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
  private isLoggedIn: boolean = false;

  private onApplyTheme: (theme: Theme) => Promise<void>;
  private onSelectTheme: (theme: Theme) => Promise<void>;
  private onLoadUserThemes: () => Promise<Theme[]>;
  private onDeleteTheme: (themeId: string) => Promise<void>;
  private onImportTheme: (themeId: string) => Promise<Theme | null>;
  private onBookmarkTheme: (themeId: string) => Promise<void>;
  private onBack: () => void;
  private onLoginRequest: () => void;

  constructor(callbacks: {
    onApplyTheme: (theme: Theme) => Promise<void>;
    onSelectTheme: (theme: Theme) => Promise<void>;
    onLoadUserThemes: () => Promise<Theme[]>;
    onDeleteTheme: (themeId: string) => Promise<void>;
    onImportTheme: (themeId: string) => Promise<Theme | null>;
    onBookmarkTheme: (themeId: string) => Promise<void>;
    onBack: () => void;
    onLoginRequest: () => void;
  }) {
    this.onApplyTheme = callbacks.onApplyTheme;
    this.onSelectTheme = callbacks.onSelectTheme;
    this.onLoadUserThemes = callbacks.onLoadUserThemes;
    this.onDeleteTheme = callbacks.onDeleteTheme;
    this.onImportTheme = callbacks.onImportTheme;
    this.onBookmarkTheme = callbacks.onBookmarkTheme;
    this.onBack = callbacks.onBack;
    this.onLoginRequest = callbacks.onLoginRequest;

    this.element = this.createMenu();
    this.setupEventListeners();
  }

  private createMenu(): HTMLElement {
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

    return menu;
  }

  private setupEventListeners() {
    this.visualsThemeList = this.element.querySelector('#visuals-theme-list') as HTMLElement;
    this.visualsError = this.element.querySelector('#visuals-error') as HTMLElement;
    this.themeNameInput = this.element.querySelector('#theme-name-input') as HTMLInputElement;
    this.skyboxSelect = this.element.querySelector('#skybox-select') as HTMLSelectElement;
    this.importInput = this.element.querySelector('#import-input') as HTMLInputElement;

    const colorPickersContainer = this.element.querySelector('#color-pickers') as HTMLElement;
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

    const backBtn = this.element.querySelector('#btn-visuals-back') as HTMLElement;
    const applyBtn = this.element.querySelector('#btn-visuals-apply') as HTMLElement;
    const importBtn = this.element.querySelector('#btn-import-theme') as HTMLElement;
    const loginBtn = this.element.querySelector('.visuals-login-btn') as HTMLElement;

    backBtn.addEventListener('click', () => {
      this.hide();
      this.onBack();
    });

    applyBtn.addEventListener('click', () => this.handleApplyTheme());

    importBtn.addEventListener('click', () => this.handleImportTheme());

    loginBtn.addEventListener('click', () => {
      this.hide();
      this.onLoginRequest();
    });

    this.themeNameInput.addEventListener('input', () => this.hideVisualsError());
    this.importInput.addEventListener('input', () => this.hideVisualsError());
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

  public setUserState(isLoggedIn: boolean) {
    this.isLoggedIn = isLoggedIn;
    this.updateVisualsVisibility();
  }

  private updateVisualsVisibility() {
    const loginRequired = this.element.querySelector('#visuals-login-required') as HTMLElement;
    const editorContent = this.element.querySelector('#visuals-editor-content') as HTMLElement;
    const applyBtn = this.element.querySelector('#btn-visuals-apply') as HTMLElement;

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

  public async show() {
    this.element.classList.remove('hidden');
    this.updateVisualsVisibility();
    await this.loadThemeList();
    this.resetThemeEditor();
  }

  public hide() {
    this.element.classList.add('hidden');
  }

  private async loadThemeList() {
    if (!this.isLoggedIn) {
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

    const loadBtn = item.querySelector('.load-btn') as HTMLButtonElement;
    const deleteBtn = item.querySelector('.delete-btn') as HTMLButtonElement;
    const copyBtn = item.querySelector('.copy-btn') as HTMLButtonElement;

    loadBtn.addEventListener('click', async () => {
      loadBtn.textContent = 'LOADING...';
      loadBtn.disabled = true;
      loadBtn.style.cursor = 'wait';

      try {
        await new Promise(resolve => setTimeout(resolve, 500));

        this.loadThemeToEditor(theme);
        if (this.onSelectTheme) {
          try {
            await this.onSelectTheme(theme);
          } catch (e) {
            console.error(e);
          }
        }
      } finally {
        loadBtn.textContent = 'Load';
        loadBtn.disabled = false;
        loadBtn.style.cursor = 'pointer';
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
      if (!theme.id) return;

      deleteBtn.textContent = 'DELETING...';
      deleteBtn.disabled = true;
      deleteBtn.style.cursor = 'wait';

      try {
        await this.onDeleteTheme(theme.id);
        this.loadThemeList();
      } catch (error: any) {
        this.showVisualsError(error.message || 'Failed to delete theme');
        deleteBtn.textContent = 'Delete';
        deleteBtn.disabled = false;
        deleteBtn.style.cursor = 'pointer';
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
    const header = this.element.querySelector('#visuals-current-theme-header');
    if (header) {
      header.textContent = `Your Themes / Current Theme: ${name}`;
    }
  }

  private async handleApplyTheme() {
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

    const applyBtn = this.element.querySelector('#btn-visuals-apply') as HTMLButtonElement;

    applyBtn.textContent = 'SAVING...';
    applyBtn.disabled = true;
    applyBtn.style.cursor = 'wait';

    try {
      await this.onApplyTheme(themeData as Theme);
      this.loadThemeList();
      this.showVisualsSuccess('Theme saved and applied!');
      this.updateCurrentThemeName(themeData.name);
    } catch (error: any) {
      this.showVisualsError(error.message || 'Failed to save theme');
    } finally {
      applyBtn.textContent = 'APPLY';
      applyBtn.disabled = false;
      applyBtn.style.cursor = 'pointer';
    }
  }

  private async handleImportTheme() {
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
