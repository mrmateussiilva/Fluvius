import { describe, it, expect } from 'vitest';
import { APP_VERSION } from '../version';

describe('App Version Configuration', () => {
  it('should define APP_VERSION', () => {
    expect(APP_VERSION).toBeDefined();
    expect(typeof APP_VERSION).toBe('string');
  });

  it('should follow semantic versioning format', () => {
    // Validates X.Y.Z format
    const semverRegex = /^\d+\.\d+\.\d+$/;
    expect(APP_VERSION).toMatch(semverRegex);
  });

  it('should set dynamic document title correctly', () => {
    document.title = `Fluvius - v${APP_VERSION}`;
    expect(document.title).toBe(`Fluvius - v${APP_VERSION}`);
  });
});
