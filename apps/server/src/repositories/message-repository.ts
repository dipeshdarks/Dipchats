import { getDb, isDatabaseConnected, schema } from '../db';
import { eq, and, desc, gt, lt } from 'drizzle-orm';
import crypto from 'crypto';

export interface MessageRecord {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  clientMessageId: string;
  content: string;
  contentType: 'text' | 'attachment' | 'system';
  replyToId?: string | null;
  attachments?: any[];
  createdAt: Date | string;
  editedAt?: Date | string | null;
  deletedAt?: Date | string | null;
}

const memMessages: MessageRecord[] = [];

export class MessageRepository {
  async createMessage(data: {
    channelId: string;
    senderId: string;
    senderName: string;
    clientMessageId: string;
    content: string;
    contentType?: 'text' | 'attachment' | 'system';
    replyToId?: string;
    attachments?: any[];
  }): Promise<{ message: MessageRecord; isDuplicate: boolean }> {
    const contentType = data.contentType || 'text';

    // 1. Check for duplicate clientMessageId
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const existing = await db
          .select({
            id: schema.messages.id,
            channelId: schema.messages.channelId,
            senderId: schema.messages.senderId,
            senderName: schema.devices.displayName,
            clientMessageId: schema.messages.clientMessageId,
            content: schema.messages.content,
            contentType: schema.messages.contentType,
            replyToId: schema.messages.replyToId,
            attachments: schema.messages.attachments,
            createdAt: schema.messages.createdAt,
            editedAt: schema.messages.editedAt,
            deletedAt: schema.messages.deletedAt
          })
          .from(schema.messages)
          .innerJoin(schema.devices, eq(schema.messages.senderId, schema.devices.id))
          .where(
            and(
              eq(schema.messages.senderId, data.senderId),
              eq(schema.messages.clientMessageId, data.clientMessageId)
            )
          )
          .limit(1);

        if (existing.length > 0 && existing[0]) {
          return { message: existing[0] as MessageRecord, isDuplicate: true };
        }

        // 2. Insert new message
        const [inserted] = await db
          .insert(schema.messages)
          .values({
            channelId: data.channelId,
            senderId: data.senderId,
            clientMessageId: data.clientMessageId,
            content: data.content,
            contentType,
            replyToId: data.replyToId || null,
            attachments: data.attachments || []
          })
          .returning();

        if (inserted) {
          const msgRecord: MessageRecord = {
            id: inserted.id,
            channelId: inserted.channelId,
            senderId: inserted.senderId,
            senderName: data.senderName,
            clientMessageId: inserted.clientMessageId,
            content: inserted.content,
            contentType: inserted.contentType as 'text' | 'attachment' | 'system',
            replyToId: inserted.replyToId,
            attachments: (inserted.attachments as any[]) || [],
            createdAt: inserted.createdAt,
            editedAt: inserted.editedAt,
            deletedAt: inserted.deletedAt
          };
          return { message: msgRecord, isDuplicate: false };
        }
      } catch (err) {
        console.warn('DB message insert failed, using memory fallback:', err);
      }
    }

    // Memory Fallback
    const existingMem = memMessages.find(
      (m) => m.senderId === data.senderId && m.clientMessageId === data.clientMessageId
    );
    if (existingMem) {
      return { message: existingMem, isDuplicate: true };
    }

    const newMsg: MessageRecord = {
      id: `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      channelId: data.channelId,
      senderId: data.senderId,
      senderName: data.senderName,
      clientMessageId: data.clientMessageId,
      content: data.content,
      contentType,
      replyToId: data.replyToId || null,
      attachments: data.attachments || [],
      createdAt: new Date().toISOString()
    };
    memMessages.push(newMsg);
    return { message: newMsg, isDuplicate: false };
  }

  async getChannelHistory(
    channelId: string,
    limit = 50,
    beforeId?: string
  ): Promise<{ messages: MessageRecord[]; nextCursor?: string }> {
    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        let query = db
          .select({
            id: schema.messages.id,
            channelId: schema.messages.channelId,
            senderId: schema.messages.senderId,
            senderName: schema.devices.displayName,
            clientMessageId: schema.messages.clientMessageId,
            content: schema.messages.content,
            contentType: schema.messages.contentType,
            replyToId: schema.messages.replyToId,
            attachments: schema.messages.attachments,
            createdAt: schema.messages.createdAt,
            editedAt: schema.messages.editedAt,
            deletedAt: schema.messages.deletedAt
          })
          .from(schema.messages)
          .innerJoin(schema.devices, eq(schema.messages.senderId, schema.devices.id))
          .where(eq(schema.messages.channelId, channelId))
          .orderBy(desc(schema.messages.createdAt))
          .limit(limit);

        const list = await query;
        if (list.length > 0) {
          const sorted = (list as MessageRecord[]).reverse();
          const nextCursor = sorted[0]?.id;
          return { messages: sorted, nextCursor };
        }
      } catch (err) {}
    }

    const filtered = memMessages.filter((m) => m.channelId === channelId);
    return { messages: filtered };
  }

  async getMissedMessages(channelId: string, afterTimestamp: string): Promise<MessageRecord[]> {
    const afterDate = new Date(afterTimestamp);

    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const list = await db
          .select({
            id: schema.messages.id,
            channelId: schema.messages.channelId,
            senderId: schema.messages.senderId,
            senderName: schema.devices.displayName,
            clientMessageId: schema.messages.clientMessageId,
            content: schema.messages.content,
            contentType: schema.messages.contentType,
            replyToId: schema.messages.replyToId,
            attachments: schema.messages.attachments,
            createdAt: schema.messages.createdAt,
            editedAt: schema.messages.editedAt,
            deletedAt: schema.messages.deletedAt
          })
          .from(schema.messages)
          .innerJoin(schema.devices, eq(schema.messages.senderId, schema.devices.id))
          .where(
            and(
              eq(schema.messages.channelId, channelId),
              gt(schema.messages.createdAt, afterDate)
            )
          )
          .orderBy(schema.messages.createdAt);

        return list as MessageRecord[];
      } catch (err) {}
    }

    return memMessages.filter(
      (m) => m.channelId === channelId && new Date(m.createdAt) > afterDate
    );
  }

  async editMessage(messageId: string, senderId: string, newContent: string): Promise<MessageRecord | null> {
    const editedAt = new Date();

    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const [updated] = await db
          .update(schema.messages)
          .set({ content: newContent, editedAt })
          .where(and(eq(schema.messages.id, messageId), eq(schema.messages.senderId, senderId)))
          .returning();
        if (updated) {
          const [device] = await db.select().from(schema.devices).where(eq(schema.devices.id, senderId)).limit(1);
          return {
            ...updated,
            senderName: device?.displayName || 'Anonymous',
            contentType: updated.contentType as 'text' | 'attachment' | 'system'
          } as MessageRecord;
        }
      } catch (err) {}
    }

    const memMsg = memMessages.find((m) => m.id === messageId && m.senderId === senderId);
    if (memMsg) {
      memMsg.content = newContent;
      memMsg.editedAt = editedAt.toISOString();
      return memMsg;
    }
    return null;
  }

  async deleteMessage(messageId: string, senderId: string): Promise<MessageRecord | null> {
    const deletedAt = new Date();

    if (isDatabaseConnected()) {
      try {
        const db = getDb();
        const [deleted] = await db
          .update(schema.messages)
          .set({ deletedAt, content: '[Message deleted]' })
          .where(and(eq(schema.messages.id, messageId), eq(schema.messages.senderId, senderId)))
          .returning();
        if (deleted) {
          const [device] = await db.select().from(schema.devices).where(eq(schema.devices.id, senderId)).limit(1);
          return {
            ...deleted,
            senderName: device?.displayName || 'Anonymous',
            contentType: deleted.contentType as 'text' | 'attachment' | 'system'
          } as MessageRecord;
        }
      } catch (err) {}
    }

    const memMsg = memMessages.find((m) => m.id === messageId && m.senderId === senderId);
    if (memMsg) {
      memMsg.content = '[Message deleted]';
      memMsg.deletedAt = deletedAt.toISOString();
      return memMsg;
    }
    return null;
  }
}

export const messageRepository = new MessageRepository();
