import React, { useEffect, useRef } from 'react';
import { useChatStore } from '../store/useChatStore';
import { MessageComposer } from './MessageComposer';
import { Hash, Trash2, Smile, FileText, CheckCheck, Clock } from 'lucide-react';

export const ChatView: React.FC = () => {
  const {
    activeChannel,
    messages,
    currentUser,
    typingUsers,
    toggleReaction,
    deleteMessage
  } = useChatStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!activeChannel) {
    return (
      <div className="flex-1 bg-dipBg flex flex-col items-center justify-center p-8 text-center select-none">
        <div className="w-16 h-16 bg-dipPanel border border-dipBorder rounded-2xl flex items-center justify-center text-dipSecondary mb-4">
          <Hash className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-dipText mb-1">No Active Channel</h2>
        <p className="text-sm text-dipSecondary max-w-sm">
          Select a channel or direct message from the sidebar to start chatting.
        </p>
      </div>
    );
  }

  const currentTyping = (activeChannel && typingUsers[activeChannel.id]) || [];

  return (
    <div className="flex-1 bg-dipBg flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="h-14 bg-dipPanel border-b border-dipBorder px-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-dipPrimary/10 border border-dipPrimary/20 flex items-center justify-center text-dipPrimary">
            <Hash className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-dipText leading-none">#{activeChannel.name}</h2>
            {activeChannel.description && (
              <p className="text-xs text-dipSecondary mt-1 truncate max-w-md">{activeChannel.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-dipSuccess font-medium bg-dipSuccess/10 border border-dipSuccess/20 px-3 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-dipSuccess animate-ping" />
          <span>Realtime Connected</span>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-dipSecondary space-y-2">
            <div className="w-12 h-12 rounded-full bg-dipPanel border border-dipBorder flex items-center justify-center">
              <Hash className="w-6 h-6 text-dipPrimary" />
            </div>
            <p className="text-sm font-medium text-dipText">Welcome to #{activeChannel.name}!</p>
            <p className="text-xs">This is the start of the #{activeChannel.name} channel.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUser?.id;
            const isDeleted = !!msg.deletedAt;

            return (
              <div
                key={msg.id}
                className={`group flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                    isMe
                      ? 'bg-dipPrimary text-white shadow-md shadow-dipPrimary/20'
                      : 'bg-dipPanel border border-dipBorder text-dipPrimary'
                  }`}
                >
                  {msg.senderName?.[0]?.toUpperCase() || 'U'}
                </div>

                {/* Message Bubble Container */}
                <div className={`max-w-[70%] space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Author Name & Time */}
                  <div className={`flex items-center gap-2 text-xs text-dipSecondary px-1 ${isMe ? 'justify-end' : ''}`}>
                    <span className="font-semibold text-dipText">{msg.senderName}</span>
                    <span>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Bubble */}
                  <div
                    className={`relative rounded-2xl px-4 py-2.5 text-sm transition-all ${
                      isMe
                        ? 'bg-dipPrimary text-white rounded-tr-none'
                        : 'bg-dipPanel border border-dipBorder text-dipText rounded-tl-none'
                    }`}
                  >
                    {isDeleted ? (
                      <span className="italic opacity-60 text-xs">[Message deleted]</span>
                    ) : (
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                    )}

                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {msg.attachments.map((att: any, idx: number) => (
                          <div key={idx} className="rounded-xl overflow-hidden bg-black/20 border border-white/10 p-2">
                            {att.mimeType?.startsWith('image/') ? (
                              <img
                                src={att.url}
                                alt={att.filename}
                                className="max-h-60 rounded-lg object-cover"
                              />
                            ) : (
                              <a
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 text-xs font-medium underline"
                              >
                                <FileText className="w-4 h-4" />
                                <span>{att.filename}</span>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions (Reactions / Delete) */}
                  {!isDeleted && (
                    <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'justify-end' : ''}`}>
                      <button
                        onClick={() => toggleReaction(msg.id, '👍')}
                        className="p-1 hover:bg-dipCard rounded text-xs text-dipSecondary hover:text-white"
                        title="React 👍"
                      >
                        👍
                      </button>
                      <button
                        onClick={() => toggleReaction(msg.id, '❤️')}
                        className="p-1 hover:bg-dipCard rounded text-xs text-dipSecondary hover:text-white"
                        title="React ❤️"
                      >
                        ❤️
                      </button>
                      <button
                        onClick={() => toggleReaction(msg.id, '🔥')}
                        className="p-1 hover:bg-dipCard rounded text-xs text-dipSecondary hover:text-white"
                        title="React 🔥"
                      >
                        🔥
                      </button>
                      {isMe && (
                        <button
                          onClick={() => deleteMessage(msg.id)}
                          className="p-1 hover:bg-dipCard rounded text-xs text-dipSecondary hover:text-dipDanger"
                          title="Delete Message"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      {currentTyping.length > 0 && (
        <div className="px-6 py-1 text-xs text-dipPrimary flex items-center gap-2 bg-dipPanel/50 border-t border-dipBorder/40">
          <span className="w-2 h-2 rounded-full bg-dipPrimary animate-ping" />
          <span>{currentTyping.join(', ')} {currentTyping.length === 1 ? 'is' : 'are'} typing...</span>
        </div>
      )}

      {/* Message Composer */}
      <MessageComposer />
    </div>
  );
};
