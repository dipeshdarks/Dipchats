import React, { useEffect, useState } from 'react';
import { useChatStore } from '../store/useChatStore';
import { Users, Search, MessageSquare, ArrowLeft } from 'lucide-react';
import { UserProfile } from '@dipchats/shared';

type Filter = 'all' | 'online' | 'nearby';

export const PeopleList: React.FC = () => {
  const { token, discoverPeople, loadDiscoverPeople, openDm, setActiveTab, setActiveProfile } = useChatStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadDiscoverPeople();
  }, []);

  const filteredPeople = discoverPeople.filter((p) => {
    if (filter === 'online') return p.status === 'online';
    return true;
  }).filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.displayName.toLowerCase().includes(q) ||
      (p.username && p.username.toLowerCase().includes(q))
    );
  });

  const onlineCount = discoverPeople.filter((p) => p.status === 'online').length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-dipBg">
      <div className="px-6 py-4 border-b border-dipBorder bg-dipPanel/50">
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveTab('chats')} className="text-dipSecondary hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Users className="w-5 h-5 text-dipPrimary" />
          <h1 className="text-lg font-bold text-white">People</h1>
          <span className="text-xs text-dipSecondary ml-auto">{onlineCount} online</span>
        </div>
        <div className="mt-3 relative">
          <Search className="w-4 h-4 text-dipSecondary absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search people..."
            className="w-full bg-dipBg border border-dipBorder rounded-lg pl-9 pr-3 py-2 text-sm text-dipText focus:outline-none focus:border-dipPrimary"
          />
        </div>
        <div className="flex gap-2 mt-3">
          {(['all', 'online', 'nearby'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === f
                  ? 'bg-dipPrimary text-white'
                  : 'bg-dipBg text-dipSecondary border border-dipBorder hover:border-dipPrimary'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredPeople.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-dipSecondary/30 mx-auto mb-3" />
            <p className="text-dipSecondary">No people found</p>
            <p className="text-xs text-dipSecondary/60 mt-1">People will appear here when they join DipChats</p>
          </div>
        ) : (
          filteredPeople.map((person) => (
            <div
              key={person.id}
              className="flex items-center gap-3 bg-dipPanel border border-dipBorder rounded-lg p-3 hover:border-dipPrimary/30 transition-all cursor-pointer"
              onClick={() => {
                setActiveProfile(person);
                setActiveTab('profile');
              }}
            >
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-dipPrimary/10 border border-dipPrimary/20 flex items-center justify-center text-sm text-dipPrimary font-medium">
                  {person.avatarUrl ? (
                    <img src={person.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    person.displayName[0]?.toUpperCase()
                  )}
                </div>
                <span
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-dipPanel ${
                    person.status === 'online' ? 'bg-dipSuccess' : person.status === 'idle' ? 'bg-dipWarning' : 'bg-dipSecondary/40'
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{person.displayName}</p>
                {person.username && <p className="text-xs text-dipSecondary truncate">@{person.username}</p>}
                {person.bio && <p className="text-xs text-dipSecondary/60 truncate">{person.bio}</p>}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openDm(person.id);
                }}
                className="p-2 text-dipSecondary hover:text-dipPrimary hover:bg-dipCard rounded-lg transition-all"
                title="Message"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
