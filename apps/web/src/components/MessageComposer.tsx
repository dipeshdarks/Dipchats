import React, { useState, useRef } from 'react';
import { useChatStore } from '../store/useChatStore';
import { uploadFile } from '../services/api';
import { Plus, Smile, Send, Paperclip, Image as ImageIcon, Loader2 } from 'lucide-react';

export const MessageComposer: React.FC = () => {
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { activeChannel, sendMessage, startTyping, stopTyping } = useChatStore();

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !activeChannel) return;

    setText('');
    stopTyping(activeChannel.id);
    await sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (activeChannel) {
      if (e.target.value.length > 0) {
        startTyping(activeChannel.id);
      } else {
        stopTyping(activeChannel.id);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeChannel) return;

    setIsUploading(true);
    try {
      const file = files[0]!;
      const attachment = await uploadFile(file);
      await sendMessage(`Uploaded attachment: ${attachment.filename}`, undefined, [attachment]);
    } catch (err) {
      console.error('File upload error:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-4 bg-dipPanel border-t border-dipBorder">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip,.txt"
      />

      <div className="flex items-center gap-2 bg-dipBg border border-dipBorder rounded-2xl p-2 focus-within:border-dipPrimary transition-all">
        {/* Attachment Button [ + ] */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-dipSecondary hover:text-white hover:bg-dipCard transition-all disabled:opacity-50"
          title="Attach file or image"
        >
          {isUploading ? <Loader2 className="w-5 h-5 animate-spin text-dipPrimary" /> : <Plus className="w-5 h-5" />}
        </button>

        {/* Text Input [ Message... ] */}
        <textarea
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${activeChannel?.name || 'chat'}...`}
          rows={1}
          className="flex-1 bg-transparent border-none text-dipText placeholder:text-dipSecondary text-sm focus:outline-none resize-none max-h-32 py-1.5 px-2"
        />

        {/* Emoji Button [ 😊 ] */}
        <button
          type="button"
          onClick={() => setText((t) => t + ' 😊')}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-dipSecondary hover:text-white hover:bg-dipCard transition-all"
          title="Add Emoji"
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Send Button [ ➤ ] */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || isUploading}
          className="w-9 h-9 rounded-xl bg-dipPrimary hover:bg-dipPrimaryHover active:scale-95 text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-dipPrimary/20"
          title="Send Message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
