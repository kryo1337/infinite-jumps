import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import type { Auth, User } from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  runTransaction,
  addDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { GAME_STATE, MODE_SETTINGS, DIFFICULTY_SETTINGS } from './config';
import type { Theme, ThemeColors } from './config';

const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  score: number;
  uid: string;
}

export interface ScoreResult {
  isNewHighScore: boolean;
  currentHighScore: number;
}

export interface UserSettings {
  sensitivity: number;
  nickname: string;
  fpsLimit: number;
  keybindings: { [action: string]: string[] };
}

export class AuthManager {
  private app?: FirebaseApp;
  private auth?: Auth;
  private db?: Firestore;

  private _currentUser: User | null = null;
  public onSettingsLoaded: ((settings: UserSettings) => void) | null = null;
  private _onAuthStateChangedCallback: ((user: User | null) => void) | null = null;
  public isOfflineMode: boolean = false;

  private defaultSettings: UserSettings = {
    sensitivity: 1.0,
    nickname: 'Player',
    fpsLimit: -1, // -1 indicates Monitor Rate or Unlimited
    keybindings: {
      forward: ['KeyW'],
      backward: ['KeyS'],
      left: ['KeyA'],
      right: ['KeyD'],
      jump: ['Space', 'WheelUp', 'WheelDown'],
      reset: ['KeyR']
    }
  };

  private _currentSettings: UserSettings = { ...this.defaultSettings };

  private initialAuthResolved = false;
  private initialAuthPromise: Promise<void>;
  private resolveInitialAuth!: () => void;

