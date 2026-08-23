import React, { useEffect } from 'react';
import { useChatStore } from './store/useChatStore';
import { JoinScreen } from './components/JoinScreen';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { MeshView } from './components/MeshView';
import { SettingsView } from './components/SettingsView';
import { DiscoverPage } from './components/DiscoverPage';
import { ChannelBrowser } from './components/ChannelBrowser';
import { PeopleList } from './components/PeopleList';
import { UserProfileView } from './components/UserProfileView';
import { DMView } from './components/DMView';
import { SearchOverlay } from './components/SearchOverlay';
import { Folder } from 'lucide-react';

export const App: React.FC = () => {
  const { isJoined, activeTab, initSession } = useChatStore();

  useEffect(() => {
    initSession();
  }, []);

  if (!isJoined) {
    return <JoinScreen />;
  }

  return (
    <div className="flex h-screen w-screen bg-dipBg overflow-hidden select-none">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {activeTab === 'chats' ? (
          <ChatView />
        ) : activeTab === 'channels' ? (
          <ChannelBrowser />
        ) : activeTab === 'discover' ? (
          <DiscoverPage />
        ) : activeTab === 'people' ? (
          <PeopleList />
        ) : activeTab === 'profile' ? (
          <UserProfileView />
        ) : activeTab === 'dm' ? (
          <DMView />
        ) : activeTab === 'mesh' ? (
          <MeshView />
        ) : activeTab === 'settings' ? (
          <SettingsView />
        ) : (
          <div className="flex-1 bg-dipBg flex flex-col items-center justify-center p-8 text-center text-dipSecondary">
            <Folder className="w-12 h-12 text-dipPrimary mb-3" />
            <h2 className="text-lg font-bold text-dipText">Files & Media Storage</h2>
            <p className="text-sm max-w-sm mt-1">
              Shared attachments, images, and documents across channels will be indexed here.
            </p>
          </div>
        )}
      </div>

      <SearchOverlay />
    </div>
  );
};

export default App;
