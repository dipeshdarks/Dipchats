import { WSFrame, WSEventType, createWSFrame } from '@dipchats/shared';

export type { WSFrame, WSEventType };
export { createWSFrame };

export function createAckFrame(requestId: string, messageId: string, clientMessageId: string, status = 'persisted'): WSFrame {
  return createWSFrame(
    'message.ack' as any,
    {
      messageId,
      clientMessageId,
      status
    },
    requestId
  );
}

export function createErrorFrame(message: string, code = 'ERROR', requestId?: string | null): WSFrame {
  return createWSFrame(
    'error' as any,
    {
      code,
      message
    },
    requestId
  );
}
