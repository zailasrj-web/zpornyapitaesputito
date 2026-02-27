import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  where,
  getDocs
} from 'firebase/firestore';

interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userAvatar: string;
  assignedAdminId: string | null;
  status: 'open' | 'closed';
  reason: string;
  createdAt: any;
  lastMessageAt: any;
  unreadByAdmin?: boolean;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  timestamp: any;
  isAdmin?: boolean;
}

interface SupportTicketsPanelProps {
  currentUser: User;
  isAdmin: boolean;
}

const SupportTicketsPanel: React.FC<SupportTicketsPanelProps> = ({ currentUser, isAdmin }) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('open');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load tickets
  useEffect(() => {
    let q;
    if (filter === 'all') {
      q = query(collection(db, 'supportTickets'), orderBy('lastMessageAt', 'desc'));
    } else {
      q = query(
        collection(db, 'supportTickets'),
        where('status', '==', filter),
        orderBy('lastMessageAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTickets: SupportTicket[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SupportTicket));
      setTickets(fetchedTickets);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [filter]);

  // Load messages for selected ticket
  useEffect(() => {
    if (!selectedTicket) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'supportTickets', selectedTicket.id, 'messages'),
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
  }, [selectedTicket]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;

    try {
      await addDoc(collection(db, 'supportTickets', selectedTicket.id, 'messages'), {
        text: newMessage,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'Admin',
        senderAvatar: currentUser.photoURL || '',
        timestamp: serverTimestamp(),
        isAdmin: true
      });

      // Update ticket last message time
      await updateDoc(doc(db, 'supportTickets', selectedTicket.id), {
        lastMessageAt: serverTimestamp(),
        unreadByAdmin: false
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleCloseTicket = async (ticketId: string) => {
    if (!confirm('¿Cerrar este ticket de soporte?')) return;

    try {
      await updateDoc(doc(db, 'supportTickets', ticketId), {
        status: 'closed',
        closedAt: serverTimestamp(),
        closedBy: currentUser.uid
      });
      setSelectedTicket(null);
    } catch (error) {
      console.error('Error closing ticket:', error);
    }
  };

  const handleReopenTicket = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, 'supportTickets', ticketId), {
        status: 'open',
        reopenedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error reopening ticket:', error);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'Ahora';
    const date = timestamp.toDate();
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds/60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds/3600)}h`;
    return `${Math.floor(diffInSeconds/86400)}d`;
  };

  return (
    <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out] h-[calc(100vh-200px)]">
      <div className="flex h-full">
        
        {/* Tickets List */}
        <div className="w-80 border-r border-white/10 flex flex-col bg-[#0F0F0F]">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <i className="fa-solid fa-headset text-accent"></i>
              Tickets de Soporte
            </h3>
            
            {/* Filter Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('open')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                  filter === 'open'
                    ? 'bg-accent text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Abiertos
              </button>
              <button
                onClick={() => setFilter('closed')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                  filter === 'closed'
                    ? 'bg-accent text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Cerrados
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                  filter === 'all'
                    ? 'bg-accent text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                Todos
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading && (
              <div className="text-center py-10 text-gray-500">
                <i className="fa-solid fa-circle-notch fa-spin text-2xl"></i>
              </div>
            )}

            {!loading && tickets.length === 0 && (
              <div className="text-center py-10 text-gray-500 px-4">
                <i className="fa-solid fa-inbox text-4xl mb-3 opacity-20"></i>
                <p className="text-sm">No hay tickets {filter !== 'all' ? filter === 'open' ? 'abiertos' : 'cerrados' : ''}</p>
              </div>
            )}

            {tickets.map(ticket => (
              <div
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className={`p-4 border-b border-white/5 cursor-pointer transition-colors ${
                  selectedTicket?.id === ticket.id
                    ? 'bg-accent/10 border-l-4 border-l-accent'
                    : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-start gap-3">
                  <img
                    src={ticket.userAvatar || 'https://ui-avatars.com/api/?name=User'}
                    className="w-10 h-10 rounded-full object-cover"
                    alt={ticket.userName}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-bold text-white truncate">
                        {ticket.userName}
                      </h4>
                      <span className="text-xs text-gray-500">
                        {formatTime(ticket.lastMessageAt)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate mb-1">
                      {ticket.userEmail}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        ticket.status === 'open'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {ticket.status === 'open' ? 'Abierto' : 'Cerrado'}
                      </span>
                      <span className="text-[10px] text-gray-500 truncate">
                        {ticket.reason}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {!selectedTicket ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <i className="fa-solid fa-comments text-6xl mb-4 opacity-20"></i>
                <p className="text-sm">Selecciona un ticket para ver la conversación</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/30">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedTicket.userAvatar || 'https://ui-avatars.com/api/?name=User'}
                    className="w-10 h-10 rounded-full object-cover"
                    alt={selectedTicket.userName}
                  />
                  <div>
                    <h3 className="text-white font-bold">{selectedTicket.userName}</h3>
                    <p className="text-xs text-gray-400">{selectedTicket.userEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedTicket.status === 'open' ? (
                    <button
                      onClick={() => handleCloseTicket(selectedTicket.id)}
                      className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs font-bold transition-colors"
                    >
                      <i className="fa-solid fa-check mr-2"></i>
                      Cerrar Ticket
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReopenTicket(selectedTicket.id)}
                      className="px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg text-xs font-bold transition-colors"
                    >
                      <i className="fa-solid fa-rotate-right mr-2"></i>
                      Reabrir
                    </button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#050505]">
                {messages.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <p className="text-sm">No hay mensajes aún</p>
                  </div>
                )}
                
                {messages.map((msg) => {
                  const isAdmin = msg.isAdmin;
                  return (
                    <div key={msg.id} className={`flex gap-3 ${isAdmin ? 'flex-row-reverse' : ''}`}>
                      <img 
                        src={msg.senderAvatar || 'https://ui-avatars.com/api/?name=User'} 
                        className="w-8 h-8 rounded-full object-cover"
                        alt={msg.senderName}
                      />
                      <div className={`flex-1 max-w-[70%] ${isAdmin ? 'items-end' : 'items-start'} flex flex-col`}>
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
                          isAdmin 
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
              {selectedTicket.status === 'open' && (
                <div className="p-4 border-t border-white/10 bg-black/30">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Escribe tu respuesta..."
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
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupportTicketsPanel;
