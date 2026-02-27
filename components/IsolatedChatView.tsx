import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  doc,
  updateDoc
} from 'firebase/firestore';

interface Message {
  id: string;
  text: string;
  senderUid: string;
  displayName: string;
  photoURL: string;
  createdAt: any;
  isAdmin: boolean;
}

interface IsolatedChatViewProps {
  currentUser: User;
  isAdmin: boolean;
  onClose?: () => void;
  targetUserId?: string; // Optional: for admins viewing isolated user's chat
}

const IsolatedChatView: React.FC<IsolatedChatViewProps> = ({ currentUser, isAdmin, onClose, targetUserId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use targetUserId if provided (admin viewing user's chat), otherwise use currentUser.uid
  const chatUserId = targetUserId || currentUser.uid;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load messages
  useEffect(() => {
    const chatId = `isolated_${chatUserId}`;
    const q = query(
      collection(db, 'isolatedChats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [chatUserId]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    try {
      const chatId = `isolated_${chatUserId}`;
      await addDoc(collection(db, 'isolatedChats', chatId, 'messages'), {
        text: inputText.trim(),
        senderUid: currentUser.uid,
        displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
        photoURL: currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.displayName}`,
        createdAt: serverTimestamp(),
        isAdmin: isAdmin
      });

      setInputText('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-red-900/10 to-black">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-900/30 to-red-800/20 border-b border-red-600/30 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center border-2 border-red-600/50">
            <i className="fa-solid fa-user-lock text-red-400"></i>
          </div>
          <div>
            <h3 className="text-white font-bold">Isolated Chat</h3>
            <p className="text-xs text-red-400">Admin-Only Communication</p>
          </div>
        </div>
        {isAdmin && onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 font-bold rounded-lg transition-all border border-green-600/30"
          >
            <i className="fa-solid fa-unlock mr-2"></i>
            End Isolation
          </button>
        )}
      </div>

      {/* Warning Banner */}
      <div className="bg-red-900/20 border-b border-red-600/30 p-3">
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <i className="fa-solid fa-triangle-exclamation"></i>
          <p>
            {isAdmin 
              ? 'You are in an isolated chat. Only you and the user can see these messages.'
              : 'You are in isolation mode. You can only communicate with admins. Other chat features are disabled.'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-red-600/10 flex items-center justify-center mb-4">
              <i className="fa-solid fa-comments text-3xl text-red-400"></i>
            </div>
            <p className="text-gray-400">
              {isAdmin ? 'Start the conversation with the isolated user' : 'Wait for admin to start the conversation'}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderUid === currentUser.uid;
            return (
              <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                <img
                  src={msg.photoURL}
                  alt={msg.displayName}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[70%]`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400">{msg.displayName}</span>
                    {msg.isAdmin && (
                      <span className="text-[10px] px-2 py-0.5 bg-red-600/20 text-red-400 rounded-full border border-red-600/30">
                        ADMIN
                      </span>
                    )}
                  </div>
                  <div className={`px-4 py-2 rounded-2xl ${
                    isMe 
                      ? 'bg-accent text-white' 
                      : msg.isAdmin 
                        ? 'bg-red-600/20 text-white border border-red-600/30'
                        : 'bg-white/5 text-white'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-red-600/30 p-4 bg-red-900/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isAdmin ? "Type your message..." : "Respond to admin..."}
            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim()}
            className="px-6 py-3 bg-gradient-to-r from-accent to-accent-hover text-white font-bold rounded-xl transition-all hover:shadow-lg hover:shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IsolatedChatView;
