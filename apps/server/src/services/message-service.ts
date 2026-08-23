import { messageRepository, MessageRecord } from '../repositories/message-repository';
import { channelRepository } from '../repositories/channel-repository';

export class MessageService {
  async saveMessage(data: {
    channelId: string;
    senderId: string;
    senderName: string;
    clientMessageId: string;
    content: string;
    contentType?: 'text' | 'attachment' | 'system';
    replyToId?: string;
    attachments?: any[];
  }): Promise<{ message: MessageRecord; isDuplicate: boolean }> {
    // 1. Verify channel exists
    const channel = await channelRepository.findChannelById(data.channelId);
    if (!channel) {
      throw new Error(`CHANNEL_NOT_FOUND: Channel '${data.channelId}' does not exist.`);
    }

    // 2. Validate content length
    const trimmed = data.content.trim();
    if (!trimmed) {
      throw new Error('MESSAGE_EMPTY: Message content cannot be empty.');
    }

    // 3. Persist via repository
    return await messageRepository.createMessage({
      ...data,
      content: trimmed
    });
  }

  async getHistory(channelId: string, limit = 50, beforeId?: string) {
    return await messageRepository.getChannelHistory(channelId, limit, beforeId);
  }

  async getMissedMessages(channelId: string, afterTimestamp: string) {
    return await messageRepository.getMissedMessages(channelId, afterTimestamp);
  }

  async editMessage(messageId: string, senderId: string, content: string) {
    const trimmed = content.trim();
    if (!trimmed) throw new Error('MESSAGE_EMPTY: Cannot edit to empty content.');
    return await messageRepository.editMessage(messageId, senderId, trimmed);
  }

  async deleteMessage(messageId: string, senderId: string) {
    return await messageRepository.deleteMessage(messageId, senderId);
  }
}

export const messageService = new MessageService();
