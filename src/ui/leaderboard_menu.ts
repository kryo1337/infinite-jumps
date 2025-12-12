import { GAME_STATE } from '../config';
import type { LeaderboardEntry } from '../auth_manager';

export class LeaderboardMenu {
  public element: HTMLElement;
  private lbList!: HTMLElement;
  private lbBackBtn!: HTMLElement;

  private viewedMode: string = GAME_STATE.currentMode;
  private viewedDifficulty: string = GAME_STATE.currentDifficulty;
  private currentLeaderboardRequestId: number = 0;

  private onBack: () => void;
  private onShowLeaderboard: (mode: string, difficulty: string, requestId: number) => void;
  private isLoggedIn: boolean = false;
  private currentUserNickname: string | undefined;

  constructor(callbacks: {
    onBack: () => void;
    onShowLeaderboard: (mode: string, difficulty: string, requestId: number) => void;
  }) {
    this.onBack = callbacks.onBack;
    this.onShowLeaderboard = callbacks.onShowLeaderboard;
    this.element = this.createMenu();
    this.setupEventListeners();
  }

  private createMenu(): HTMLElement {
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
        </div>
      </div>
      <button id="btn-lb-back" class="menu-btn btn-top-margin">BACK</button>
    `;

    menu.addEventListener('click', (e) => e.stopPropagation());
    menu.addEventListener('mousedown', (e) => e.stopPropagation());

    return menu;
  }

  private setupEventListeners() {
    this.lbList = this.element.querySelector('#lb-list') as HTMLElement;
    this.lbBackBtn = this.element.querySelector('#btn-lb-back') as HTMLElement;

    const modeBtns = this.element.querySelectorAll('button[data-lb-mode]');
    const diffBtns = this.element.querySelectorAll('button[data-lb-diff]');

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
      this.onBack();
    });
  }

  public refreshLeaderboard() {
    this.updateLeaderboardUIState();
    this.lbList.innerHTML = '<div class="lb-empty">Loading...</div>';

    const requestId = ++this.currentLeaderboardRequestId;
    this.onShowLeaderboard(this.viewedMode, this.viewedDifficulty, requestId);
  }

  private updateLeaderboardUIState() {
    const modeBtns = this.element.querySelectorAll('button[data-lb-mode]');
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

    const diffBtns = this.element.querySelectorAll('button[data-lb-diff]');
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

  public updateLeaderboard(entries: LeaderboardEntry[], mode: string, difficulty: string, requestId: number) {
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

      if (this.isLoggedIn && this.currentUserNickname === entry.nickname) {
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

  public setUserState(isLoggedIn: boolean, nickname?: string) {
    this.isLoggedIn = isLoggedIn;
    this.currentUserNickname = nickname;
  }

  public show() {
    this.element.classList.remove('hidden');
    this.viewedMode = GAME_STATE.currentMode;
    this.viewedDifficulty = GAME_STATE.currentDifficulty;
    this.refreshLeaderboard();
  }

  public hide() {
    this.element.classList.add('hidden');
  }
}
