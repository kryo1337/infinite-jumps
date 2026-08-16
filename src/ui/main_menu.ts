export class MainMenu {
  public element: HTMLElement;
  public returnBtn!: HTMLElement;
  public gamemodeBtn!: HTMLElement;
  public leaderboardBtn!: HTMLElement;
  public settingsBtn!: HTMLElement;
  public visualsBtn!: HTMLElement;
  public tutorialBtn!: HTMLElement;

  private onResume: () => void;
  private onOpenGameMode: () => void;
  private onOpenLeaderboard: () => void;
  private onOpenSettings: () => void;
  private onOpenVisuals: () => void;
  private onOpenTutorial: () => void;

  constructor(
    callbacks: {
      onResume: () => void;
      onOpenGameMode: () => void;
      onOpenLeaderboard: () => void;
      onOpenSettings: () => void;
      onOpenVisuals: () => void;
      onOpenTutorial: () => void;
    }
  ) {
    this.onResume = callbacks.onResume;
    this.onOpenGameMode = callbacks.onOpenGameMode;
    this.onOpenLeaderboard = callbacks.onOpenLeaderboard;
    this.onOpenSettings = callbacks.onOpenSettings;
    this.onOpenVisuals = callbacks.onOpenVisuals;
    this.onOpenTutorial = callbacks.onOpenTutorial;

    this.element = this.createMenu();
    this.setupEventListeners();
  }

  private createMenu(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.classList.add('hidden');
    wrapper.style.pointerEvents = 'none';

    const menu = document.createElement('div');
    menu.id = 'game-menu';
    menu.className = 'menu-overlay';

    const content = document.createElement('div');
    content.innerHTML =
      '<h1 class="menu-title brand">infinite<b>Jumps</b></h1>' +
      '<div id="offline-indicator" class="offline-indicator hidden">ONLINE SERVICES UNAVAILABLE</div>' +
      '<button id="btn-return" class="menu-btn">Resume</button>' +
      '<button id="btn-gamemode" class="menu-btn">Change Game Mode</button>' +
      '<button id="btn-leaderboard" class="menu-btn">Leaderboard</button>' +
      '<button id="btn-settings" class="menu-btn">Settings</button>' +
      '<button id="btn-visuals" class="menu-btn">Visuals</button>';
    menu.appendChild(content);

    const tutorialBtn = document.createElement('button');
    tutorialBtn.id = 'btn-tutorial';
    tutorialBtn.textContent = 'TUTORIAL';
    tutorialBtn.style.pointerEvents = 'auto';

    wrapper.appendChild(menu);
    wrapper.appendChild(tutorialBtn);

    menu.addEventListener('click', (e) => e.stopPropagation());
    menu.addEventListener('mousedown', (e) => e.stopPropagation());

    tutorialBtn.addEventListener('click', (e) => e.stopPropagation());
    tutorialBtn.addEventListener('mousedown', (e) => e.stopPropagation());

    return wrapper;
  }

  private setupEventListeners() {
    this.returnBtn = this.element.querySelector('#btn-return') as HTMLElement;
    this.gamemodeBtn = this.element.querySelector('#btn-gamemode') as HTMLElement;
    this.leaderboardBtn = this.element.querySelector('#btn-leaderboard') as HTMLElement;
    this.settingsBtn = this.element.querySelector('#btn-settings') as HTMLElement;
    this.visualsBtn = this.element.querySelector('#btn-visuals') as HTMLElement;
    this.tutorialBtn = this.element.querySelector('#btn-tutorial') as HTMLElement;

    this.returnBtn.addEventListener('click', () => this.onResume());
    this.gamemodeBtn.addEventListener('click', () => this.onOpenGameMode());
    this.leaderboardBtn.addEventListener('click', () => this.onOpenLeaderboard());
    this.settingsBtn.addEventListener('click', () => this.onOpenSettings());
    this.visualsBtn.addEventListener('click', () => this.onOpenVisuals());
    this.tutorialBtn.addEventListener('click', () => this.onOpenTutorial());
  }

  public setOfflineMode(isOffline: boolean) {
    const indicator = this.element.querySelector('#offline-indicator');
    if (indicator) {
      if (isOffline) {
        indicator.classList.remove('hidden');
      } else {
        indicator.classList.add('hidden');
      }
    }
  }

  public show() {
    this.element.classList.remove('hidden');
  }

  public hide() {
    this.element.classList.add('hidden');
  }

  public showTutorialButton() {
    this.tutorialBtn.classList.remove('hidden');
  }

  public hideTutorialButton() {
    this.tutorialBtn.classList.add('hidden');
  }
}
