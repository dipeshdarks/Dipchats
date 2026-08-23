import React, { useState } from 'react';
import { useChatStore } from '../store/useChatStore';
import { ArrowLeft, MessageSquare, Shield, UserX } from 'lucide-react';
import { UserProfile as UserProfileType } from '@dipchats/shared';
import * as api from '../services/api';

export const UserProfileView: React.FC = () => {
  const { activeProfile, setActiveProfile, setActiveTab, openDm, token, currentUser } = useChatStore();
  const [actionLoading, setActionLoading] = useState(false);

  if (!activeProfile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-dipBg text-dipSecondary">
        Select a user to view their profile
      </div>
    );
  }

  const isMe = currentUser?.id === activeProfile.id;

  const handleBlock = async () => {
    if (!token) return;
    setActionLoading(true);
    try {
      await api.blockUser(activeProfile.id, token);
      setActiveProfile(null);
      setActiveTab('chats');
    } catch {}
    setActionLoading(false);
  };

  const handleMessage = () => {
    openDm(activeProfile.id);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-dipBg">
      <div className="px-6 py-4 border-b border-dipBorder bg-dipPanel/50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setActiveProfile(null);
              setActiveTab('people');
            }}
            className="text-dipSecondary hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-white">Profile</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-dipPrimary/10 border-2 border-dipPrimary/30 flex items-center justify-center text-2xl text-dipPrimary font-bold mb-3">
            {activeProfile.avatarUrl ? (
              <img src={activeProfile.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              activeProfile.displayName[0]?.toUpperCase()
            )}
          </div>
          <h2 className="text-xl font-bold text-white">{activeProfile.displayName}</h2>
          {activeProfile.username && (
            <p className="text-sm text-dipSecondary">@{activeProfile.username}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                activeProfile.status === 'online' ? 'bg-dipSuccess' : activeProfile.status === 'idle' ? 'bg-dipWarning' : 'bg-dipSecondary/40'
              }`}
            />
            <span className="text-xs text-dipSecondary capitalize">{activeProfile.status}</span>
          </div>
          {activeProfile.bio && (
            <p className="text-sm text-dipSecondary mt-3 max-w-xs">{activeProfile.bio}</p>
          )}
        </div>

        {!isMe && (
          <div className="space-y-3 max-w-xs mx-auto">
            <button
              onClick={handleMessage}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-dipPrimary hover:bg-dipPrimaryHover text-white font-semibold rounded-xl transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              Message
            </button>
            <button
              onClick={handleBlock}
              disabled={actionLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-dipBg border border-dipBorder text-dipDanger font-semibold rounded-xl hover:border-dipDanger transition-all disabled:opacity-50"
            >
              <UserX className="w-4 h-4" />
              Block User
            </button>
          </div>
        )}

        <div className="mt-8 space-y-4 max-w-xs mx-auto">
          <div className="bg-dipPanel border border-dipBorder rounded-xl p-4">
            <p className="text-xs font-semibold text-dipSecondary uppercase tracking-wider mb-2">Joined</p>
            <p className="text-sm text-dipText">{new Date(activeProfile.lastSeen).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