  constructor() {
    this.initialAuthPromise = new Promise((resolve) => {
      this.resolveInitialAuth = resolve;
    });

    try {
      this.app = initializeApp(FIREBASE_CONFIG);
      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);

      onAuthStateChanged(this.auth, async (user) => {
        this._currentUser = user;
        if (this._onAuthStateChangedCallback) {
          this._onAuthStateChangedCallback(user);
        }
        await this.loadSettings();
        if (!this.initialAuthResolved) {
          this.initialAuthResolved = true;
          this.resolveInitialAuth();
        }
      });
    } catch (error) {
      this.isOfflineMode = true;
      if (!this.initialAuthResolved) {
        this.initialAuthResolved = true;
        this.resolveInitialAuth();
      }
    }
  }

  public set onAuthStateChanged(callback: ((user: User | null) => void) | null) {
    this._onAuthStateChangedCallback = callback;
    if (this.initialAuthResolved) {
      callback?.(this._currentUser);
    }
  }

  public get onAuthStateChanged() {
    return this._onAuthStateChangedCallback;
  }

  public async waitForInitialAuth(): Promise<void> {
    return this.initialAuthPromise;
  }

  public get currentUser(): User | null {
    return this._currentUser;
  }

  public get settings(): UserSettings {
    return this._currentSettings;
  }

  public async loginWithGoogle(): Promise<void> {
    if (!this.auth) { return; }
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(this.auth, provider);
      this._currentUser = result.user;
    } catch (error) {
      console.error("Error logging in with Google:", error);
      throw error;
    }
  }

  public async logout(): Promise<void> {
    if (!this.auth) { return; }
    try {
      await signOut(this.auth);

      localStorage.removeItem('local_highscore');

      const savedStr = localStorage.getItem('kz_settings');
      let currentSens = 1.0;

      if (savedStr) {
        try {
          const parsed = JSON.parse(savedStr);
          if (typeof parsed.sensitivity === 'number') {
            currentSens = parsed.sensitivity;
          }
        } catch (e) {
          // fall back to default sensitivity
        }
      }

      const cleanSettings: UserSettings = {
        sensitivity: currentSens,
        nickname: 'Player',
        fpsLimit: this.defaultSettings.fpsLimit,
        keybindings: { ...this.defaultSettings.keybindings }
      };

      localStorage.setItem('kz_settings', JSON.stringify(cleanSettings));
      this._currentSettings = { ...cleanSettings };

    } catch (error) {
      console.error("Error logging out:", error);
      throw error;
    }
  }

  public getNickname(): string {
    return this._currentSettings.nickname;
  }

  public async isNicknameTaken(nickname: string): Promise<boolean> {
    if (!this.db) return false;

    try {
      const q = query(collection(this.db, 'users'), where('nickname', '==', nickname));
      const snapshot = await getDocs(q);

      if (snapshot.empty) return false;

      if (this._currentUser) {
        let taken = false;
        snapshot.forEach(d => {
          if (d.id !== this._currentUser?.uid) taken = true;
        });
        return taken;
      }

      return true;
    } catch (error: any) {
      throw new Error("Could not verify nickname availability. Check your connection.");
    }
  }

  public async saveSettings(settings: UserSettings): Promise<void> {
    if (this._currentUser && this.db) {
      if (settings.nickname !== this._currentSettings.nickname) {
        const taken = await this.isNicknameTaken(settings.nickname);
        if (taken) {
          throw new Error("Nickname is already taken");
        }
      }
    }

    this._currentSettings = { ...settings };
    const dataToStore = { ...settings, uid: this._currentUser?.uid };
    localStorage.setItem('kz_settings', JSON.stringify(dataToStore));

    if (this._currentUser && this.db) {
      try {
        const userRef = doc(this.db, 'users', this._currentUser.uid);
        await setDoc(userRef, settings, { merge: true });

        const updatePromises: Promise<void>[] = [];
        for (const mode of Object.keys(MODE_SETTINGS)) {
          for (const diff of Object.keys(DIFFICULTY_SETTINGS)) {
            const collectionPath = `leaderboards/${mode}_${diff}/scores`;
            const scoreRef = doc(this.db, collectionPath, this._currentUser.uid);
            updatePromises.push(
              updateDoc(scoreRef, { nickname: settings.nickname })
                .catch(() => {
                  // document doesn't exist
                })
            );
          }
        }
        await Promise.all(updatePromises);

      } catch (error) {
        console.error('Error saving settings to Firestore:', error);
        throw error;
      }
    } else {
      console.log('Settings saved to LocalStorage (not logged in or DB unavailable)');
    }
  }

  public async saveScore(score: number): Promise<ScoreResult> {
    if (!this._currentUser || !this.db) {
      const storageKey = `local_highscore_${GAME_STATE.currentMode}_${GAME_STATE.currentDifficulty}`;
      const localHigh = parseInt(localStorage.getItem(storageKey) || '0', 10);
      if (score > localHigh) {
        localStorage.setItem(storageKey, score.toString());
        return { isNewHighScore: true, currentHighScore: score };
      }
      return { isNewHighScore: false, currentHighScore: localHigh };
    }

    const uid = this._currentUser.uid;
    const collectionPath = `leaderboards/${GAME_STATE.currentMode}_${GAME_STATE.currentDifficulty}/scores`;
    const scoreRef = doc(this.db, collectionPath, uid);

    try {
      return await runTransaction(this.db, async (transaction) => {
        const docSnap = await transaction.get(scoreRef);
        let oldScore = 0;

        if (docSnap.exists()) {
          oldScore = docSnap.data().score || 0;
        }

        if (score > oldScore) {
          transaction.set(scoreRef, {
            uid: uid,
            nickname: this.getNickname(),
            score: score,
            timestamp: Date.now()
          }, { merge: true });
          return { isNewHighScore: true, currentHighScore: score };
        }

        return { isNewHighScore: false, currentHighScore: oldScore };
      });
    } catch (error) {
      console.error("Error saving score:", error);
      throw error;
    }
  }

  public async getLeaderboard(mode: string, difficulty: string, limitCount: number = 10): Promise<{ mode: string, difficulty: string, entries: LeaderboardEntry[] }> {
    if (!this.db) return { mode, difficulty, entries: [] };

    const collectionPath = `leaderboards/${mode}_${difficulty}/scores`;

    try {
      const q = query(
        collection(this.db, collectionPath),
        orderBy('score', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const leaderboard: LeaderboardEntry[] = [];
      let rank = 1;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        leaderboard.push({
          rank: rank++,
          uid: data.uid,
          nickname: data.nickname || 'Unknown',
          score: data.score || 0
        });
      });

      return { mode, difficulty, entries: leaderboard };
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      return { mode, difficulty, entries: [] };
    }
  }

  public async getUserHighScore(): Promise<number> {
    if (!this._currentUser || !this.db) {
      const storageKey = `local_highscore_${GAME_STATE.currentMode}_${GAME_STATE.currentDifficulty}`;
      return parseInt(localStorage.getItem(storageKey) || '0', 10);
    }

    const collectionPath = `leaderboards/${GAME_STATE.currentMode}_${GAME_STATE.currentDifficulty}/scores`;

    try {
      const scoreRef = doc(this.db, collectionPath, this._currentUser.uid);
      const docSnap = await getDoc(scoreRef);
      if (docSnap.exists()) {
        return docSnap.data().score || 0;
      }
      return 0;
    } catch (error) {
      console.warn("Failed to fetch user highscore", error);
      return 0;
    }
  }

  private async loadSettings(): Promise<void> {
    let settings: UserSettings = {
      ...this.defaultSettings,
      nickname: this._currentUser?.displayName || 'Player'
    };

    const localStr = localStorage.getItem('kz_settings');
    let localSettings: Partial<UserSettings> | null = null;
    if (localStr) {
      try {
        const rawSettings = JSON.parse(localStr);
        localSettings = {};
        if (typeof rawSettings.sensitivity === 'number') localSettings.sensitivity = rawSettings.sensitivity;
        if (typeof rawSettings.fpsLimit === 'number') localSettings.fpsLimit = rawSettings.fpsLimit;
        if (rawSettings.keybindings) {
          localSettings.keybindings = { ...this.defaultSettings.keybindings, ...rawSettings.keybindings };
        }

        if (typeof rawSettings.nickname === 'string') {
          const storedUid = rawSettings.uid;
          const currentUid = this._currentUser?.uid;
          if (storedUid === currentUid || (storedUid == null && currentUid == null)) {
            localSettings.nickname = rawSettings.nickname;
          }
        }

        if (localSettings.nickname === 'Player' && this._currentUser?.displayName) {
          localSettings.nickname = this._currentUser.displayName.replace(/\s/g, '');
        }

        settings = { ...settings, ...localSettings };
      } catch (e) {
        console.warn('Failed to parse local settings', e);
      }
    }

    if (this._currentUser && this.db) {
      try {
        const userRef = doc(this.db, 'users', this._currentUser.uid);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<UserSettings>;
          settings = { ...settings, ...data };
        } else {
          if (settings.nickname === 'Player' && this._currentUser.displayName) {
            settings.nickname = this._currentUser.displayName.replace(/\s/g, '');
          }

          try {
            await this.saveSettings(settings);
          } catch (e) {
            if (settings.nickname !== 'Player') {
              settings.nickname = `${settings.nickname}_${Math.floor(Math.random() * 1000)}`;
              await this.saveSettings(settings);
            }
          }
        }
      } catch (error) {
        console.warn('Error loading settings from Firestore (Offline?):', error);
      }
    }

    this._currentSettings = settings;

    if (this._currentUser && this.db) {
      const localHigh = parseInt(localStorage.getItem('local_highscore') || '0', 10);
      if (localHigh > 0) {
        await this.saveScore(localHigh);
      }
    }

    if (this.onSettingsLoaded) {
      this.onSettingsLoaded(settings);
    }
  }

  private static readonly THEME_LIMIT = 10;
  private static readonly THEME_STORAGE_KEY = 'kz_active_theme';

  public async saveTheme(themeData: Omit<Theme, 'id' | 'authorUid'>): Promise<string> {
    if (!this._currentUser || !this.db) {
      throw new Error('You must be logged in to save themes');
    }

    if (!themeData.name || themeData.name.trim().length === 0) {
      throw new Error('Theme name is required');
    }

    const userThemes = await this.getUserThemes();
    if (userThemes.length >= AuthManager.THEME_LIMIT) {
      throw new Error(`Maximum ${AuthManager.THEME_LIMIT} themes allowed per user`);
    }

    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    for (const [key, value] of Object.entries(themeData.colors)) {
      if (!hexRegex.test(value)) {
        throw new Error(`Invalid color format for ${key}: ${value}`);
      }
    }

    try {
      const themesRef = collection(this.db, 'themes');
      const docRef = await addDoc(themesRef, {
        ...themeData,
        name: themeData.name.trim(),
        authorUid: this._currentUser.uid,
        author: this.getNickname(),
        createdAt: Date.now()
      });

      return docRef.id;
    } catch (error) {
      console.error('Error saving theme:', error);
      throw new Error('Failed to save theme');
    }
  }

  public async bookmarkTheme(themeId: string): Promise<void> {
    if (!this._currentUser || !this.db) {
      throw new Error('You must be logged in to bookmark themes');
    }

    try {
      const themeRef = doc(this.db, 'themes', themeId);
      const themeSnap = await getDoc(themeRef);
      if (!themeSnap.exists()) {
        throw new Error('Theme not found');
      }

      const userRef = doc(this.db, 'users', this._currentUser.uid);
      await updateDoc(userRef, {
        bookmarkedThemes: arrayUnion(themeId)
      });
    } catch (error) {
      console.error('Error bookmarking theme:', error);
      throw error;
    }
  }

  public async getUserThemes(): Promise<Theme[]> {
    if (!this._currentUser || !this.db) {
      return [];
    }

    try {
      const themesMap = new Map<string, Theme>();

      const themesRef = collection(this.db, 'themes');
      const q = query(
        themesRef,
        where('authorUid', '==', this._currentUser.uid),
        orderBy('createdAt', 'desc')
      );

      const authoredSnapshot = await getDocs(q);
      authoredSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        themesMap.set(docSnap.id, {
          id: docSnap.id,
          name: data.name,
          authorUid: data.authorUid,
          author: data.author || this.getNickname(),
          skyboxPath: data.skyboxPath,
          colors: data.colors as ThemeColors
        });
      });

      const userRef = doc(this.db, 'users', this._currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const bookmarkedIds = userData.bookmarkedThemes as string[] || [];

        const idsToFetch = bookmarkedIds.filter(id => !themesMap.has(id));

        if (idsToFetch.length > 0) {
          const promises = [];
          for (let i = 0; i < idsToFetch.length; i += 10) {
            const batch = idsToFetch.slice(i, i + 10);
            const qBookmarks = query(themesRef, where('__name__', 'in', batch));
            promises.push(getDocs(qBookmarks));
          }

          const snapshots = await Promise.all(promises);
          snapshots.forEach(snap => {
            snap.forEach((docSnap) => {
              const data = docSnap.data();
              themesMap.set(docSnap.id, {
                id: docSnap.id,
                name: data.name,
                authorUid: data.authorUid,
                author: data.author || 'Unknown',
                skyboxPath: data.skyboxPath,
                colors: data.colors as ThemeColors
              });
            });
          });
        }
      }

      return Array.from(themesMap.values());
    } catch (error) {
      console.error('Error fetching user themes:', error);
      return [];
    }
  }

  public async deleteTheme(themeId: string): Promise<void> {
    if (!this._currentUser || !this.db) {
      throw new Error('You must be logged in to manage themes');
    }

    try {
      const themeRef = doc(this.db, 'themes', themeId);
      const themeSnap = await getDoc(themeRef);

      if (!themeSnap.exists()) {
        const userRef = doc(this.db, 'users', this._currentUser.uid);
        await updateDoc(userRef, {
          bookmarkedThemes: arrayRemove(themeId)
        });
        return;
      }

      const themeData = themeSnap.data();

      if (themeData.authorUid === this._currentUser.uid) {
        await deleteDoc(themeRef);
      } else {
        const userRef = doc(this.db, 'users', this._currentUser.uid);
        await updateDoc(userRef, {
          bookmarkedThemes: arrayRemove(themeId)
        });
      }

      const activeTheme = this.getActiveTheme();
      if (activeTheme && activeTheme.id === themeId) {
        localStorage.removeItem(AuthManager.THEME_STORAGE_KEY);
      }
    } catch (error: any) {
      console.error('Error deleting theme:', error);
      throw error;
    }
  }

  public async getThemeById(themeId: string): Promise<Theme | null> {
    if (!this.db) {
      return null;
    }

    try {
      const themeRef = doc(this.db, 'themes', themeId);
      const themeSnap = await getDoc(themeRef);

      if (!themeSnap.exists()) {
        return null;
      }

      const data = themeSnap.data();
      return {
        id: themeSnap.id,
        name: data.name,
        authorUid: data.authorUid,
        author: data.author || 'Unknown',
        skyboxPath: data.skyboxPath,
        colors: data.colors as ThemeColors
      };
    } catch (error) {
      console.error('Error fetching theme by ID:', error);
      return null;
    }
  }

  public setActiveTheme(theme: Theme): void {
    try {
      localStorage.setItem(AuthManager.THEME_STORAGE_KEY, JSON.stringify(theme));

      if (this._currentUser && this.db && theme.id) {
        const userRef = doc(this.db, 'users', this._currentUser.uid);
        setDoc(userRef, { activeThemeId: theme.id }, { merge: true }).catch(err => {
          console.error('Failed to sync active theme to DB:', err);
        });
      }
    } catch (error) {
      console.error('Error saving active theme to localStorage:', error);
    }
  }

  public async syncActiveThemeFromDB(): Promise<Theme | null> {
    if (!this._currentUser || !this.db) {
      return null;
    }

    try {
      const userRef = doc(this.db, 'users', this._currentUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const activeThemeId = userData.activeThemeId;

        if (activeThemeId) {
          const theme = await this.getThemeById(activeThemeId);
          if (theme) {
            localStorage.setItem(AuthManager.THEME_STORAGE_KEY, JSON.stringify(theme));
            return theme;
          }
        }
      }
    } catch (error) {
      console.error('Error syncing active theme from DB:', error);
    }

    return null;
  }

  public getActiveTheme(): Theme | null {
    try {
      const stored = localStorage.getItem(AuthManager.THEME_STORAGE_KEY);
      if (!stored) {
        return null;
      }

      const parsed = JSON.parse(stored);

      if (!parsed.colors || !parsed.skyboxPath) {
        return null;
      }

      return parsed as Theme;
    } catch (error) {
      console.error('Error reading active theme from localStorage:', error);
      return null;
    }
  }

  public clearActiveTheme(): void {
    localStorage.removeItem(AuthManager.THEME_STORAGE_KEY);
  }
}
