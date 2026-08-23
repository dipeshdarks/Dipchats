import React, { useRef, useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import { ArrowLeft } from 'lucide-react';
import { MessageComposer } from './MessageComposer';

export const DMView: React.FC = () => {
  const {
    activeDmChannel,
    messages,
    currentUser,
    typingUsers,
    setActiveTab,
    setActiveDmChannel
  } = useChatStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!activeDmChannel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-dipBg text-dipSecondary">
        Select a conversation
      </div>
    );
  }

  const channelTyping = typingUsers[activeDmChannel.id] || [];

  return (
    <div className="flex-1 flex flex-col h-full bg-dipBg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-dipBorder bg-dipPanel/50 flex items-center gap-3">
        <button
          onClick={() => {
            setActiveDmChannel(null);
            setActiveTab('chats');
          }}
          className="text-dipSecondary hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-sm font-bold text-white">Direct Message</h2>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-dipSecondary">
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-1">Send a message to start the conversation</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === currentUser?.id;
            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                    isMine
                      ? 'bg-dipPrimary text-white rounded-br-sm'
                      : 'bg-dipCard text-dipText border border-dipBorder rounded-bl-sm'
                  }`}
                >
                  {!isMine && (
                    <p className="text-xs font-semibold text-dipPrimary mb-1">{msg.senderName}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-white/60' : 'text-dipSecondary/60'}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {channelTyping.length > 0 && (
        <div className="px-4 py-1">
          <p className="text-xs text-dipSecondary">
            {channelTyping.join(', ')} {channelTyping.length === 1 ? 'is' : 'are'} typing...
          </p>
        </div>
      )}

      {/* Composer */}
      <MessageComposer />
    </div>
  );
};
