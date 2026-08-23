import { userRepository, DeviceRecord, SessionRecord } from '../repositories/user-repository';

export class SessionService {
  async join(displayName: string, identityPublicKey?: string, signingPublicKey?: string, fingerprint?: string) {
    const device = await userRepository.registerOrUpdateDevice({
      displayName,
      identityPublicKey,
      signingPublicKey,
      fingerprint
    });

    const session = await userRepository.createSession(device.id);

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      device
    };
  }

  async authenticateToken(token: string): Promise<DeviceRecord | null> {
    const session = await userRepository.findSessionByToken(token);
    if (!session) return null;

    return await userRepository.findDeviceById(session.deviceId);
  }

  async listActiveUsers(): Promise<DeviceRecord[]> {
    return await userRepository.listActiveDevices();
  }
}

export const sessionService = new SessionService();
