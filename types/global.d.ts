// Ambient type declarations shared across the app.

interface LiffSDK {
  init: (cfg: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: (opts?: { redirectUri?: string }) => void;
  logout: () => void;
  getIDToken: () => string | null;
  getProfile: () => Promise<{
    userId: string;
    displayName: string;
    pictureUrl?: string;
    statusMessage?: string;
  }>;
}

declare global {
  interface Window {
    liff?: LiffSDK;
  }
}

export {};
