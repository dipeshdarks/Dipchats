import { getDb, isDatabaseConnected, schema } from '../db';
import { eq, desc, and, or, sql, like } from 'drizzle-orm';
import crypto from 'crypto';

export interface DeviceRecord {
  id: string;
  deviceId: string;
  displayName: string;
  username?: string | null;
  displayAvatar?: string | null;
  bio?: string | null;
  discoverable: boolean;
  identityPublicKey?: string | null;
  signingPublicKey?: string | null;
  fingerprint?: string | null;
  lastSeen: Date | string;
}

export interface SessionRecord {
  id: string;
  deviceId: string;
  token: string;
  expiresAt: Date | string;
}

const memDevices = new Map<string, DeviceRecord>();
const memSessions = new Map<string, SessionRecord>();

export class UserRepository {
  async registerOrUpdateDevice(data: {
    displayName: string;
    identityPublicKey?: string;
    signingPublicKey?: string;
    fingerprint?: string;
  }): Promise<DeviceRecord> {
    const deviceIdStr = data.fingerprint ? data.fingerprint.substring(0, 32) : crypto.randomBytes(16).toString('hex');

    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const existing = await db
          .select()
          .from(schema.devices)
          .where(eq(schema.devices.deviceId, deviceIdStr))
          .limit(1);

        if (existing.length > 0 && existing[0]) {
          const [updated] = await db
            .update(schema.devices)
            .set({ displayName: data.displayName, lastSeen: new Date() })
            .where(eq(schema.devices.id, existing[0].id))
            .returning();
          if (updated) return updated as DeviceRecord;
        }

        const [inserted] = await db
          .insert(schema.devices)
          .values({
            deviceId: deviceIdStr,
            displayName: data.displayName,
            identityPublicKey: data.identityPublicKey || null,
            signingPublicKey: data.signingPublicKey || null,
            fingerprint: data.fingerprint || deviceIdStr
          })
          .returning();

        if (inserted) return inserted as DeviceRecord;
      } catch (err) {
        console.warn('DB write failed in UserRepository, falling back to memory:', err);
      }
    }

    const existingMem = Array.from(memDevices.values()).find((d) => d.deviceId === deviceIdStr);
    if (existingMem) {
      existingMem.displayName = data.displayName;
      existingMem.lastSeen = new Date();
      return existingMem;
    }

    const device: DeviceRecord = {
      id: crypto.randomUUID(),
      deviceId: deviceIdStr,
      displayName: data.displayName,
      discoverable: true,
      identityPublicKey: data.identityPublicKey || null,
      signingPublicKey: data.signingPublicKey || null,
      fingerprint: data.fingerprint || deviceIdStr,
      lastSeen: new Date()
    };
    memDevices.set(device.id, device);
    return device;
  }

  async createSession(deviceId: string): Promise<SessionRecord> {
    const token = `dpch_${crypto.randomBytes(24).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const [inserted] = await db
          .insert(schema.sessions)
          .values({
            deviceId,
            token,
            expiresAt
          })
          .returning();
        if (inserted) return inserted as SessionRecord;
      } catch (err) {
        console.warn('DB session insert failed, falling back to memory:', err);
      }
    }

    const session: SessionRecord = {
      id: crypto.randomUUID(),
      deviceId,
      token,
      expiresAt
    };
    memSessions.set(token, session);
    return session;
  }

  async findSessionByToken(token: string): Promise<SessionRecord | null> {
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const [session] = await db
          .select()
          .from(schema.sessions)
          .where(eq(schema.sessions.token, token))
          .limit(1);
        if (session && new Date(session.expiresAt) > new Date()) {
          return session as SessionRecord;
        }
      } catch (err) {}
    }

    const memSession = memSessions.get(token);
    if (memSession && new Date(memSession.expiresAt) > new Date()) {
      return memSession;
    }
    return null;
  }

  async findDeviceById(id: string): Promise<DeviceRecord | null> {
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const [device] = await db
          .select()
          .from(schema.devices)
          .where(eq(schema.devices.id, id))
          .limit(1);
        if (device) return device as DeviceRecord;
      } catch (err) {}
    }

    return memDevices.get(id) || null;
  }

  async listActiveDevices(): Promise<DeviceRecord[]> {
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const list = await db
          .select()
          .from(schema.devices)
          .orderBy(desc(schema.devices.lastSeen))
          .limit(50);
        return list as DeviceRecord[];
      } catch (err) {}
    }

    return Array.from(memDevices.values());
  }

  async listDiscoverableDevices(): Promise<DeviceRecord[]> {
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const list = await db
          .select()
          .from(schema.devices)
          .where(eq(schema.devices.discoverable, true))
          .orderBy(desc(schema.devices.lastSeen))
          .limit(50);
        return list as DeviceRecord[];
      } catch (err) {}
    }

    return Array.from(memDevices.values()).filter((d) => d.discoverable);
  }

  async searchDevices(query: string): Promise<DeviceRecord[]> {
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const list = await db
          .select()
          .from(schema.devices)
          .where(
            or(
              sql`${schema.devices.displayName} ILIKE ${'%' + query + '%'}`,
              sql`${schema.devices.username} ILIKE ${'%' + query + '%'}`
            )
          )
          .orderBy(desc(schema.devices.lastSeen))
          .limit(20);
        return list as DeviceRecord[];
      } catch (err) {}
    }

    return Array.from(memDevices.values()).filter(
      (d) =>
        d.displayName.toLowerCase().includes(query.toLowerCase()) ||
        (d.username && d.username.toLowerCase().includes(query.toLowerCase()))
    );
  }

  async updateProfile(deviceId: string, data: {
    displayName?: string;
    username?: string;
    bio?: string;
    avatarUrl?: string;
    discoverable?: boolean;
  }): Promise<DeviceRecord | null> {
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const updates: Record<string, any> = {};
        if (data.displayName !== undefined) updates.displayName = data.displayName;
        if (data.username !== undefined) updates.username = data.username;
        if (data.bio !== undefined) updates.bio = data.bio;
        if (data.avatarUrl !== undefined) updates.displayAvatar = data.avatarUrl;
        if (data.discoverable !== undefined) updates.discoverable = data.discoverable;

        const [updated] = await db
          .update(schema.devices)
          .set(updates)
          .where(eq(schema.devices.id, deviceId))
          .returning();
        if (updated) return updated as DeviceRecord;
      } catch (err) {}
    }

    const device = memDevices.get(deviceId);
    if (device) {
      if (data.displayName !== undefined) device.displayName = data.displayName;
      if (data.username !== undefined) device.username = data.username;
      if (data.bio !== undefined) device.bio = data.bio;
      if (data.avatarUrl !== undefined) device.displayAvatar = data.avatarUrl;
      if (data.discoverable !== undefined) device.discoverable = data.discoverable;
      return device;
    }
    return null;
  }
}

export const userRepository = new UserRepository();
