import React, { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import { Search, X, Hash, Users, MessageSquare } from 'lucide-react';
import { UserProfile, Channel } from '@dipchats/shared';

export const SearchOverlay: React.FC = () => {
  const { isSearchOpen, setSearchOpen, search, searchResults, setActiveChannel, setActiveProfile, setActiveTab } = useChatStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        search(query);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  if (!isSearchOpen) return null;

  const hasResults =
    searchResults.people.length > 0 ||
    searchResults.channels.length > 0;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center pt-[10vh]" onClick={() => setSearchOpen(false)}>
      <div
        className="bg-dipPanel border border-dipBorder rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-dipBorder">
          <Search className="w-5 h-5 text-dipSecondary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, channels, messages..."
            className="flex-1 bg-transparent text-dipText text-sm focus:outline-none"
          />
          <button onClick={() => setSearchOpen(false)} className="text-dipSecondary hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {!query.trim() ? (
            <div className="p-6 text-center text-dipSecondary text-sm">
              Start typing to search...
            </div>
          ) : !hasResults ? (
            <div className="p-6 text-center text-dipSecondary text-sm">
              No results found for "{query}"
            </div>
          ) : (
            <div className="p-2">
              {searchResults.people.length > 0 && (
                <div className="mb-3">
                  <p className="px-3 py-1 text-xs font-semibold text-dipSecondary uppercase tracking-wider">
                    People
                  </p>
                  {searchResults.people.map((person) => (
                    <button
                      key={person.id}
                      onClick={() => {
                        setActiveProfile(person);
                        setActiveTab('profile');
                        setSearchOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-dipCard transition-all text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-dipPrimary/10 border border-dipPrimary/20 flex items-center justify-center text-xs text-dipPrimary font-medium">
                        {person.displayName[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{person.displayName}</p>
                        {person.username && (
                          <p className="text-xs text-dipSecondary">@{person.username}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchResults.channels.length > 0 && (
                <div>
                  <p className="px-3 py-1 text-xs font-semibold text-dipSecondary uppercase tracking-wider">
                    Channels
                  </p>
                  {searchResults.channels.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => {
                        setActiveChannel(channel);
                        setActiveTab('chats');
                        setSearchOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-dipCard transition-all text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-dipPrimary/10 flex items-center justify-center text-dipPrimary">
                        <Hash className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{channel.name}</p>
                        {channel.description && (
                          <p className="text-xs text-dipSecondary truncate">{channel.description}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
