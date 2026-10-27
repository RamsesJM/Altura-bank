import { describe, expect, it } from 'vitest';
import { readSession, writeSession } from './sessionStore';

const session = { token: 'abc123', expiresAt: '2026-10-27T22:00:00.000Z' };

describe('sessionStore', () => {
  it('returns null when nothing is stored', () => {
    expect(readSession()).toBeNull();
  });

  it('reads back a stored session', () => {
    writeSession(session);
    expect(readSession()).toEqual(session);
  });

  it('clears the session when writing null', () => {
    writeSession(session);
    writeSession(null);
    expect(sessionStorage.getItem('altura.session')).toBeNull();
  });

  it('returns null for corrupted data', () => {
    sessionStorage.setItem('altura.session', '{not json');
    expect(readSession()).toBeNull();
  });
});
