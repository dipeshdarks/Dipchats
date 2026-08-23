import React, { useEffect, useState } from 'react';
import { useChatStore } from '../store/useChatStore';
import { Hash, Search, Plus, ArrowLeft } from 'lucide-react';
import { Channel } from '@dipchats/shared';
import * as api from '../services/api';

export const ChannelBrowser: React.FC = () => {
  const { token, myChannels, joinChannel, setActiveChannel, setActiveTab } = useChatStore();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    setLoading(true);
    try {
      const chans = await api.fetchDiscoverChannels();
      setChannels(chans);
    } catch {}
    setLoading(false);
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      loadChannels();
      return;
    }
    try {
      const results = await api.searchChannels(q);
      setChannels(results);
    } catch {}
  };

  const isJoined = (channelId: string) => myChannels.some((c) => c.id === channelId);

  const filteredChannels = channels.filter(
    (c) => c.privacy === 'public' || c.privacy === 'discoverable'
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-dipBg">
      <div className="px-6 py-4 border-b border-dipBorder bg-dipPanel/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveTab('chats')} className="text-dipSecondary hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Hash className="w-5 h-5 text-dipPrimary" />
            <h1 className="text-lg font-bold text-white">Browse Chats</h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-dipPrimary hover:bg-dipPrimaryHover text-white text-xs font-semibold rounded-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            Create
          </button>
        </div>
        <div className="mt-3 relative">
          <Search className="w-4 h-4 text-dipSecondary absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search channels..."
            className="w-full bg-dipBg border border-dipBorder rounded-lg pl-9 pr-3 py-2 text-sm text-dipText focus:outline-none focus:border-dipPrimary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <div className="text-center py-12 text-dipSecondary">Loading channels...</div>
        ) : filteredChannels.length === 0 ? (
          <div className="text-center py-12">
            <Hash className="w-12 h-12 text-dipSecondary/30 mx-auto mb-3" />
            <p className="text-dipSecondary">No channels found</p>
          </div>
        ) : (
          filteredChannels.map((channel) => (
            <div
              key={channel.id}
              className="flex items-center justify-between bg-dipPanel border border-dipBorder rounded-lg p-4 hover:border-dipPrimary/30 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-lg bg-dipPrimary/10 flex items-center justify-center text-dipPrimary shrink-0">
                  {channel.avatarUrl ? (
                    <img src={channel.avatarUrl} alt="" className="w-full h-full rounded-lg object-cover" />
                  ) : (
                    <Hash className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{channel.name}</p>
                  {channel.description && (
                    <p className="text-xs text-dipSecondary truncate max-w-xs">{channel.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-dipSecondary/60">{channel.memberCount || 0} members</span>
                    <span className="text-xs text-dipSuccess">{channel.onlineCount || 0} online</span>
                  </div>
                </div>
              </div>
              {isJoined(channel.id) ? (
                <button
                  onClick={() => {
                    setActiveChannel(channel);
                    setActiveTab('chats');
                  }}
                  className="px-3 py-1.5 bg-dipCard text-dipSecondary text-xs font-semibold rounded-lg border border-dipBorder hover:border-dipPrimary transition-all"
                >
                  Open
                </button>
              ) : (
                <button
                  onClick={() => joinChannel(channel.id)}
                  className="px-3 py-1.5 bg-dipPrimary hover:bg-dipPrimaryHover text-white text-xs font-semibold rounded-lg transition-all"
                >
                  Join
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <CreateChannelModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
};

const CreateChannelModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { createChannel } = useChatStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState('public');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Channel name is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await createChannel({ name: name.trim(), description: description.trim() || undefined, privacy });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create channel');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-dipPanel border border-dipBorder rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white mb-4">Create Channel</h2>
        {error && <p className="text-xs text-dipDanger mb-3">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-dipSecondary mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. gaming, music"
              className="w-full bg-dipBg border border-dipBorder rounded-lg px-3 py-2 text-sm text-dipText focus:outline-none focus:border-dipPrimary"
              maxLength={64}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-dipSecondary mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this channel about?"
              className="w-full bg-dipBg border border-dipBorder rounded-lg px-3 py-2 text-sm text-dipText focus:outline-none focus:border-dipPrimary"
              maxLength={500}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-dipSecondary mb-1">Privacy</label>
            <select
              value={privacy}
              onChange={(e) => setPrivacy(e.target.value)}
              className="w-full bg-dipBg border border-dipBorder rounded-lg px-3 py-2 text-sm text-dipText focus:outline-none focus:border-dipPrimary"
            >
              <option value="public">Public - Anyone can join</option>
              <option value="discoverable">Discoverable - Found but needs approval</option>
              <option value="invite_only">Invite Only - Requires invite code</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-dipBg border border-dipBorder text-dipSecondary rounded-lg text-sm font-medium hover:bg-dipCard transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="flex-1 px-4 py-2 bg-dipPrimary hover:bg-dipPrimaryHover text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};
