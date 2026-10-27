import { DEMO_EMAIL, DEMO_PASSWORD } from '../mocks/db';
import { login } from '../services/authService';
import { writeSession } from '../services/sessionStore';
import type { Session } from '../types/auth';

export async function seedSession(): Promise<Session> {
  const { session } = await login(DEMO_EMAIL, DEMO_PASSWORD);
  writeSession(session);
  return session;
}
