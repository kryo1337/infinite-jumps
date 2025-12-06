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
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  runTransaction
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

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
  public onAuthStateChanged: ((user: User | null) => void) | null = null;
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

  constructor() {
    try {
      this.app = initializeApp(FIREBASE_CONFIG);
      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);

      onAuthStateChanged(this.auth, async (user) => {
        this._currentUser = user;
        if (this.onAuthStateChanged) {
          this.onAuthStateChanged(user);
        }
        await this.loadSettings();
      });
    } catch (error) {
      this.isOfflineMode = true;
    }
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

        const scoreRef = doc(this.db, 'leaderboard', this._currentUser.uid);
        const scoreSnap = await getDoc(scoreRef);
        if (scoreSnap.exists()) {
          await setDoc(scoreRef, { nickname: settings.nickname }, { merge: true });
        }

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
      const localHigh = parseInt(localStorage.getItem('local_highscore') || '0', 10);
      if (score > localHigh) {
        localStorage.setItem('local_highscore', score.toString());
        return { isNewHighScore: true, currentHighScore: score };
      }
      return { isNewHighScore: false, currentHighScore: localHigh };
    }

    const uid = this._currentUser.uid;
    const scoreRef = doc(this.db, 'leaderboard', uid);

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

  public async getLeaderboard(limitCount: number = 10): Promise<LeaderboardEntry[]> {
    if (!this.db) return [];

    try {
      const q = query(
        collection(this.db, 'leaderboard'),
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

      return leaderboard;
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      return [];
    }
  }

  public async getUserHighScore(): Promise<number> {
    if (!this._currentUser || !this.db) {
      return parseInt(localStorage.getItem('local_highscore') || '0', 10);
    }

    try {
      const scoreRef = doc(this.db, 'leaderboard', this._currentUser.uid);
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
}
