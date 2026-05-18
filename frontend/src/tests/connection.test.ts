import { describe, it, expect } from 'vitest';

// Represents the corrected status check logic in SettingsPage.tsx
export const isConnectionActive = (status: string | undefined | null): boolean => {
  if (!status) return false;
  return status === 'open' || status === 'connected';
};

// Represents status color/label mapping in SettingsPage.tsx
export const getConnectionStatusLabel = (status: string | undefined | null): string => {
  if (!status) return 'Desconhecido';
  const statusLower = status.toLowerCase();
  if (statusLower === 'connected' || statusLower === 'open') {
    return 'Conectado';
  }
  if (statusLower === 'connecting') {
    return 'Conectando';
  }
  if (statusLower === 'qrcode' || statusLower === 'qr') {
    return 'Aguardando QR Code';
  }
  return 'Desconectado';
};

describe('Connection Status Logic', () => {
  describe('isConnectionActive', () => {
    it('should return true for active states', () => {
      expect(isConnectionActive('open')).toBe(true);
      expect(isConnectionActive('connected')).toBe(true);
    });

    it('should return false for inactive states', () => {
      expect(isConnectionActive('connecting')).toBe(false);
      expect(isConnectionActive('disconnected')).toBe(false);
      expect(isConnectionActive('qrcode')).toBe(false);
      expect(isConnectionActive(null)).toBe(false);
    });
  });

  describe('getConnectionStatusLabel', () => {
    it('should return Conectado for connected and open', () => {
      expect(getConnectionStatusLabel('connected')).toBe('Conectado');
      expect(getConnectionStatusLabel('open')).toBe('Conectado');
      expect(getConnectionStatusLabel('OPEN')).toBe('Conectado');
    });

    it('should return appropriate labels for other states', () => {
      expect(getConnectionStatusLabel('connecting')).toBe('Conectando');
      expect(getConnectionStatusLabel('qrcode')).toBe('Aguardando QR Code');
      expect(getConnectionStatusLabel('disconnected')).toBe('Desconectado');
    });
  });
});
