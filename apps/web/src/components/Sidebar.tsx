import React from 'react';
import { useChatStore, NavTab } from '../store/useChatStore';
import {
  MessageSquare,
  Hash,
  Radio,
  Folder,
  Settings,
  LogOut,
  Plus,
  Users,
  Search,
  Compass,
  UserCircle
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    currentUser,
    activeTab,
    setActiveTab,
    channels,
    myChannels,
    activeChannel,
    setActiveChannel,
    users,
    discoverPeople,
    logout,
    isConnected,
    setSearchOpen
  } = useChatStore();

  return (
    <div className="flex h-full bg-dipBg border-r border-dipBorder select-none">
      {/* Column 1: Icon Navigation Bar */}
      <div className="w-16 bg-dipPanel border-r border-dipBorder flex flex-col items-center py-4 justify-between z-20">
        <div className="flex flex-col items-center gap-6 w-full">
          <div className="w-10 h-10 bg-dipPrimary/10 border border-dipPrimary/30 rounded-xl flex items-center justify-center text-dipPrimary font-bold text-xl cursor-pointer hover:bg-dipPrimary/20 transition-all">
            D
          </div>

          <nav className="flex flex-col gap-2 w-full px-2">
            <button
              onClick={() => setActiveTab('chats')}
              title="Chats"
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                activeTab === 'chats'
                  ? 'bg-dipPrimary text-white shadow-lg shadow-dipPrimary/20'
                  : 'text-dipSecondary hover:bg-dipCard hover:text-white'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveTab('channels')}
              title="Channels"
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                activeTab === 'channels'
                  ? 'bg-dipPrimary text-white shadow-lg shadow-dipPrimary/20'
                  : 'text-dipSecondary hover:bg-dipCard hover:text-white'
              }`}
            >
              <Hash className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveTab('discover')}
              title="Discover"
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all relative ${
                activeTab === 'discover'
                  ? 'bg-dipPrimary text-white shadow-lg shadow-dipPrimary/20'
                  : 'text-dipSecondary hover:bg-dipCard hover:text-white'
              }`}
            >
              <Compass className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveTab('people')}
              title="People"
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all relative ${
                activeTab === 'people'
                  ? 'bg-dipPrimary text-white shadow-lg shadow-dipPrimary/20'
                  : 'text-dipSecondary hover:bg-dipCard hover:text-white'
              }`}
            >
              <Users className="w-5 h-5" />
              {discoverPeople.filter((p) => p.status === 'online').length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-dipSuccess animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('mesh')}
              title="Mesh Network"
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all relative ${
                activeTab === 'mesh'
                  ? 'bg-dipPrimary text-white shadow-lg shadow-dipPrimary/20'
                  : 'text-dipSecondary hover:bg-dipCard hover:text-white'
              }`}
            >
              <Radio className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-dipSuccess animate-ping" />
            </button>
          </nav>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => setActiveTab('settings')}
            title="Settings"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              activeTab === 'settings'
                ? 'bg-dipPrimary text-white'
                : 'text-dipSecondary hover:bg-dipCard hover:text-white'
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className="w-10 h-10 rounded-full bg-dipPrimary/20 border border-dipPrimary/40 flex items-center justify-center text-dipPrimary font-semibold cursor-pointer relative hover:bg-dipPrimary/30 transition-all"
            title={currentUser?.displayName}
          >
            {currentUser?.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              currentUser?.displayName?.[0]?.toUpperCase() || 'U'
            )}
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-dipPanel ${
                isConnected ? 'bg-dipSuccess' : 'bg-dipWarning'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Column 2: Chat & Channel List Column */}
      <div className="w-64 bg-dipPanel flex flex-col h-full overflow-hidden">
        <div className="p-3 border-b border-dipBorder">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2 bg-dipBg border border-dipBorder rounded-lg px-3 py-1.5 text-xs text-dipSecondary hover:border-dipPrimary transition-colors"
          >
            <Search className="w-4 h-4" />
            <span>Search...</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          {/* My Channels */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-dipSecondary uppercase tracking-wider mb-2 px-1">
              <span>My Chats</span>
              <button
                onClick={() => setActiveTab('channels')}
                title="Browse Channels"
                className="hover:text-white transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              {myChannels.length === 0 && channels.length === 0 ? (
                <p className="text-xs text-dipSecondary/60 px-3 py-2">No chats yet</p>
              ) : (
                (myChannels.length > 0 ? myChannels : channels).map((chan) => (
                  <button
                    key={chan.id}
                    onClick={() => setActiveChannel(chan)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeChannel?.id === chan.id
                        ? 'bg-dipCard text-white border-l-2 border-dipPrimary'
                        : 'text-dipSecondary hover:bg-dipCard/50 hover:text-dipText'
                    }`}
                  >
                    <Hash className="w-4 h-4 text-dipPrimary/70" />
                    <span className="truncate">{chan.name}</span>
                    {chan.memberCount !== undefined && (
                      <span className="ml-auto text-xs text-dipSecondary/50">{chan.memberCount}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* People */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-dipSecondary uppercase tracking-wider mb-2 px-1">
              <span>People Online</span>
              <button
                onClick={() => setActiveTab('people')}
                className="hover:text-white transition-colors"
              >
                <Users className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1">
              {users.length === 0 ? (
                <p className="text-xs text-dipSecondary/60 px-3 py-2">No one online</p>
              ) : (
                users.slice(0, 8).map((u) => (
                  <button
                    key={u.deviceId}
                    onClick={() => {
                      useChatStore.getState().openDm(u.deviceId);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-dipSecondary hover:bg-dipCard/50 hover:text-dipText cursor-pointer transition-all"
                  >
                    <div className="w-7 h-7 rounded-full bg-dipPrimary/10 border border-dipPrimary/20 flex items-center justify-center text-xs text-dipPrimary font-medium relative">
                      {u.displayName[0]?.toUpperCase()}
                      <span
                        className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-dipPanel ${
                          u.status === 'online' ? 'bg-dipSuccess' : u.status === 'idle' ? 'bg-dipWarning' : 'bg-dipSecondary/40'
                        }`}
                      />
                    </div>
                    <span className="truncate font-medium">{u.displayName}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-dipBorder flex items-center justify-between text-xs bg-dipBg/50">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-2 h-2 rounded-full bg-dipSuccess animate-pulse" />
            <span className="truncate font-medium text-dipText">{currentUser?.displayName}</span>
          </div>
          <button
            onClick={logout}
            title="Disconnect & Exit"
            className="text-dipSecondary hover:text-dipDanger transition-colors p-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
