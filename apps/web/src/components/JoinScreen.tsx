import React, { useState } from 'react';
import { useChatStore } from '../store/useChatStore';
import { ShieldCheck, MessageSquare, Sparkles, Loader2 } from 'lucide-react';

export const JoinScreen: React.FC = () => {
  const [name, setName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const { join, isLoading, error: serverError } = useChatStore();

  const validate = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      return 'Please enter a display name';
    }
    if (trimmed.length < 2) {
      return 'Name must be at least 2 characters';
    }
    if (trimmed.length > 32) {
      return 'Name cannot exceed 32 characters';
    }
    if (!/^[a-zA-Z0-9_\-\s]+$/.test(trimmed)) {
      return 'Name can only contain letters, numbers, spaces, underscores, and hyphens';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(name);
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    await join(name.trim());
  };

  return (
    <div className="min-h-screen w-full bg-dipBg flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Subtle Ambient Glow */}
      <div className="absolute w-[500px] h-[500px] bg-dipPrimary/10 rounded-full blur-3xl pointer-events-none -top-32 -left-32 animate-pulse" />
      <div className="absolute w-[400px] h-[400px] bg-dipSuccess/5 rounded-full blur-3xl pointer-events-none -bottom-32 -right-32" />

      <div className="w-full max-w-md bg-dipPanel border border-dipBorder/80 rounded-2xl p-8 shadow-2xl backdrop-blur-sm z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-dipPrimary/10 border border-dipPrimary/30 rounded-2xl flex items-center justify-center mb-4 text-dipPrimary shadow-lg shadow-dipPrimary/10">
            <MessageSquare className="w-9 h-9" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">DIPCHATS</h1>
          <p className="text-sm font-medium text-dipSecondary">Private. Realtime. Connected.</p>
        </div>

        {/* Join Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="name-input" className="block text-xs font-semibold uppercase tracking-wider text-dipSecondary mb-2">
              Enter your name
            </label>
            <input
              id="name-input"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="e.g. Alex, Sarah"
              disabled={isLoading}
              className={`w-full bg-dipBg border text-dipText rounded-xl px-4 py-3 text-base focus:outline-none transition-all ${
                validationError || serverError
                  ? 'border-dipDanger focus:border-dipDanger focus:ring-1 focus:ring-dipDanger'
                  : 'border-dipBorder focus:border-dipPrimary focus:ring-1 focus:ring-dipPrimary'
              }`}
              autoFocus
              maxLength={32}
            />

            {(validationError || serverError) && (
              <p className="mt-2 text-xs text-dipDanger font-medium flex items-center gap-1">
                <span>⚠️</span> {validationError || serverError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !name.trim()}
            className="w-full bg-dipPrimary hover:bg-dipPrimaryHover active:scale-[0.99] text-white font-semibold rounded-xl py-3.5 px-4 text-base transition-all duration-200 shadow-lg shadow-dipPrimary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Joining DipChats...</span>
              </>
            ) : (
              <>
                <span>JOIN DIPCHATS</span>
                <Sparkles className="w-4 h-4 opacity-80" />
              </>
            )}
          </button>
        </form>

        {/* Footnotes / Device Identity Guarantee */}
        <div className="mt-8 pt-6 border-t border-dipBorder/60 flex flex-col items-center gap-2 text-center text-xs text-dipSecondary">
          <div className="flex items-center gap-1.5 font-medium text-dipText/80">
            <ShieldCheck className="w-4 h-4 text-dipSuccess" />
            <span>No account required.</span>
          </div>
          <p className="text-dipSecondary/80">
            Your cryptographic identity is created & stored securely on this device.
          </p>
        </div>
      </div>
    </div>
  );
};
