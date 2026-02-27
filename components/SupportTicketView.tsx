import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where,
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  doc,
  updateDoc,
  getDoc
} from 'firebase/firestore';

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  timestamp: any;
  isAdmin?: boolean;
}

interface SupportTicketViewProps {
  currentUser: User;
  onClose: () => void;
  bannedByAdminId?: string;
}

const SupportTicketView: React.FC<SupportTicketViewProps> = ({ 
  currentUser, 
  onClose,
  bannedByAdminId 
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [adminInfo, setAdminInfo] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Get admin info
  useEffect(() => {
    const fetchAdminInfo = async () => {
      if (bannedByAdminId) {
        try {
          const adminDoc = await getDoc(doc(db, 'users', bannedByAdminId));
          if (adminDoc.exists()) {
            setAdminInfo(adminDoc.data());
          }
        } catch (error) {
          console.error('Error fetching admin info:', error);
        }
      }
    };
    fetchAdminInfo();
  }, [bannedByAdminId]);

  // Find or create support ticket
  useEffect(() => {
    const findOrCreateTicket = async () => {
      try {
        // Check if user already has an open ticket
        const q = query(
          collection(db, 'supportTickets'),
          where('userId', '==', currentUser.uid),
          where('status', '==', 'open')
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
          if (!snapshot.empty) {
            // Use existing ticket
            const existingTicket = snapshot.docs[0];
            setTicketId(existingTicket.id);
          } else {
            // Create new ticket
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            const userData = userDoc.exists() ? userDoc.data() : {};
            const username = userData.username || currentUser.displayName || 'User';
            
            const newTicket = await addDoc(collection(db, 'supportTickets'), {
              userId: currentUser.uid,
              userEmail: currentUser.email,
              userDisplayName: username,
              username: username,
              userPhotoURL: currentUser.photoURL || userData.photoURL || `https://ui-avatars.com/api/?name=${username}&background=6366f1&color=fff&size=200&bold=true`,
              assignedAdminId: bannedByAdminId || null,
              status: 'open',
              reason: 'Chat ban appeal',
              message: 'Solicitud de apelación de baneo del chat',
              createdAt: serverTimestamp(),
              lastMessageAt: serverTimestamp()
            });
            setTicketId(newTicket.id);
          }
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error finding/creating ticket:', error);
        setLoading(false);
      }
    };

    findOrCreateTicket();
  }, [currentUser, bannedByAdminId]);

  // Listen to messages
  useEffect(() => {
    if (!ticketId) return;

    const q = query(
      collection(db, 'supportTickets', ticketId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [ticketId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !ticketId) return;

    try {
      await addDoc(collection(db, 'supportTickets', ticketId, 'messages'), {
        text: newMessage,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'User',
        senderAvatar: currentUser.photoURL || '',
        timestamp: serverTimestamp(),
        isAdmin: false
      });

      // Update ticket last message time
      await updateDoc(doc(db, 'supportTickets', ticketId), {
        lastMessageAt: serverTimestamp()
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center">
        <i className="fa-solid fa-circle-notch fa-spin text-4xl text-accent"></i>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0A0A0A] border border-accent/30 rounded-2xl w-full max-w-2xl h-[600px] flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-accent/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center border-2 border-accent/50">
              <i className="fa-solid fa-headset text-accent"></i>
            </div>
            <div>
              <h3 className="text-white font-bold">Ticket de Soporte</h3>
              <p className="text-xs text-gray-400">
                {adminInfo ? `Asignado a: ${adminInfo.displayName || 'Admin'}` : 'Esperando respuesta del equipo'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <i className="fa-solid fa-xmark text-white"></i>
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-yellow-900/20 border-b border-yellow-600/30 px-4 py-3">
          <div className="flex items-start gap-2">
            <i className="fa-solid fa-circle-info text-yellow-400 mt-0.5"></i>
            <div className="text-xs text-yellow-200">
              <p className="font-semibold mb-1">Este es un canal de soporte oficial</p>
              <p className="text-yellow-300/80">
                Tus mensajes serán revisados por el equipo de moderación. 
                Este chat es independiente del chat comunitario.
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <i className="fa-solid fa-comments text-4xl mb-3 opacity-20"></i>
              <p className="text-sm">Inicia la conversación con el equipo de soporte</p>
            </div>
          )}
          
          {messages.map((msg) => {
            const isOwn = msg.senderId === currentUser.uid;
            return (
              <div key={msg.id} className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
                <img 
                  src={msg.senderAvatar || 'https://ui-avatars.com/api/?name=User'} 
                  className="w-8 h-8 rounded-full object-cover"
                  alt={msg.senderName}
                />
                <div className={`flex-1 max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-400">
                      {msg.senderName}
                      {msg.isAdmin && (
                        <span className="ml-1 text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded">
                          ADMIN
                        </span>
                      )}
                    </span>
                  </div>
                  <div className={`rounded-2xl px-4 py-2 ${
                    isOwn 
                      ? 'bg-accent text-white' 
                      : msg.isAdmin 
                        ? 'bg-blue-600/20 border border-blue-500/30 text-white'
                        : 'bg-white/5 text-white'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/10 bg-black/30">
          <div className="flex gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Escribe tu mensaje..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-accent transition-colors"
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className="bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl transition-all font-semibold"
            >
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportTicketView;
