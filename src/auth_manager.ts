import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import type { Auth, User } from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc
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

export interface UserSettings {
  sensitivity: number;
  nickname: string;
}

export class AuthManager {
  private app?: FirebaseApp;
  private auth?: Auth;
  private db?: Firestore;

  private _currentUser: User | null = null;
  public onSettingsLoaded: ((settings: UserSettings) => void) | null = null;
  public onAuthStateChanged: ((user: User | null) => void) | null = null;

  private defaultSettings: UserSettings = {
    sensitivity: 1.0,
    nickname: 'Player'
  };

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
      console.warn("Firebase initialization failed (likely due to invalid config). Auth features disabled.", error);
    }
  }

  public get currentUser(): User | null {
    return this._currentUser;
  }

  public async loginWithGoogle(): Promise<void> {
    if (!this.auth) { console.warn("Auth not initialized"); return; }
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(this.auth, provider);
    } catch (error) {
      console.error("Error logging in with Google:", error);
      throw error;
    }
  }

  public async loginWithEmail(email: string, pass: string): Promise<void> {
    if (!this.auth) { console.warn("Auth not initialized"); return; }
    try {
      await signInWithEmailAndPassword(this.auth, email, pass);
    } catch (error) {
      console.error("Error logging in with Email/Password:", error);
      throw error;
    }
  }

  public async registerWithEmail(email: string, pass: string): Promise<void> {
    if (!this.auth) { console.warn("Auth not initialized"); return; }
    try {
      await createUserWithEmailAndPassword(this.auth, email, pass);
      const nickname = email.split('@')[0];
      await this.saveSettings({
        sensitivity: 1.0,
        nickname: nickname
      });
    } catch (error) {
      console.error("Error registering with Email/Password:", error);
      throw error;
    }
  }

  public async logout(): Promise<void> {
    if (!this.auth) { console.warn("Auth not initialized"); return; }
    try {
      await signOut(this.auth);
    } catch (error) {
      console.error("Error logging out:", error);
      throw error;
    }
  }



  public getNickname(): string {
    return this._currentUser?.displayName || this.defaultSettings.nickname;
  }

  public async saveSettings(settings: UserSettings): Promise<void> {
    localStorage.setItem('kz_settings', JSON.stringify(settings));

    if (this._currentUser && this.db) {
      try {
        const userRef = doc(this.db, 'users', this._currentUser.uid);
        await setDoc(userRef, settings, { merge: true });
        console.log('Settings saved to Firestore');
      } catch (error) {
        console.error('Error saving settings to Firestore:', error);
      }
    } else {
      console.log('Settings saved to LocalStorage (not logged in or DB unavailable)');
    }
  }

  private async loadSettings(): Promise<void> {
    let settings: UserSettings = {
      sensitivity: 1.0,
      nickname: this._currentUser?.displayName || (this._currentUser?.email ? this._currentUser.email.split('@')[0] : 'Player')
    };

    const localStr = localStorage.getItem('kz_settings');
    let localSettings: Partial<UserSettings> | null = null;
    if (localStr) {
      try {
        const rawSettings = JSON.parse(localStr);
        localSettings = {};
        if (typeof rawSettings.sensitivity === 'number') localSettings.sensitivity = rawSettings.sensitivity;
        if (typeof rawSettings.nickname === 'string') localSettings.nickname = rawSettings.nickname;

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
          console.log('Settings loaded from Firestore');
        } else {
          if (localSettings) {
            console.log('New user detected. Uploading local settings to cloud...');
            await this.saveSettings(settings);
          }
        }
      } catch (error) {
        console.warn('Error loading settings from Firestore (Offline?):', error);
      }
    }

    if (this.onSettingsLoaded) {
      this.onSettingsLoaded(settings);
    }
  }
}
