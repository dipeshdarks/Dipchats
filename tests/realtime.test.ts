import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '../apps/server/src';
import { WebSocket } from 'ws';
import { createWSFrame, WSFrame } from '@dipchats/shared';

describe('DipChats Realtime Two-Client Integration Test', () => {
  let app: any;
  let serverPort: number;

  beforeAll(async () => {
    app = await createServer();
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    serverPort = (app.server.address() as any).port;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should deliver messages between Client A and Client B with ACK, persistence, and sync on reconnect', async () => {
    // 1. Join Client A (Alex) via REST
    const resA = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/join',
      payload: { displayName: 'Alex' }
    });
    expect(resA.statusCode).toBe(200);
    const authA = JSON.parse(resA.body);
    expect(authA.token).toBeDefined();

    // 2. Join Client B (Sarah) via REST
    const resB = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/join',
      payload: { displayName: 'Sarah' }
    });
    expect(resB.statusCode).toBe(200);
    const authB = JSON.parse(resB.body);
    expect(authB.token).toBeDefined();

    // 3. Connect Client A WebSocket
    const wsA = new WebSocket(`ws://127.0.0.1:${serverPort}/ws`);
    await new Promise<void>((resolve) => wsA.on('open', resolve));

    // Set up listener BEFORE sending auth
    const authSuccessA = new Promise<WSFrame>((resolve) => {
      const handler = (data: any) => {
        const frame = JSON.parse(data.toString());
        if (frame.type === 'auth.success') {
          wsA.removeListener('message', handler);
          resolve(frame);
        }
      };
      wsA.on('message', handler);
    });

    wsA.send(JSON.stringify(createWSFrame('auth.join' as any, { token: authA.token }, 'req_auth_a')));
    const authAResult = await authSuccessA;
    expect(authAResult.type).toBe('auth.success');

    // 4. Connect Client B WebSocket
    const wsB = new WebSocket(`ws://127.0.0.1:${serverPort}/ws`);
    await new Promise<void>((resolve) => wsB.on('open', resolve));

    const authSuccessB = new Promise<WSFrame>((resolve) => {
      const handler = (data: any) => {
        const frame = JSON.parse(data.toString());
        if (frame.type === 'auth.success') {
          wsB.removeListener('message', handler);
          resolve(frame);
        }
      };
      wsB.on('message', handler);
    });

    wsB.send(JSON.stringify(createWSFrame('auth.join' as any, { token: authB.token }, 'req_auth_b')));
    const authBResult = await authSuccessB;
    expect(authBResult.type).toBe('auth.success');

    // 5. Client A sends "Hello DipChats"
    const clientMsgId = `test_msg_${Date.now()}`;
    const sendReqId = 'req_send_001';

    const ackPromise = new Promise<WSFrame>((resolve) => {
      const handler = (data: any) => {
        const frame = JSON.parse(data.toString());
        if (frame.type === 'message.ack' && frame.requestId === sendReqId) {
          wsA.removeListener('message', handler);
          resolve(frame);
        }
      };
      wsA.on('message', handler);
    });

    const bMessagePromise = new Promise<WSFrame>((resolve) => {
      const handler = (data: any) => {
        const frame = JSON.parse(data.toString());
        if (frame.type === 'message.new' && frame.payload.clientMessageId === clientMsgId) {
          wsB.removeListener('message', handler);
          resolve(frame);
        }
      };
      wsB.on('message', handler);
    });

    wsA.send(
      JSON.stringify(
        createWSFrame(
          'message.send' as any,
          {
            channelId: 'chan_general',
            content: 'Hello DipChats',
            clientMessageId: clientMsgId
          },
          sendReqId
        )
      )
    );

    const ackReceived = await ackPromise;
    const newMsgReceivedByB = await bMessagePromise;

    expect(ackReceived).toBeDefined();
    expect(ackReceived.type).toBe('message.ack');
    expect((ackReceived.payload as any).status).toBe('persisted');

    expect(newMsgReceivedByB).toBeDefined();
    expect(newMsgReceivedByB.type).toBe('message.new');
    expect((newMsgReceivedByB.payload as any).content).toBe('Hello DipChats');
    expect((newMsgReceivedByB.payload as any).senderName).toBe('Alex');

    // 6. Test Reconnection & Sync
    wsB.close();
    await new Promise<void>((resolve) => wsB.on('close', () => resolve()));

    const clientMsgId2 = `test_msg2_${Date.now()}`;
    wsA.send(
      JSON.stringify(
        createWSFrame(
          'message.send' as any,
          {
            channelId: 'chan_general',
            content: 'Second Message',
            clientMessageId: clientMsgId2
          },
          'req_send_002'
        )
      )
    );

    await new Promise((r) => setTimeout(r, 200));

    // Client B reconnects
    const wsB2 = new WebSocket(`ws://127.0.0.1:${serverPort}/ws`);
    await new Promise<void>((resolve) => wsB2.on('open', resolve));

    const authSuccessB2 = new Promise<WSFrame>((resolve) => {
      const handler = (data: any) => {
        const frame = JSON.parse(data.toString());
        if (frame.type === 'auth.success') {
          wsB2.removeListener('message', handler);
          resolve(frame);
        }
      };
      wsB2.on('message', handler);
    });

    wsB2.send(JSON.stringify(createWSFrame('auth.join' as any, { token: authB.token }, 'req_auth_b2')));
    await authSuccessB2;

    // Client B sends sync.request
    const syncReqId = 'req_sync_001';
    const syncPromise = new Promise<WSFrame>((resolve) => {
      const handler = (data: any) => {
        const frame = JSON.parse(data.toString());
        if (frame.type === 'sync.response' && frame.requestId === syncReqId) {
          wsB2.removeListener('message', handler);
          resolve(frame);
        }
      };
      wsB2.on('message', handler);
    });

    wsB2.send(
      JSON.stringify(
        createWSFrame(
          'sync.request' as any,
          {
            channelId: 'chan_general',
            afterTimestamp: new Date(Date.now() - 60000).toISOString()
          },
          syncReqId
        )
      )
    );

    const syncResponse = await syncPromise;
    expect(syncResponse).toBeDefined();
    expect(syncResponse.type).toBe('sync.response');
    expect((syncResponse.payload as any).messages.length).toBeGreaterThanOrEqual(2);

    wsA.close();
    wsB2.close();
  });
});
