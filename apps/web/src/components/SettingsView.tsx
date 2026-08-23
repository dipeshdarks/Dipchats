import React, { useState } from 'react';
import { useChatStore } from '../store/useChatStore';
import { Settings, Shield, Wifi, WifiOff, Edit3, Save, X } from 'lucide-react';
import * as api from '../services/api';

export const SettingsView: React.FC = () => {
  const { currentUser, token, logout, isConnected } = useChatStore();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const updated = await api.updateProfile(token, {
        displayName: displayName.trim() || undefined,
        username: username.trim() || undefined,
        bio: bio.trim() || undefined
      });
      useChatStore.setState({
        currentUser: {
          ...currentUser!,
          displayName: updated.displayName,
          username: updated.username ?? undefined,
          bio: updated.bio ?? undefined
        }
      });
      setEditing(false);
    } catch {}
    setSaving(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-dipBg">
      <div className="px-6 py-4 border-b border-dipBorder bg-dipPanel/50">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-dipPrimary" />
          <h1 className="text-lg font-bold text-white">Settings</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Profile Card */}
        <div className="bg-dipPanel border border-dipBorder rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-dipSecondary uppercase tracking-wider">Profile</h2>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-xs text-dipPrimary hover:text-dipPrimaryHover"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="text-xs text-dipSecondary hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1 text-xs text-dipPrimary hover:text-dipPrimaryHover disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-dipPrimary/10 border-2 border-dipPrimary/30 flex items-center justify-center text-xl text-dipPrimary font-bold">
              {currentUser?.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                currentUser?.displayName?.[0]?.toUpperCase() || 'U'
              )}
            </div>
            <div>
              {editing ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="bg-dipBg border border-dipBorder rounded px-2 py-1 text-sm text-dipText focus:outline-none focus:border-dipPrimary"
                    placeholder="Display name"
                  />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-dipBg border border-dipBorder rounded px-2 py-1 text-sm text-dipText focus:outline-none focus:border-dipPrimary"
                    placeholder="Username"
                  />
                </div>
              ) : (
                <>
                  <p className="text-base font-bold text-white">{currentUser?.displayName}</p>
                  {currentUser?.username && (
                    <p className="text-xs text-dipSecondary">@{currentUser.username}</p>
                  )}
                </>
              )}
            </div>
          </div>

          {editing ? (
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-dipBg border border-dipBorder rounded-lg px-3 py-2 text-sm text-dipText focus:outline-none focus:border-dipPrimary resize-none"
              placeholder="Write something about yourself..."
              rows={2}
              maxLength={200}
            />
          ) : (
            currentUser?.bio && (
              <p className="text-sm text-dipSecondary">{currentUser.bio}</p>
            )
          )}
        </div>

        {/* Connection Status */}
        <div className="bg-dipPanel border border-dipBorder rounded-xl p-5">
          <h2 className="text-sm font-semibold text-dipSecondary uppercase tracking-wider mb-3">Connection</h2>
          <div className="flex items-center gap-3">
            {isConnected ? (
              <Wifi className="w-5 h-5 text-dipSuccess" />
            ) : (
              <WifiOff className="w-5 h-5 text-dipDanger" />
            )}
            <div>
              <p className="text-sm font-medium text-white">
                {isConnected ? 'Connected' : 'Disconnected'}
              </p>
              <p className="text-xs text-dipSecondary">
                {isConnected ? 'Realtime sync active' : 'Reconnecting...'}
              </p>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-dipPanel border border-dipBorder rounded-xl p-5">
          <h2 className="text-sm font-semibold text-dipSecondary uppercase tracking-wider mb-3">Security</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm text-dipSecondary">
              <Shield className="w-4 h-4 text-dipSuccess" />
              <span>Device identity stored locally</span>
            </div>
            <p className="text-xs text-dipSecondary/60 pl-7">
              Your cryptographic keys never leave this device.
            </p>
          </div>
        </div>

        {/* Version */}
        <div className="text-center text-xs text-dipSecondary/40 space-y-1">
          <p>DipChats v0.1.0 Alpha</p>
          <p>MIT License</p>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full px-4 py-3 bg-dipBg border border-dipBorder text-dipDanger font-semibold rounded-xl hover:border-dipDanger transition-all"
        >
          Disconnect & Exit
        </button>
      </div>
    </div>
  );
};
