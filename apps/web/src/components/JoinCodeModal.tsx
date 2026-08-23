import React, { useState } from 'react';
import { useChatStore } from '../store/useChatStore';
import { X, Link } from 'lucide-react';
import * as api from '../services/api';

export const JoinCodeModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { token, joinChannel } = useChatStore();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [channelInfo, setChannelInfo] = useState<any>(null);

  const handleLookup = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setChannelInfo(null);
    try {
      const cleanCode = code.trim().toUpperCase();
      const channel = await api.getChannelByInviteCode(cleanCode);
      setChannelInfo(channel);
    } catch (err: any) {
      setError(err.message || 'Invalid invite code');
    }
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!channelInfo || !token) return;
    setLoading(true);
    try {
      const cleanCode = code.trim().toUpperCase();
      await api.joinChannelByCode(cleanCode, token);
      useChatStore.getState().setActiveChannel(channelInfo);
      useChatStore.getState().setActiveTab('chats');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to join');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-dipPanel border border-dipBorder rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Join with Code</h2>
          <button onClick={onClose} className="text-dipSecondary hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-dipSecondary mb-1">Invite Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="DIP-XXXX-XX"
              className="w-full bg-dipBg border border-dipBorder rounded-lg px-3 py-2 text-sm text-dipText text-center font-mono tracking-wider focus:outline-none focus:border-dipPrimary"
              maxLength={16}
              autoFocus
            />
          </div>

          {error && <p className="text-xs text-dipDanger">{error}</p>}

          {channelInfo && (
            <div className="bg-dipBg border border-dipBorder rounded-lg p-3">
              <p className="text-sm font-semibold text-white">{channelInfo.name}</p>
              {channelInfo.description && (
                <p className="text-xs text-dipSecondary mt-1">{channelInfo.description}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-dipBg border border-dipBorder text-dipSecondary rounded-lg text-sm font-medium hover:bg-dipCard transition-all"
          >
            Cancel
          </button>
          {channelInfo ? (
            <button
              onClick={handleJoin}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-dipPrimary hover:bg-dipPrimaryHover text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            >
              {loading ? 'Joining...' : 'Join Chat'}
            </button>
          ) : (
            <button
              onClick={handleLookup}
              disabled={loading || !code.trim()}
              className="flex-1 px-4 py-2 bg-dipPrimary hover:bg-dipPrimaryHover text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            >
              {loading ? 'Looking up...' : 'Look Up'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
