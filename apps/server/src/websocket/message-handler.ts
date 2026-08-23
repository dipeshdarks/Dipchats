import { WSFrame, createAckFrame, createErrorFrame, createWSFrame } from './protocol';
import { connectionManager, ConnectedSocket } from './connection-manager';
import { sessionService } from '../services/session-service';
import { messageService } from '../services/message-service';
import { channelRepository } from '../repositories/channel-repository';
import { presenceService } from '../services/presence-service';
import { publishEvent } from '../services/redis-service';
import { userRepository } from '../repositories/user-repository';

export async function handleIncomingWSFrame(socket: ConnectedSocket, frame: WSFrame) {
  const { type, payload, requestId } = frame;

  try {
    switch (type) {
      case 'auth.join': {
        const { token } = (payload as { token: string }) || {};
        if (!token) {
          return connectionManager.sendToSocket(socket, createErrorFrame('Token required', 'AUTH_REQUIRED', requestId));
        }

        const device = await sessionService.authenticateToken(token);
        if (!device) {
          return connectionManager.sendToSocket(socket, createErrorFrame('Invalid or expired token', 'AUTH_EXPIRED', requestId));
        }

        connectionManager.authenticateUser(socket, device.id, device.displayName);

        // Auto-subscribe to user's joined channels
        const myChannels = await channelRepository.getDeviceChannels(device.id);
        for (const chan of myChannels) {
          connectionManager.subscribeChannel(socket, chan.id);
        }

        // Also subscribe to all public channels for discovery
        const publicChannels = await channelRepository.listPublicChannels();
        for (const chan of publicChannels) {
          connectionManager.subscribeChannel(socket, chan.id);
        }

        // Send auth.success with profile
        connectionManager.sendToSocket(
          socket,
          createWSFrame('auth.success' as any, {
            device: {
              id: device.id,
              deviceId: device.deviceId,
              displayName: device.displayName,
              username: device.username,
              avatarUrl: device.displayAvatar,
              bio: device.bio,
              discoverable: device.discoverable
            }
          }, requestId)
        );

        // Update presence and broadcast
        const pres = await presenceService.setPresence(device.id, 'online');
        const presenceFrame = createWSFrame('presence.changed' as any, pres);
        connectionManager.broadcastGlobal(presenceFrame, socket.id);
        await publishEvent(presenceFrame);
        break;
      }

      case 'channel.join': {
        if (!socket.userId) {
          return connectionManager.sendToSocket(socket, createErrorFrame('Not authenticated', 'UNAUTHORIZED', requestId));
        }

        const { channelId } = (payload as { channelId: string }) || {};
        if (!channelId) return;

        const channel = await channelRepository.findChannelById(channelId);
        if (!channel) {
          return connectionManager.sendToSocket(socket, createErrorFrame('Channel not found', 'NOT_FOUND', requestId));
        }

        // Check membership
        const isMember = await channelRepository.isMember(channelId, socket.userId);
        if (!isMember) {
          // Auto-join public channels
          if (channel.privacy === 'public' || channel.privacy === 'discoverable') {
            await channelRepository.addMember(channelId, socket.userId);
          } else {
            return connectionManager.sendToSocket(socket, createErrorFrame('Not a member', 'FORBIDDEN', requestId));
          }
        }

        connectionManager.subscribeChannel(socket, channelId);
        connectionManager.sendToSocket(
          socket,
          createWSFrame('channel.joined' as any, { channelId, channel }, requestId)
        );

        // Broadcast member_joined
        const memberJoinedFrame = createWSFrame('channel.member_joined' as any, {
          channelId,
          userId: socket.userId,
          displayName: socket.displayName
        });
        connectionManager.broadcastToChannel(channelId, memberJoinedFrame, socket.id);
        await publishEvent({ channelId, frame: memberJoinedFrame });
        break;
      }

      case 'channel.leave': {
        const { channelId } = (payload as { channelId: string }) || {};
        if (channelId) {
          connectionManager.unsubscribeChannel(socket, channelId);

          if (socket.userId) {
            await channelRepository.removeMember(channelId, socket.userId);

            const memberLeftFrame = createWSFrame('channel.member_left' as any, {
              channelId,
              userId: socket.userId,
              displayName: socket.displayName
            });
            connectionManager.broadcastToChannel(channelId, memberLeftFrame);
            await publishEvent({ channelId, frame: memberLeftFrame });
          }
        }
        break;
      }

      case 'message.send': {
        if (!socket.userId || !socket.displayName) {
          return connectionManager.sendToSocket(socket, createErrorFrame('Unauthenticated socket', 'UNAUTHORIZED', requestId));
        }

        const { channelId, content, clientMessageId, replyToId, attachments } = (payload as {
          channelId: string;
          content: string;
          clientMessageId: string;
          replyToId?: string;
          attachments?: any[];
        }) || {};

        if (!channelId || !content || !clientMessageId) {
          return connectionManager.sendToSocket(socket, createErrorFrame('channelId, content, and clientMessageId are required', 'INVALID_PAYLOAD', requestId));
        }

        const { message, isDuplicate } = await messageService.saveMessage({
          channelId,
          senderId: socket.userId,
          senderName: socket.displayName,
          clientMessageId,
          content,
          replyToId,
          attachments
        });

        if (requestId) {
          const ackFrame = createAckFrame(requestId, message.id, clientMessageId, isDuplicate ? 'duplicate' : 'persisted');
          connectionManager.sendToSocket(socket, ackFrame);
        }

        const newMsgFrame = createWSFrame('message.new' as any, message);
        connectionManager.broadcastToChannel(channelId, newMsgFrame, socket.id);
        await publishEvent({ channelId, frame: newMsgFrame });
        break;
      }

      case 'message.edit': {
        if (!socket.userId) return;
        const { messageId, content } = (payload as { messageId: string; content: string }) || {};
        if (!messageId || !content) return;

        const updated = await messageService.editMessage(messageId, socket.userId, content);
        if (updated) {
          const editFrame = createWSFrame('message.updated' as any, updated, requestId);
          connectionManager.broadcastToChannel(updated.channelId, editFrame);
          await publishEvent({ channelId: updated.channelId, frame: editFrame });
        }
        break;
      }

      case 'message.delete': {
        if (!socket.userId) return;
        const { messageId } = (payload as { messageId: string }) || {};
        if (!messageId) return;

        const deleted = await messageService.deleteMessage(messageId, socket.userId);
        if (deleted) {
          const deleteFrame = createWSFrame('message.deleted' as any, { id: deleted.id, channelId: deleted.channelId }, requestId);
          connectionManager.broadcastToChannel(deleted.channelId, deleteFrame);
          await publishEvent({ channelId: deleted.channelId, frame: deleteFrame });
        }
        break;
      }

      case 'typing.start': {
        if (!socket.userId || !socket.displayName) return;
        const { channelId } = (payload as { channelId: string }) || {};
        if (!channelId) return;

        await presenceService.setTyping(channelId, socket.userId, true);
        const typingFrame = createWSFrame('typing.update' as any, {
          channelId,
          deviceId: socket.userId,
          displayName: socket.displayName,
          isTyping: true
        });
        connectionManager.broadcastToChannel(channelId, typingFrame, socket.id);
        break;
      }

      case 'typing.stop': {
        if (!socket.userId || !socket.displayName) return;
        const { channelId } = (payload as { channelId: string }) || {};
        if (!channelId) return;

        await presenceService.setTyping(channelId, socket.userId, false);
        const typingFrame = createWSFrame('typing.update' as any, {
          channelId,
          deviceId: socket.userId,
          displayName: socket.displayName,
          isTyping: false
        });
        connectionManager.broadcastToChannel(channelId, typingFrame, socket.id);
        break;
      }

      case 'presence.update': {
        if (!socket.userId) return;
        const { status } = (payload as { status: string }) || {};
        if (!status) return;

        const pres = await presenceService.setPresence(socket.userId, status);
        const presenceFrame = createWSFrame('presence.changed' as any, pres);
        connectionManager.broadcastGlobal(presenceFrame);
        break;
      }

      case 'sync.request': {
        const { channelId, afterTimestamp } = (payload as { channelId: string; afterTimestamp: string }) || {};
        if (!channelId || !afterTimestamp) return;

        const missed = await messageService.getMissedMessages(channelId, afterTimestamp);
        connectionManager.sendToSocket(
          socket,
          createWSFrame('sync.response' as any, { channelId, messages: missed }, requestId)
        );
        break;
      }

      case 'people.discover': {
        const people = await userRepository.listDiscoverableDevices();
        const enriched = await Promise.all(
          people
            .filter((p) => p.id !== socket.userId)
            .map(async (p) => {
              const status = await presenceService.getPresence(p.id);
              return {
                id: p.id,
                displayName: p.displayName,
                username: p.username,
                avatarUrl: p.displayAvatar,
                bio: p.bio,
                status,
                lastSeen: p.lastSeen
              };
            })
        );
        connectionManager.sendToSocket(
          socket,
          createWSFrame('people.discover' as any, { people: enriched }, requestId)
        );
        break;
      }

      case 'dm.created': {
        if (!socket.userId) return;
        const { targetUserId } = (payload as { targetUserId: string }) || {};
        if (!targetUserId) return;

        // Find or create DM channel
        const dmChannel = await channelRepository.createChannel({
          name: `dm_${socket.userId}_${targetUserId}`,
          type: 'dm',
          privacy: 'private',
          ownerId: socket.userId
        });

        await channelRepository.addMember(dmChannel.id, targetUserId);
        connectionManager.subscribeChannel(socket, dmChannel.id);

        connectionManager.sendToSocket(
          socket,
          createWSFrame('dm.created' as any, { channel: dmChannel }, requestId)
        );
        break;
      }
    }
  } catch (err: any) {
    console.error('Error handling WebSocket frame:', err);
    connectionManager.sendToSocket(socket, createErrorFrame(err.message || 'Internal server error', 'SERVER_ERROR', requestId));
  }
}
