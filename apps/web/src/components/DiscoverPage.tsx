import React, { useEffect, useState } from 'react';
import { useChatStore } from '../store/useChatStore';
import { Hash, Users, TrendingUp, Plus, Search, Compass } from 'lucide-react';
import { Channel, UserProfile } from '@dipchats/shared';
import * as api from '../services/api';

export const DiscoverPage: React.FC = () => {
  const { token, channels, discoverPeople, joinChannel, setActiveChannel, setActiveTab } = useChatStore();
  const [trending, setTrending] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const chans = await api.fetchDiscoverChannels();
        setTrending(chans);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const onlinePeople = discoverPeople.filter((p) => p.status === 'online');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-dipBg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-dipBorder bg-dipPanel/50">
        <div className="flex items-center gap-3">
          <Compass className="w-6 h-6 text-dipPrimary" />
          <h1 className="text-xl font-bold text-white">Discover</h1>
        </div>
        <p className="text-sm text-dipSecondary mt-1">Find people and conversations on DipChats</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setActiveTab('channels')}
            className="flex items-center gap-3 bg-dipPanel border border-dipBorder rounded-xl p-4 hover:border-dipPrimary/50 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-dipPrimary/10 flex items-center justify-center">
              <Hash className="w-5 h-5 text-dipPrimary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Browse Chats</p>
              <p className="text-xs text-dipSecondary">Find public channels</p>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('people')}
            className="flex items-center gap-3 bg-dipPanel border border-dipBorder rounded-xl p-4 hover:border-dipPrimary/50 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-dipSuccess/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-dipSuccess" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Find People</p>
              <p className="text-xs text-dipSecondary">Discover users</p>
            </div>
          </button>
        </div>

        {/* Online People */}
        {onlinePeople.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-dipSuccess animate-pulse" />
              <h2 className="text-sm font-semibold text-dipSecondary uppercase tracking-wider">
                People Online ({onlinePeople.length})
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {onlinePeople.slice(0, 6).map((person) => (
                <button
                  key={person.id}
                  onClick={() => useChatStore.getState().openDm(person.id)}
                  className="flex items-center gap-3 bg-dipPanel border border-dipBorder rounded-lg p-3 hover:border-dipPrimary/50 transition-all text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-dipPrimary/10 border border-dipPrimary/20 flex items-center justify-center text-sm text-dipPrimary font-medium">
                    {person.avatarUrl ? (
                      <img src={person.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      person.displayName[0]?.toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{person.displayName}</p>
                    {person.username && (
                      <p className="text-xs text-dipSecondary truncate">@{person.username}</p>
                    )}
                    {person.bio && (
                      <p className="text-xs text-dipSecondary/60 truncate">{person.bio}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Trending Channels */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-dipWarning" />
            <h2 className="text-sm font-semibold text-dipSecondary uppercase tracking-wider">
              Public Channels
            </h2>
          </div>
          {loading ? (
            <div className="text-center py-8 text-dipSecondary">Loading...</div>
          ) : trending.length === 0 ? (
            <div className="text-center py-8 text-dipSecondary">No channels found</div>
          ) : (
            <div className="space-y-2">
              {trending.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between bg-dipPanel border border-dipBorder rounded-lg p-3 hover:border-dipPrimary/30 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-dipPrimary/10 flex items-center justify-center text-dipPrimary">
                      <Hash className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{channel.name}</p>
                      {channel.description && (
                        <p className="text-xs text-dipSecondary truncate">{channel.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-dipSecondary/60">
                          {channel.memberCount || 0} members
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => joinChannel(channel.id)}
                    className="px-3 py-1.5 bg-dipPrimary hover:bg-dipPrimaryHover text-white text-xs font-semibold rounded-lg transition-all shrink-0"
                  >
                    Join
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
