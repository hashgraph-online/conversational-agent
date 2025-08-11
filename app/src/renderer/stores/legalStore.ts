import { create } from 'zustand';

export interface LegalAcceptance {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  termsAcceptedAt?: string;
  privacyAcceptedAt?: string;
}

export interface LegalStore {
  legalAcceptance: LegalAcceptance;
  hasAcceptedAll: () => boolean;
  acceptTerms: () => void;
  acceptPrivacy: () => void;
  acceptAll: () => void;
  reset: () => void;
  loadFromStorage: () => void;
  saveToStorage: () => void;
}

const defaultLegalAcceptance: LegalAcceptance = {
  termsAccepted: false,
  privacyAccepted: false,
};

const STORAGE_KEY = 'legal-acceptance';

export const useLegalStore = create<LegalStore>((set, get) => ({
  legalAcceptance: defaultLegalAcceptance,

  hasAcceptedAll: () => {
    const { legalAcceptance } = get();
    return legalAcceptance.termsAccepted && legalAcceptance.privacyAccepted;
  },

  acceptTerms: () => {
    const now = new Date().toISOString();
    set((state) => ({
      legalAcceptance: {
        ...state.legalAcceptance,
        termsAccepted: true,
        termsAcceptedAt: now,
      },
    }));
    get().saveToStorage();
  },

  acceptPrivacy: () => {
    const now = new Date().toISOString();
    set((state) => ({
      legalAcceptance: {
        ...state.legalAcceptance,
        privacyAccepted: true,
        privacyAcceptedAt: now,
      },
    }));
    get().saveToStorage();
  },

  acceptAll: () => {
    const now = new Date().toISOString();
    set({
      legalAcceptance: {
        termsAccepted: true,
        privacyAccepted: true,
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
      },
    });
    get().saveToStorage();
  },

  reset: () => {
    set({ legalAcceptance: defaultLegalAcceptance });
    localStorage.removeItem(STORAGE_KEY);
  },

  loadFromStorage: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as LegalAcceptance;
        set({ legalAcceptance: parsed });
      }
    } catch (error) {
      // If parsing fails, keep default state
    }
  },

  saveToStorage: () => {
    const { legalAcceptance } = get();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legalAcceptance));
  },
}));
