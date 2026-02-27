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
  limit,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  deleteDoc,
  writeBatch,
  Timestamp,
  getDocs
} from 'firebase/firestore';
import UserProfileModal from './UserProfileModal';
import ChatBannedView from './ChatBannedView';
import IsolatedChatView from './IsolatedChatView';
import SupportTicketView from './SupportTicketView';

// Cloudinary Config
const CLOUD_NAME = 'dbfza2zyk';
const UPLOAD_PRESET = 'poorn_default';

interface Message {
  id: string;
  text: string;
  imageUrl?: string;
  senderUid: string;
  displayName: string;
  photoURL: string;
  createdAt: any;
  email?: string;
  read?: boolean;
  type?: 'text' | 'system' | 'admin_log';
  replyTo?: {
    messageId: string;
    text: string;
    senderName: string;
    senderUid: string;
  };
}

interface Contact {
  id: string; 
  name: string;
  avatar: string;
  status: 'online' | 'offline'; // Keep for type compat, but override with realtime listener
  lastMessage: string;
  time: string;
  unread: number;
  isSupportTicket?: boolean; // Flag for support tickets
  ticketStatus?: 'open' | 'in_progress' | 'resolved';
  userId?: string; // User ID for support tickets
  isIsolated?: boolean; // Flag for isolated chats
}

interface ChatMetadata {
  isLocked?: boolean;
  kickExpiresAt?: any;
  kickReason?: string;
}

interface ChatViewProps {
  currentUser: User | null;
  initialTargetId?: string | null;
}

const GENERAL_CHAT_ID = "general_community_chat";
const OWNER_EMAIL = "zailasrj@gmail.com";
const ADMIN_EMAILS = ["zailasrj@gmail.com", "demo@zpoom.ai", "admin@zpoom.com", "eliasra.hdez@gmail.com", "yapadesing.contacto@gmail.com"]; 
const PROTECTED_NAMES = ["Zailas", "Admin", "Owner", "Community Chat", "Zpoom Team"];

// --- SIDEBAR ITEM COMPONENT FOR TYPING & ONLINE LOGIC ---
const ChatSidebarItem: React.FC<{
    chat: Contact;
    currentUser: User;
    isSelected: boolean;
    activeMenuId: string | null;
    onSelect: () => void;
    onMenuToggle: (e: React.MouseEvent) => void;
    onMenuAction: (action: 'mute' | 'block' | 'pin' | 'delete', chat: Contact, e: React.MouseEvent) => void;
}> = ({ chat, currentUser, isSelected, activeMenuId, onSelect, onMenuToggle, onMenuAction }) => {
    const [isTyping, setIsTyping] = useState(false);
    const [isOnline, setIsOnline] = useState(false);
    const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
    const [isLongPressing, setIsLongPressing] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Listen for Typing & Online Status
    useEffect(() => {
        if (chat.id === GENERAL_CHAT_ID) {
            setIsOnline(true); // Always online for general
            return;
        }

        const chatId = [currentUser.uid, chat.id].sort().join('_');
        
        // Typing Listener
        const typingDocRef = doc(db, "chats", chatId, "typing", chat.id);
        const unsubTyping = onSnapshot(typingDocRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                setIsTyping(docSnapshot.data()?.isTyping === true);
            } else {
                setIsTyping(false);
            }
        });

        // Online Status Listener (Listen to User Profile)
        const userRef = doc(db, "users", chat.id);
        const unsubOnline = onSnapshot(userRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                const isUserOnline = data?.isOnline === true;
                const lastSeen = data?.lastSeen;
                
                // Check if user is truly online (last seen within 2 minutes)
                if (isUserOnline && lastSeen) {
                    const now = new Date();
                    const lastSeenDate = lastSeen.toDate();
                    const timeDiff = (now.getTime() - lastSeenDate.getTime()) / 1000; // seconds
                    
                    // If last seen is more than 2 minutes ago, consider offline
                    setIsOnline(timeDiff < 120);
                } else {
                    setIsOnline(isUserOnline);
                }
            } else {
                setIsOnline(false);
            }
        });

        return () => {
            unsubTyping();
            unsubOnline();
        };
    }, [chat.id, currentUser.uid]);

    // Long press handlers for mobile/tablet
    const handleTouchStart = (e: React.TouchEvent) => {
        const timer = setTimeout(() => {
            setIsLongPressing(true);
            onMenuToggle(e as any);
            // Add haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }, 500); // 500ms long press
        setLongPressTimer(timer);
    };

    const handleTouchEnd = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
        setIsLongPressing(false);
    };

    const handleTouchMove = () => {
        // Cancel long press if user moves finger
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
        setIsLongPressing(false);
    };

    return (
        <div className="relative group">
            <button 
                onClick={onSelect}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
                className={`w-full flex items-center gap-3 p-4 transition-colors hover:bg-white/5 border-b border-white/5 relative ${isSelected ? 'bg-white/10 border-l-2 border-l-accent' : ''} ${isLongPressing ? 'bg-white/20' : ''}`}
            >
                <div className="relative">
                    <img src={chat.avatar} className="w-10 h-10 rounded-full object-cover bg-gray-800" alt={chat.name} />
                    {/* Unread Badge */}
                    {chat.unread > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center border-2 border-[#0A0A0A] shadow-md animate-pulse z-10">
                            <span className="text-[10px] font-bold text-white">{chat.unread > 9 ? '9+' : chat.unread}</span>
                        </div>
                    )}
                    {/* Online Dot (Green) */}
                    {isOnline && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0A0A0A] z-10"></div>
                    )}
                </div>
                <div className="flex-1 text-left overflow-hidden">
                    <div className="flex items-center mb-0.5">
                        <span className={`text-sm truncate ${chat.unread > 0 ? 'text-white font-extrabold' : 'text-gray-300 font-semibold'}`}>{chat.name}</span>
                    </div>
                    {isTyping ? (
                        <p className="text-xs truncate text-accent font-bold flex items-center gap-2">
                            <span>Escribiendo</span>
                            <span className="flex gap-1">
                                <span className="typing-dot w-1.5 h-1.5 bg-accent rounded-full"></span>
                                <span className="typing-dot w-1.5 h-1.5 bg-accent rounded-full"></span>
                                <span className="typing-dot w-1.5 h-1.5 bg-accent rounded-full"></span>
                            </span>
                        </p>
                    ) : (
                        <p className={`text-xs truncate ${chat.unread > 0 ? 'text-white font-bold' : 'text-gray-400'}`}>
                            {chat.lastMessage}
                        </p>
                    )}
                </div>
            </button>
            
            {/* Time Display - Positioned next to menu dots */}
            <span className={`absolute right-14 top-1/2 -translate-y-1/2 text-[9px] flex-shrink-0 z-10 ${chat.unread > 0 ? 'text-accent font-bold' : 'text-gray-500'}`}>{chat.time}</span>
            
            {/* Long Press Indicator */}
            {isLongPressing && (
                <div className="absolute inset-0 bg-white/10 rounded-lg border-2 border-accent/50 animate-pulse pointer-events-none z-10">
                    <div className="absolute top-2 right-2 text-accent text-xs font-bold">
                        <i className="fa-solid fa-hand-pointer"></i>
                    </div>
                </div>
            )}
            
            {/* OVERFLOW MENU TRIGGER - Hidden on mobile/tablet, visible on desktop hover */}
            <button 
                onClick={(e) => { e.stopPropagation(); onMenuToggle(e); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center text-gray-400 hover:text-white z-20 transition-all rounded-full active:bg-white/10 hidden md:group-hover:flex"
                style={{ touchAction: 'manipulation' }}
            >
                <i className="fa-solid fa-ellipsis-vertical text-sm pointer-events-none"></i>
            </button>

            {/* OVERFLOW DROPDOWN */}
            {activeMenuId === chat.id && (
                <div ref={menuRef} className="absolute right-8 top-8 w-36 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl z-30 overflow-hidden animate-[fadeIn_0.1s_ease-out]">
                    <button onClick={(e) => onMenuAction('delete', chat, e)} className="w-full text-left px-4 py-3 text-xs text-red-400 hover:bg-white/5 hover:text-red-300 flex items-center gap-2">
                        <i className="fa-solid fa-trash"></i> Delete
                    </button>
                    <button onClick={(e) => onMenuAction('block', chat, e)} className="w-full text-left px-4 py-3 text-xs text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-2 border-t border-white/5">
                        <i className="fa-solid fa-ban"></i> Block
                    </button>
                </div>
            )}
        </div>
    );
};

const ChatView: React.FC<ChatViewProps> = ({ currentUser, initialTargetId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [callType, setCallType] = useState<'video' | 'audio'>('video');
  const localVideoRef = useRef<HTMLVideoElement>(null);
  
  // Reply State
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  
  // Swipe State for Mobile Reply
  const [swipeState, setSwipeState] = useState<{[key: string]: number}>({});
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [isSwiping, setIsSwiping] = useState<string | null>(null);
  
  // Mobile View State
  const [showMobileList, setShowMobileList] = useState(!initialTargetId);
  
  // Sidebar Tab State (for admins)
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'bans'>('chats');
  const [bannedUsers, setBannedUsers] = useState<{uid: string, displayName: string, email: string, photoURL: string, bannedAt: any, reason: string}[]>([]);
  
  // Support Tickets State (for admins)
  const [supportTickets, setSupportTickets] = useState<Contact[]>([]);
  const [showTicketsView, setShowTicketsView] = useState(false); // New state for tickets view
  
  // Active Chats List (Inbox)
  const [inboxChats, setInboxChats] = useState<Contact[]>([]);
  
  // New Message Notification State
  const [newMsgNotification, setNewMsgNotification] = useState<{name: string, id: string} | null>(null);

  // Typing Status State (Current Chat)
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<any>(null);
  
  // Community Chat Typing State
  const [communityTypingUsers, setCommunityTypingUsers] = useState<{uid: string, displayName: string}[]>([]);

  // Online Status State (Current Chat)
  const [selectedContactOnline, setSelectedContactOnline] = useState(false);
  const [selectedContactLastSeen, setSelectedContactLastSeen] = useState<string>('');

  // Command autocomplete state
  const [showUserSuggestions, setShowUserSuggestions] = useState(false);
  const [userSuggestions, setUserSuggestions] = useState<{uid: string, displayName: string, email: string}[]>([]);
  const [currentCommand, setCurrentCommand] = useState<string>('');
  const [commandCursorPosition, setCommandCursorPosition] = useState<number>(0);

  // Chat Status (Lock, Kick)
  const [chatMetadata, setChatMetadata] = useState<ChatMetadata>({});

  // Menu & Taunt State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [showTauntModal, setShowTauntModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Scary Warning Modal State
  const [showScaryWarning, setShowScaryWarning] = useState(false);
  const [scaryWarningMessage, setScaryWarningMessage] = useState('');
  const [scaryWarningType, setScaryWarningType] = useState<'owner' | 'admin'>('admin');
  const [warningAttempts, setWarningAttempts] = useState(0); // Track attempts
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [showScreamer, setShowScreamer] = useState(false);

  // Image Upload & Payment State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const groupPhotoInputRef = useRef<HTMLInputElement>(null);

  // Group Info Modal State
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<{uid: string, displayName: string, photoURL: string, isOnline: boolean, email: string}[]>([]);
  
  // Image Crop Modal State
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);

  // User Profile Modal State
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<{
    uid: string;
    displayName: string;
    photoURL: string;
    email?: string;
  } | null>(null);

  // Chat Ban State
  const [isChatBanned, setIsChatBanned] = useState(false);
  const [chatBanReason, setChatBanReason] = useState('');
  const [bannedByAdminId, setBannedByAdminId] = useState<string | null>(null);
  const [showSupportTicket, setShowSupportTicket] = useState(false);
  const [hasActiveTicket, setHasActiveTicket] = useState(false);

  // Isolation State
  const [isIsolated, setIsIsolated] = useState(false);

  // Pagination State
  const [messageLimit, setMessageLimit] = useState(50);
  const [hasMoreOldMessages, setHasMoreOldMessages] = useState(false);
  const [isLoadingOldMessages, setIsLoadingOldMessages] = useState(false);

  // Current Selected Contact
  const [selectedContact, setSelectedContact] = useState<Contact>({ 
      id: GENERAL_CHAT_ID, 
      name: "Community Chat", 
      avatar: "https://res.cloudinary.com/dbfza2zyk/image/upload/v1768852307/ZZPO_lmy5e2.png", 
      status: 'online', 
      lastMessage: "Welcome everyone!", 
      time: "Now", 
      unread: 0 
  });

  const prevInboxRef = useRef<Contact[]>([]);
  
  const isAdminOrOwner = currentUser ? (ADMIN_EMAILS.includes(currentUser.email || '') || currentUser.email === OWNER_EMAIL) : false;
  const isOwner = currentUser?.email === OWNER_EMAIL;

  // Function to render text with highlighted mentions
  const renderTextWithMentions = (text: string) => {
    const mentionRegex = /@(\w+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      // Add mention with styling
      parts.push(
        <span key={match.index} className="text-accent font-bold bg-accent/10 px-1 rounded">
          @{match[1]}
        </span>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };

  // Delete Message Function
  const handleDeleteMessage = async (messageId: string, senderUid: string, senderEmail?: string) => {
    if (!currentUser) return;
    
    const canDelete = 
      currentUser.uid === senderUid || // Own message
      isAdminOrOwner; // Admin or Owner can delete any message
    
    if (!canDelete) return;
    
    try {
      const chatId = selectedContact.id === GENERAL_CHAT_ID 
        ? GENERAL_CHAT_ID 
        : [currentUser.uid, selectedContact.id].sort().join('_');
      
      const messageRef = doc(db, "chats", chatId, "messages", messageId);
      
      // If admin/owner deletes someone else's message, replace with system message
      if (currentUser.uid !== senderUid && isAdminOrOwner) {
        const deletedBy = isOwner ? "El Owner" : "Un Admin";
        await updateDoc(messageRef, {
          text: `${deletedBy} eliminó este mensaje`,
          type: 'system',
          imageUrl: null,
          deletedBy: currentUser.uid,
          deletedAt: serverTimestamp()
        });
      } else {
        // User deleting own message - completely remove it
        await deleteDoc(messageRef);
      }
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  // Reply to Message Function
  const handleReplyToMessage = (msg: Message) => {
    setReplyingTo(msg);
    setSwipeState({}); // Reset swipe state
  };

  // Cancel Reply Function
  const cancelReply = () => {
    setReplyingTo(null);
  };

  // Handle User Avatar Click
  const handleUserAvatarClick = (msg: Message) => {
    // Don't open profile for system messages
    if (msg.type === 'system' || msg.type === 'admin_log') return;
    
    // Don't open own profile
    if (msg.senderUid === currentUser?.uid) return;
    
    setSelectedUserProfile({
      uid: msg.senderUid,
      displayName: msg.displayName,
      photoURL: msg.photoURL,
      email: msg.email
    });
    setShowUserProfile(true);
  };

  // Handle Start Chat from Profile
  const handleStartChatFromProfile = async () => {
    if (!selectedUserProfile) return;
    
    // Check if user is isolated
    try {
      const userRef = doc(db, 'users', selectedUserProfile.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists() && userSnap.data().chatIsolated === true) {
        // Open isolated chat
        setSelectedContact({
          id: `isolated_${selectedUserProfile.uid}`,
          name: selectedUserProfile.displayName,
          avatar: selectedUserProfile.photoURL,
          status: 'online',
          lastMessage: 'Isolated chat',
          time: 'Now',
          unread: 0,
          isIsolated: true
        });
        
        setShowUserProfile(false);
        setShowMobileList(false);
        return;
      }
    } catch (error) {
      console.error('Error checking isolation status:', error);
    }
    
    // Find or create normal chat with this user
    const existingChat = inboxChats.find(c => c.id === selectedUserProfile.uid);
    
    if (existingChat) {
      setSelectedContact(existingChat);
    } else {
      setSelectedContact({
        id: selectedUserProfile.uid,
        name: selectedUserProfile.displayName,
        avatar: selectedUserProfile.photoURL,
        status: 'online',
        lastMessage: 'Start a conversation',
        time: 'Now',
        unread: 0
      });
    }
    
    setShowUserProfile(false);
    setShowMobileList(false);
  };

  // Handle Report from Profile
  const handleReportFromProfile = async () => {
    if (!selectedUserProfile || !currentUser) return;
    
    const reason = prompt('Razón del reporte:');
    if (!reason || !reason.trim()) return;
    
    try {
      await addDoc(collection(db, 'reports'), {
        type: 'User',
        reportedUserId: selectedUserProfile.uid,
        reportedUserName: selectedUserProfile.displayName,
        reportedUserEmail: selectedUserProfile.email,
        reporterId: currentUser.uid,
        reporterEmail: currentUser.email,
        reason: reason.trim(),
        createdAt: serverTimestamp(),
        status: 'Pending'
      });
      
      alert('Reporte enviado exitosamente');
      setShowUserProfile(false);
    } catch (error) {
      console.error('Error reporting user:', error);
      alert('Error al enviar el reporte');
    }
  };

  // Handle Contact Support
  const handleContactSupport = async () => {
    if (!currentUser) return;
    
    // Find or create support ticket
    try {
      const ticketsRef = collection(db, 'supportTickets');
      
      // First, try to find an OPEN ticket
      const openQuery = query(
        ticketsRef,
        where('userId', '==', currentUser.uid),
        where('status', '==', 'open')
      );
      
      let snapshot = await getDocs(openQuery);
      let ticketId;
      let ticketData;
      
      if (!snapshot.empty) {
        // Use existing open ticket
        ticketId = snapshot.docs[0].id;
        ticketData = snapshot.docs[0].data();
        console.log('📋 Using existing OPEN ticket:', ticketId);
      } else {
        // If no open ticket, find the most recent ticket and reopen it
        const allTicketsQuery = query(
          ticketsRef,
          where('userId', '==', currentUser.uid),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
        
        const allSnapshot = await getDocs(allTicketsQuery);
        
        if (!allSnapshot.empty) {
          // Reopen the most recent ticket
          ticketId = allSnapshot.docs[0].id;
          ticketData = allSnapshot.docs[0].data();
          
          await updateDoc(doc(db, 'supportTickets', ticketId), {
            status: 'open',
            reopenedAt: serverTimestamp()
          });
          
          console.log('📋 Reopened existing ticket:', ticketId);
        } else {
          // Create new ticket only if user has NO tickets at all
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          const userData = userDoc.exists() ? userDoc.data() : {};
          const username = userData.username || currentUser.displayName || 'User';
          const realPhotoURL = currentUser.photoURL || userData.photoURL || `https://ui-avatars.com/api/?name=${username}`;
          
          const newTicket = await addDoc(ticketsRef, {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            userDisplayName: username,
            username: username,
            userPhotoURL: realPhotoURL,
            assignedAdminId: bannedByAdminId || null,
            status: 'open',
            reason: 'Chat ban appeal',
            message: 'Solicitud de apelación de baneo del chat',
            createdAt: serverTimestamp(),
            lastMessageAt: serverTimestamp()
          });
          
          ticketId = newTicket.id;
          ticketData = {
            userDisplayName: username,
            userPhotoURL: realPhotoURL
          };
          console.log('📋 Created new support ticket:', ticketId);
        }
      }
      
      // Set the ticket as selected contact
      setSelectedContact({
        id: `ticket_${ticketId}`,
        name: 'Soporte - Apelación de Ban',
        avatar: ticketData?.userPhotoURL || 'https://res.cloudinary.com/dbfza2zyk/image/upload/v1768852307/ZZPO_lmy5e2.png',
        status: 'online',
        lastMessage: 'Ticket de soporte',
        time: 'Ahora',
        unread: 0,
        isSupportTicket: true,
        ticketStatus: 'open'
      });
      
      // Don't change isChatBanned, just show the ticket
      setShowMobileList(false); // Show chat on mobile
    } catch (error) {
      console.error('Error creating/finding support ticket:', error);
    }
  };

  // Unban User (for admins)
  const handleUnbanUser = async (userId: string) => {
    if (!isAdminOrOwner) return;
    
    const confirmUnban = confirm('¿Estás seguro de que quieres desbanear a este usuario del chat?');
    if (!confirmUnban) return;
    
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        chatBanned: false,
        chatBanReason: null,
        chatBannedAt: null,
        chatBannedBy: null
      });
      
      // Delete all support tickets from this user
      const ticketsRef = collection(db, 'supportTickets');
      const q = query(ticketsRef);
      const ticketsSnapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      ticketsSnapshot.forEach((ticketDoc) => {
        const ticketData = ticketDoc.data();
        if (ticketData.userId === userId) {
          batch.delete(doc(db, 'supportTickets', ticketDoc.id));
        }
      });
      await batch.commit();
      
      // Log admin action
      await addDoc(collection(db, 'adminLogs'), {
        action: 'CHAT_UNBAN',
        adminEmail: currentUser?.email,
        adminUid: currentUser?.uid,
        targetUserId: userId,
        timestamp: serverTimestamp()
      });
      
      alert('Usuario desbaneado y tickets eliminados');
    } catch (error) {
      console.error('Error unbanning user:', error);
      alert('Error al desbanear usuario');
    }
  };

  // Load More Old Messages
  const loadMoreOldMessages = () => {
    setIsLoadingOldMessages(true);
    setMessageLimit(prev => prev + 50);
    setTimeout(() => setIsLoadingOldMessages(false), 500);
  };

  // Swipe Handlers for Mobile Reply
  const handleTouchStart = (e: React.TouchEvent, msgId: string) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setIsSwiping(msgId);
  };

  const handleTouchMove = (e: React.TouchEvent, msgId: string, isMe: boolean) => {
    if (!touchStart || isSwiping !== msgId) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = Math.abs(touch.clientY - touchStart.y);
    
    // Only allow horizontal swipe (not vertical scroll)
    if (deltaY > 30) {
      setTouchStart(null);
      setIsSwiping(null);
      return;
    }
    
    // Swipe right for left-aligned messages (others), swipe left for right-aligned (own)
    const maxSwipe = 80;
    let swipeAmount = 0;
    
    if (!isMe && deltaX > 0) {
      // Swipe right on other's message
      swipeAmount = Math.min(deltaX, maxSwipe);
    } else if (isMe && deltaX < 0) {
      // Swipe left on own message
      swipeAmount = Math.max(deltaX, -maxSwipe);
    }
    
    setSwipeState(prev => ({ ...prev, [msgId]: swipeAmount }));
  };

  const handleTouchEnd = (e: React.TouchEvent, msgId: string, msg: Message, isMe: boolean) => {
    if (!touchStart || isSwiping !== msgId) return;
    
    const swipeAmount = swipeState[msgId] || 0;
    const threshold = 50;
    
    // If swiped enough, trigger reply
    if (Math.abs(swipeAmount) >= threshold) {
      handleReplyToMessage(msg);
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    }
    
    // Reset swipe state
    setSwipeState(prev => {
      const newState = { ...prev };
      delete newState[msgId];
      return newState;
    });
    setTouchStart(null);
    setIsSwiping(null);
  };

  // Countdown Effect
  useEffect(() => {
    if (showCountdown && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (showCountdown && countdown === 0) {
      // Show screamer
      setShowCountdown(false);
      setShowScaryWarning(false);
      setShowScreamer(true);
      
      // After 3 seconds, ban the user
      setTimeout(async () => {
        if (currentUser) {
          try {
            const userRef = doc(db, "users", currentUser.uid);
            await setDoc(userRef, { banned: true }, { merge: true });
            setShowScreamer(false);
          } catch (error) {
            console.error("Error banning user:", error);
          }
        }
      }, 3000);
    }
  }, [showCountdown, countdown, currentUser]);

  // Ban user if they try to close/reload during countdown
  useEffect(() => {
    if (showCountdown && currentUser) {
      const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = '';
        
        // Ban the user immediately
        try {
          const userRef = doc(db, "users", currentUser.uid);
          await setDoc(userRef, { banned: true }, { merge: true });
        } catch (error) {
          console.error("Error banning user:", error);
        }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [showCountdown, currentUser]);

  // Load muted state from localStorage
  useEffect(() => {
    const savedMutedState = localStorage.getItem('community_chat_muted');
    if (savedMutedState !== null) {
      setIsMuted(savedMutedState === 'true');
    }
  }, []);

  // Load Community Chat Avatar from Firebase
  useEffect(() => {
    const loadCommunityAvatar = async () => {
      try {
        const chatRef = doc(db, "chats", GENERAL_CHAT_ID);
        const chatSnap = await getDoc(chatRef);
        
        if (chatSnap.exists() && chatSnap.data().avatar) {
          setSelectedContact(prev => {
            if (prev.id === GENERAL_CHAT_ID) {
              return {
                ...prev,
                avatar: chatSnap.data().avatar
              };
            }
            return prev;
          });
        }
      } catch (error) {
        console.error("Error loading community avatar:", error);
      }
    };
    
    loadCommunityAvatar();
  }, []);

  // Load Online Users for Community Chat (Real-time)
  useEffect(() => {
    if (selectedContact.id !== GENERAL_CHAT_ID) return;

    const usersRef = collection(db, "users");
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const users: {uid: string, displayName: string, photoURL: string, isOnline: boolean, email: string}[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.displayName && data.email) {
          const isUserOnline = data.isOnline === true;
          const lastSeen = data.lastSeen;
          
          // Check if user is truly online (last seen within 2 minutes)
          let actuallyOnline = false;
          if (isUserOnline && lastSeen) {
            const now = new Date();
            const lastSeenDate = lastSeen.toDate();
            const timeDiff = (now.getTime() - lastSeenDate.getTime()) / 1000; // seconds
            actuallyOnline = timeDiff < 120;
          } else {
            actuallyOnline = isUserOnline;
          }
          
          users.push({
            uid: doc.id,
            displayName: data.displayName || data.email.split('@')[0],
            photoURL: data.photoURL || `https://ui-avatars.com/api/?name=${data.displayName || data.email}`,
            isOnline: actuallyOnline,
            email: data.email
          });
        }
      });
      
      // Sort: Online first, then by name
      users.sort((a, b) => {
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return a.displayName.localeCompare(b.displayName);
      });
      
      setOnlineUsers(users);
    });

    return () => unsubscribe();
  }, [selectedContact.id]);

  // 0. Load Inbox
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
        collection(db, "users", currentUser.uid, "active_chats"), 
        orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const chats: Contact[] = snapshot.docs.map(doc => {
            const data = doc.data();
            let timeDisplay = "Now";
            if (data.timestamp) {
                const date = data.timestamp.toDate();
                const now = new Date();
                const diff = (now.getTime() - date.getTime()) / 1000;
                if (diff < 60) timeDisplay = "Just now";
                else if (diff < 3600) timeDisplay = `${Math.floor(diff/60)}m`;
                else if (diff < 86400) timeDisplay = `${Math.floor(diff/3600)}h`;
                else timeDisplay = `${Math.floor(diff/86400)}d`;
            }

            return {
                id: data.partnerId,
                name: data.partnerName || "User",
                avatar: data.partnerAvatar || "https://ui-avatars.com/api/?name=User",
                status: 'offline', // Default, updated by ChatSidebarItem
                lastMessage: data.lastMessage || "Image",
                time: timeDisplay,
                unread: data.unread || 0
            };
        });

        chats.forEach(newChat => {
            const oldChat = prevInboxRef.current.find(c => c.id === newChat.id);
            if ((!oldChat || newChat.unread > oldChat.unread) && newChat.unread > 0 && newChat.id !== selectedContact.id) {
                setNewMsgNotification({ name: newChat.name, id: newChat.id });
                setTimeout(() => setNewMsgNotification(null), 4000);
            }
        });

        prevInboxRef.current = chats;
        setInboxChats(chats);
    });

    return () => unsubscribe();
  }, [currentUser, selectedContact.id]);

  // Click outside menu to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
      // Close user suggestions when clicking outside
      setShowUserSuggestions(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check if current user is banned or isolated from chat
  useEffect(() => {
    if (!currentUser) return;

    const userRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Check chat ban
        if (data.chatBanned === true) {
          setIsChatBanned(true);
          setChatBanReason(data.chatBanReason || 'Violación de normas del chat');
          setBannedByAdminId(data.chatBannedBy || null);
          
          // Check if user has an active support ticket
          const ticketsRef = collection(db, 'supportTickets');
          const q = query(
            ticketsRef,
            where('userId', '==', currentUser.uid),
            where('status', '==', 'open')
          );
          const ticketSnapshot = await getDocs(q);
          setHasActiveTicket(!ticketSnapshot.empty);
        } else {
          setIsChatBanned(false);
          setChatBanReason('');
          setBannedByAdminId(null);
          setHasActiveTicket(false);
        }
        
        // Check isolation
        if (data.chatIsolated === true) {
          setIsIsolated(true);
        } else {
          setIsIsolated(false);
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Load Banned Users (for admins)
  useEffect(() => {
    if (!isAdminOrOwner) return;

    const usersRef = collection(db, 'users');
    const q = query(usersRef);
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const banned: {uid: string, displayName: string, email: string, photoURL: string, bannedAt: any, reason: string}[] = [];
      
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.chatBanned === true) {
          console.log('Banned user photoURL from Firestore:', data.photoURL);
          
          // Try to get username in order of priority
          let username = data.username || data.displayName;
          
          // If still no username, extract from email
          if (!username && data.email) {
            username = data.email.split('@')[0];
          }
          
          // Last resort
          if (!username) {
            username = 'Unknown User';
          }
          
          // Get photo URL - try to get from support ticket if user has ui-avatars
          let photoURL = data.photoURL;
          
          if (!photoURL || photoURL === '' || photoURL.includes('ui-avatars')) {
            // Try to get photo from support ticket
            try {
              const ticketsRef = collection(db, 'supportTickets');
              const ticketQuery = query(ticketsRef, where('userId', '==', doc.id));
              const ticketSnapshot = await getDocs(ticketQuery);
              
              if (!ticketSnapshot.empty) {
                const ticketData = ticketSnapshot.docs[0].data();
                if (ticketData.userPhotoURL && !ticketData.userPhotoURL.includes('ui-avatars')) {
                  photoURL = ticketData.userPhotoURL;
                  
                  // Update user's photoURL in Firestore
                  await updateDoc(doc.ref, {
                    photoURL: photoURL,
                    avatar: photoURL
                  });
                }
              }
            } catch (error) {
              console.error('Error fetching ticket photo:', error);
            }
          }
          
          // Only generate ui-avatars if there's no photo
          if (!photoURL || photoURL === '') {
            photoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=6366f1&color=fff&size=200&bold=true`;
          }
          
          banned.push({
            uid: doc.id,
            displayName: username,
            email: data.email || '',
            photoURL: photoURL,
            bannedAt: data.chatBannedAt || null,
            reason: data.chatBanReason || 'No reason provided'
          });
        }
      }
      
      setBannedUsers(banned);
    });

    return () => unsubscribe();
  }, [isAdminOrOwner]);

  // Load Support Tickets (for admins)
  useEffect(() => {
    if (!isAdminOrOwner) return;

    const ticketsRef = collection(db, 'supportTickets');
    const q = query(ticketsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tickets: Contact[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const ticketId = doc.id;
        const userId = data.userId || '';
        
        console.log('📋 Ticket data:', {
          ticketId,
          userDisplayName: data.userDisplayName,
          username: data.username,
          userPhotoURL: data.userPhotoURL,
          userId: data.userId,
          userEmail: data.userEmail,
          allFields: Object.keys(data)
        });
        
        tickets.push({
          id: `ticket_${ticketId}`,
          name: `Ticket: ${data.userDisplayName || data.username || 'Usuario'}`,
          avatar: data.userPhotoURL || `https://ui-avatars.com/api/?name=${data.userDisplayName || 'User'}`,
          status: 'online',
          lastMessage: data.message?.substring(0, 50) || 'Ticket de soporte',
          time: data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : 'Ahora',
          unread: data.status === 'open' ? 1 : 0,
          isSupportTicket: true,
          ticketStatus: data.status || 'open',
          userId: userId // Add userId to Contact
        });
      });
      
      setSupportTickets(tickets);
    });

    return () => unsubscribe();
  }, [isAdminOrOwner]);

  // 1. Handle Initial Target
  useEffect(() => {
    if (initialTargetId && currentUser) {
        const fetchTargetUser = async () => {
            try {
                const existingChat = inboxChats.find(c => c.id === initialTargetId);
                if (existingChat) {
                    setSelectedContact(existingChat);
                } else {
                    const docRef = doc(db, "users", initialTargetId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        setSelectedContact({
                            id: initialTargetId,
                            name: userData.displayName || "User",
                            avatar: userData.photoURL || `https://ui-avatars.com/api/?name=${userData.displayName}`,
                            status: 'online',
                            lastMessage: "Start a conversation",
                            time: "Now",
                            unread: 0
                        });
                    }
                }
                setShowMobileList(false);
            } catch (error) {
                console.error("Error fetching chat target user:", error);
            }
        };
        fetchTargetUser();
    }
  }, [initialTargetId, currentUser]);

  // --- CHAT METADATA, TYPING & ONLINE LOGIC ---
  useEffect(() => {
    if (!currentUser) return;

    // Reset local states immediately when switching chats
    setIsOtherUserTyping(false);
    setSelectedContactOnline(selectedContact.id === GENERAL_CHAT_ID);
    setSelectedContactLastSeen('');

    let chatId = selectedContact.id === GENERAL_CHAT_ID 
        ? GENERAL_CHAT_ID 
        : [currentUser.uid, selectedContact.id].sort().join('_');

    const unsubs: (() => void)[] = [];

    // 1. Listen for Typing & Online Status (Only private chats)
    if (selectedContact.id !== GENERAL_CHAT_ID) {
        // Typing
        const typingDocRef = doc(db, "chats", chatId, "typing", selectedContact.id);
        const unsubTyping = onSnapshot(typingDocRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                setIsOtherUserTyping(data?.isTyping === true);
            } else {
                setIsOtherUserTyping(false);
            }
        });
        unsubs.push(unsubTyping);

        // Online Status (Main Header Listener)
        const userRef = doc(db, "users", selectedContact.id);
        const unsubOnline = onSnapshot(userRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                const isUserOnline = data?.isOnline === true;
                const lastSeen = data?.lastSeen;
                
                // Format last seen time
                let lastSeenText = '';
                if (lastSeen) {
                    const now = new Date();
                    const lastSeenDate = lastSeen.toDate();
                    const timeDiff = (now.getTime() - lastSeenDate.getTime()) / 1000; // seconds
                    
                    if (timeDiff < 60) {
                        lastSeenText = 'Just now';
                    } else if (timeDiff < 3600) {
                        lastSeenText = `${Math.floor(timeDiff / 60)}m ago`;
                    } else if (timeDiff < 86400) {
                        lastSeenText = `${Math.floor(timeDiff / 3600)}h ago`;
                    } else {
                        lastSeenText = `${Math.floor(timeDiff / 86400)}d ago`;
                    }
                    
                    // Check if user is truly online (last seen within 2 minutes)
                    setSelectedContactOnline(isUserOnline && timeDiff < 120);
                } else {
                    setSelectedContactOnline(isUserOnline);
                    lastSeenText = 'Long time ago';
                }
                
                setSelectedContactLastSeen(lastSeenText);
            } else {
                setSelectedContactOnline(false);
                setSelectedContactLastSeen('Never');
            }
        });
        unsubs.push(unsubOnline);
    } 

    // 2. Listen for Chat Metadata (Locks, Bans, Kicks)
    const chatDocRef = doc(db, "chats", chatId);
    const unsubMeta = onSnapshot(chatDocRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            setChatMetadata(docSnapshot.data() as ChatMetadata);
        } else {
            setChatMetadata({});
        }
    });
    unsubs.push(unsubMeta);

    return () => {
        unsubs.forEach(unsub => unsub());
    };
  }, [selectedContact.id, currentUser]);

  // Listen for Community Chat Typing (Multiple Users)
  useEffect(() => {
    if (!currentUser || selectedContact.id !== GENERAL_CHAT_ID) {
      setCommunityTypingUsers([]);
      return;
    }

    const typingCollectionRef = collection(db, "chats", GENERAL_CHAT_ID, "typing");
    const unsubscribe = onSnapshot(typingCollectionRef, (snapshot) => {
      const typingUsers: {uid: string, displayName: string}[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Only show if user is typing and it's not the current user
        if (data.isTyping === true && doc.id !== currentUser.uid) {
          typingUsers.push({
            uid: doc.id,
            displayName: data.displayName || 'Usuario'
          });
        }
      });
      
      setCommunityTypingUsers(typingUsers);
    });

    return () => unsubscribe();
  }, [selectedContact.id, currentUser]);

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputText(value);
      
      // Handle @ mentions - Show user suggestions
      const lastAtIndex = value.lastIndexOf('@');
      if (lastAtIndex !== -1 && lastAtIndex === value.length - 1) {
          // User just typed @, show all users
          try {
              const usersRef = collection(db, "users");
              const snapshot = await getDocs(usersRef);
              const users: {uid: string, displayName: string, email: string, username?: string}[] = [];
              
              snapshot.forEach((doc) => {
                  const data = doc.data();
                  if (data.displayName && data.email && doc.id !== currentUser?.uid) {
                      users.push({
                          uid: doc.id,
                          displayName: data.displayName,
                          email: data.email,
                          username: data.username || data.email.split('@')[0]
                      });
                  }
              });
              
              setUserSuggestions(users);
              setCurrentCommand('@mention');
              setShowUserSuggestions(true);
          } catch (error) {
              console.error("Error fetching users:", error);
          }
      } else if (lastAtIndex !== -1 && lastAtIndex < value.length - 1) {
          // User is typing after @, filter suggestions
          const searchTerm = value.slice(lastAtIndex + 1).toLowerCase();
          
          if (searchTerm.length > 0 && userSuggestions.length > 0) {
              // Filter existing suggestions
              const filtered = userSuggestions.filter(user => 
                  user.displayName.toLowerCase().includes(searchTerm) ||
                  (user.username && user.username.toLowerCase().includes(searchTerm))
              );
              
              if (filtered.length === 0) {
                  setShowUserSuggestions(false);
              }
          }
      } else {
          // No @ in text, hide suggestions unless it's a command
          if (!value.startsWith('/')) {
              setShowUserSuggestions(false);
          }
      }
      
      // Handle command autocomplete for Community Chat (existing logic)
      if (selectedContact.id === GENERAL_CHAT_ID && isAdminOrOwner && value.startsWith('/')) {
          const commands = ['/ban', '/unban', '/kick', '/warn'];
          const currentCmd = value.split(' ')[0];
          
          if (commands.includes(currentCmd) && value.includes(' ')) {
              // Show user suggestions
              try {
                  const usersRef = collection(db, "users");
                  const snapshot = await getDocs(usersRef);
                  const users: {uid: string, displayName: string, email: string}[] = [];
                  
                  snapshot.forEach((doc) => {
                      const data = doc.data();
                      if (data.displayName && data.email) {
                          users.push({
                              uid: doc.id,
                              displayName: data.displayName,
                              email: data.email
                          });
                      }
                  });
                  
                  setUserSuggestions(users);
                  setCurrentCommand(currentCmd);
                  setShowUserSuggestions(true);
              } catch (error) {
                  console.error("Error fetching users:", error);
              }
          } else {
              if (!value.includes('@')) {
                  setShowUserSuggestions(false);
              }
          }
      }
      
      // Update typing status
      if (!currentUser) return;

      let chatId: string;
      let myTypingRef;
      
      if (selectedContact.id === GENERAL_CHAT_ID) {
          // Community Chat
          chatId = GENERAL_CHAT_ID;
          myTypingRef = doc(db, "chats", chatId, "typing", currentUser.uid);
      } else {
          // Private Chat
          chatId = [currentUser.uid, selectedContact.id].sort().join('_');
          myTypingRef = doc(db, "chats", chatId, "typing", currentUser.uid);
      }

      // Set typing to true
      await setDoc(myTypingRef, { 
          isTyping: true,
          displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
          timestamp: serverTimestamp()
      }, { merge: true });

      // Clear previous timeout
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      // Set timeout to clear typing status
      typingTimeoutRef.current = setTimeout(async () => {
           await setDoc(myTypingRef, { isTyping: false }, { merge: true });
      }, 2000);
  };

  // 2. Subscribe to Messages
  useEffect(() => {
    if (!currentUser) return;

    console.log('🎫 Selected contact changed:', {
      id: selectedContact.id,
      name: selectedContact.name,
      isSupportTicket: selectedContact.isSupportTicket,
      avatar: selectedContact.avatar
    });

    // Reset message limit when changing chats
    setMessageLimit(50);
    setHasMoreOldMessages(false);

    let collectionRef;
    let chatId: string;
    
    // Check if it's a support ticket
    if (selectedContact.id.startsWith('ticket_')) {
        const ticketId = selectedContact.id.replace('ticket_', '');
        collectionRef = collection(db, "supportTickets", ticketId, "messages");
        chatId = selectedContact.id;
        console.log('🎫 Loading ticket messages:', {
          ticketId,
          isSupportTicket: selectedContact.isSupportTicket,
          path: `supportTickets/${ticketId}/messages`
        });
    } else if (selectedContact.id === GENERAL_CHAT_ID) {
        chatId = GENERAL_CHAT_ID;
        collectionRef = collection(db, "chats", GENERAL_CHAT_ID, "messages");
    } else {
        chatId = [currentUser.uid, selectedContact.id].sort().join('_');
        collectionRef = collection(db, "chats", chatId, "messages");
        
        const myInboxRef = doc(db, "users", currentUser.uid, "active_chats", chatId);
        setDoc(myInboxRef, { unread: 0 }, { merge: true }).catch(e => console.log("Error marking inbox read", e));
    }

    // Use different orderBy field for support tickets
    // Try 'timestamp' first (new format), fallback to 'createdAt' (old format)
    const orderByField = selectedContact.isSupportTicket ? "createdAt" : "createdAt";
    const q = query(collectionRef, orderBy(orderByField, "desc"), limit(messageLimit));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      console.log('💬 Loading messages for ticket, count:', snapshot.docs.length);
      
      const msgs: Message[] = [];
      const now = new Date();
      
      // Check if there are more messages
      setHasMoreOldMessages(snapshot.docs.length === messageLimit);

      const expiredMessageIds: string[] = [];
      
      snapshot.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data() as any;
        
        console.log('📨 Message data:', {
          id: docSnapshot.id,
          text: data.text,
          senderId: data.senderId,
          senderUid: data.senderUid,
          timestamp: data.timestamp,
          createdAt: data.createdAt,
          isAdmin: data.isAdmin
        });
        
        // Check if message has expired (24 hours for System messages)
        if (data.expiresAt && data.type === 'system') {
          const expiresAt = data.expiresAt.toDate();
          if (now > expiresAt) {
            expiredMessageIds.push(docSnapshot.id);
            return; // Skip adding to messages array
          }
        }
        
        // Adapt support ticket message format to chat message format
        let message: any;
        if (selectedContact.isSupportTicket) {
          // Support tickets can have either 'timestamp' (new) or 'createdAt' (old)
          const messageTime = data.timestamp || data.createdAt;
          
          message = {
            id: docSnapshot.id,
            text: data.text,
            senderUid: data.senderId || data.senderUid,
            displayName: data.senderName || data.displayName || 'User',
            photoURL: data.senderAvatar || data.photoURL || '',
            createdAt: messageTime,
            email: data.email || '',
            read: data.read || false,
            type: data.isAdmin ? 'admin_log' : 'text'
          };
          
          console.log('✅ Adapted message:', message);
        } else {
          message = { id: docSnapshot.id, ...data };
        }
        
        msgs.push(message as Message);

        if (selectedContact.id !== GENERAL_CHAT_ID && data.senderUid !== currentUser.uid && !data.read) {
            updateDoc(docSnapshot.ref, { read: true }).catch(err => console.log("Error marking msg read", err));
        }
      });
      
      // Delete expired messages
      if (expiredMessageIds.length > 0) {
        console.log(`🗑️ Deleting ${expiredMessageIds.length} expired System messages`);
        for (const msgId of expiredMessageIds) {
          try {
            await deleteDoc(doc(db, "chats", chatId, "messages", msgId));
          } catch (error) {
            console.error("Error deleting expired message:", error);
          }
        }
      }
      
      // Reverse messages to show oldest first (since we query desc)
      setMessages(msgs.reverse());
    }, (error) => {
        console.error("Chat subscription error:", error);
        setMessages([]);
    });

    return () => unsubscribe();
  }, [selectedContact.id, currentUser, messageLimit]);

  // 3. Auto-scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isCalling, showMobileList, isOtherUserTyping]);

  // --- COMMAND PARSING LOGIC ---
  const handleCommand = async (commandText: string) => {
      if (!currentUser) return;
      
      try {
          const chatId = selectedContact.id === GENERAL_CHAT_ID 
              ? GENERAL_CHAT_ID 
              : [currentUser.uid, selectedContact.id].sort().join('_');
          
          const chatRef = doc(db, "chats", chatId);
          const args = commandText.trim().split(' ');
          const cmd = args[0].toLowerCase();

          // Ensure Chat Doc Exists (Fix for "Document Not Found")
          await setDoc(chatRef, { lastActivity: serverTimestamp() }, { merge: true });

          // LOGGING: Save the command as an 'admin_log' message.
          await addDoc(collection(db, "chats", chatId, "messages"), {
              text: commandText,
              senderUid: currentUser.uid,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              type: 'admin_log', 
              createdAt: serverTimestamp(),
          });

          if (cmd === '/clear') {
              const messagesRef = collection(db, "chats", chatId, "messages");
              const snapshot = await getDocs(messagesRef);
              
              const batchSize = 500;
              for (let i = 0; i < snapshot.docs.length; i += batchSize) {
                  const batch = writeBatch(db);
                  const chunk = snapshot.docs.slice(i, i + batchSize);
                  chunk.forEach(doc => batch.delete(doc.ref));
                  await batch.commit();
              }
              return;
          }

          if (cmd === '/lock') {
              // Use setDoc with merge to prevent crashes if doc doesn't exist
              await setDoc(chatRef, { isLocked: true }, { merge: true });
              await addDoc(collection(db, "chats", chatId, "messages"), {
                  text: "🔒 Chat bloqueado por el administrador",
                  type: 'system',
                  senderUid: 'system',
                  displayName: 'System',
                  photoURL: '',
                  createdAt: serverTimestamp(),
              });
              return;
          }

          if (cmd === '/unlock') {
              await setDoc(chatRef, { isLocked: false }, { merge: true });
              await addDoc(collection(db, "chats", chatId, "messages"), {
                  text: "🔓 Chat desbloqueado",
                  type: 'system',
                  senderUid: 'system',
                  displayName: 'System',
                  photoURL: '',
                  createdAt: serverTimestamp(),
              });
              return;
          }

          // /warn: Sends warning message AND updates recipient inbox
          if (cmd === '/warn') {
              const targetUserArg = args.slice(1).join(' ').trim();
              
              if (selectedContact.id === GENERAL_CHAT_ID) {
                  // In community chat, need to specify user
                  if (!targetUserArg) {
                      await addDoc(collection(db, "chats", chatId, "messages"), {
                          text: "❌ Uso: /warn @usuario",
                          type: 'system',
                          senderUid: 'system',
                          displayName: 'System',
                          photoURL: '',
                          createdAt: serverTimestamp(),
                      });
                      return;
                  }
                  
                  // Find user by display name or email
                  const usersRef = collection(db, "users");
                  const snapshot = await getDocs(usersRef);
                  let targetUserData = null;
                  
                  snapshot.forEach((doc) => {
                      const data = doc.data();
                      if (data.displayName?.toLowerCase() === targetUserArg.toLowerCase() || 
                          data.email?.toLowerCase() === targetUserArg.toLowerCase()) {
                          targetUserData = data;
                      }
                  });
                  
                  if (!targetUserData) {
                      await addDoc(collection(db, "chats", chatId, "messages"), {
                          text: `❌ Usuario "${targetUserArg}" no encontrado`,
                          type: 'system',
                          senderUid: 'system',
                          displayName: 'System',
                          photoURL: '',
                          createdAt: serverTimestamp(),
                      });
                      return;
                  }
                  
                  const warnText = `⚠️ ADVERTENCIA para ${targetUserData.displayName}: Se te ha emitido una advertencia. Cumple las normas para evitar un baneo.`;
                  await addDoc(collection(db, "chats", chatId, "messages"), {
                      text: warnText,
                      type: 'system',
                      senderUid: 'system',
                      displayName: 'System',
                      photoURL: '',
                      createdAt: serverTimestamp(),
                  });
                  
              } else {
                  // Private chat logic (existing)
                  const warnText = "⚠️ ADVERTENCIA: Se te ha emitido una advertencia. Cumple las normas para evitar un baneo.";
                  await addDoc(collection(db, "chats", chatId, "messages"), {
                      text: warnText,
                      type: 'system',
                      senderUid: 'system',
                      displayName: 'System',
                      photoURL: '',
                      createdAt: serverTimestamp(),
                  });
                  
                  // Update recipient's inbox so they see the warning as a new message
                  const theirInboxRef = doc(db, "users", selectedContact.id, "active_chats", chatId);
                  await setDoc(theirInboxRef, {
                      partnerId: currentUser.uid,
                      partnerName: currentUser.displayName || "Admin",
                      partnerAvatar: currentUser.photoURL,
                      lastMessage: "⚠️ System Warning",
                      timestamp: serverTimestamp(),
                      unread: increment(1)
                  }, { merge: true });
              }
              return;
          }

          // /kick: TEMPORARY removal from THIS chat
          if (cmd === '/kick') {
              if (selectedContact.id === GENERAL_CHAT_ID) {
                  await addDoc(collection(db, "chats", chatId, "messages"), {
                      text: "❌ El comando /kick no está disponible en el Community Chat. Usa /ban para baneos permanentes.",
                      type: 'system',
                      senderUid: 'system',
                      displayName: 'System',
                      photoURL: '',
                      createdAt: serverTimestamp(),
                  });
                  return;
              }
              
              // Private chat logic (existing)
              const amount = parseInt(args[1]);
              const unit = args[2]?.toLowerCase() || 'min'; // Default to min to prevent crash
              
              let durationSeconds = 0;
              if (!isNaN(amount)) {
                  if (unit.startsWith('min')) durationSeconds = amount * 60;
                  else if (unit.startsWith('h')) durationSeconds = amount * 3600;
                  else if (unit.startsWith('d')) durationSeconds = amount * 86400;
                  else if (unit.startsWith('mes')) durationSeconds = amount * 2592000;
              }

              if (durationSeconds > 0) {
                  const expirationDate = new Date();
                  expirationDate.setSeconds(expirationDate.getSeconds() + durationSeconds);
                  
                  const reasonIndex = commandText.indexOf('motivo:');
                  const reason = reasonIndex !== -1 ? commandText.substring(reasonIndex + 7).trim() : "Incumplimiento de normas";

                  await setDoc(chatRef, {
                      kickExpiresAt: Timestamp.fromDate(expirationDate),
                      kickReason: reason
                  }, { merge: true });
                  
                  const kickMsg = `👢 Usuario expulsado temporalmente por ${amount} ${unit}. Razón: ${reason}`;
                  await addDoc(collection(db, "chats", chatId, "messages"), {
                      text: kickMsg,
                      type: 'system',
                      senderUid: 'system',
                      displayName: 'System',
                      photoURL: '',
                      createdAt: serverTimestamp(),
                  });
                  
                  const theirInboxRef = doc(db, "users", selectedContact.id, "active_chats", chatId);
                  await setDoc(theirInboxRef, {
                      partnerId: currentUser.uid,
                      partnerName: currentUser.displayName || "Admin",
                      partnerAvatar: currentUser.photoURL,
                      lastMessage: "⚠️ Kicked from chat",
                      timestamp: serverTimestamp(),
                      unread: increment(1)
                  }, { merge: true });
              }
              return;
          }

          // /ban: PERMANENT ban from the platform (Global Ban)
          if (cmd === '/ban') {
              const targetUserArg = args.slice(1).join(' ').split(' motivo:')[0].trim();
              
              if (selectedContact.id === GENERAL_CHAT_ID) {
                  // In community chat, need to specify user
                  if (!targetUserArg) {
                      await addDoc(collection(db, "chats", chatId, "messages"), {
                          text: "❌ Uso: /ban @usuario motivo: razón del baneo",
                          type: 'system',
                          senderUid: 'system',
                          displayName: 'System',
                          photoURL: '',
                          createdAt: serverTimestamp(),
                      });
                      return;
                  }
                  
                  // Find user by display name or email
                  const usersRef = collection(db, "users");
                  const snapshot = await getDocs(usersRef);
                  let targetUserId = null;
                  let targetUserData = null;
                  
                  snapshot.forEach((doc) => {
                      const data = doc.data();
                      if (data.displayName?.toLowerCase() === targetUserArg.toLowerCase() || 
                          data.email?.toLowerCase() === targetUserArg.toLowerCase()) {
                          targetUserId = doc.id;
                          targetUserData = data;
                      }
                  });
                  
                  if (!targetUserId || !targetUserData) {
                      await addDoc(collection(db, "chats", chatId, "messages"), {
                          text: `❌ Usuario "${targetUserArg}" no encontrado`,
                          type: 'system',
                          senderUid: 'system',
                          displayName: 'System',
                          photoURL: '',
                          createdAt: serverTimestamp(),
                      });
                      return;
                  }
                  
                  // Check if target is admin or owner - prevent banning
                  const targetEmail = targetUserData.email || '';
                  if (ADMIN_EMAILS.includes(targetEmail) || targetEmail === OWNER_EMAIL) {
                      const isOwner = targetEmail === OWNER_EMAIL;
                      const warningMsg = isOwner 
                          ? "👑 ¿En serio crees que eres igual que yo? Soy el OWNER de esta plataforma. Tu intento de baneo ha sido registrado." 
                          : "🛡️ ¿Intentas banear a un ADMINISTRADOR? No tienes ese poder aquí. Conoce tu lugar.";
                      
                      await addDoc(collection(db, "chats", chatId, "messages"), {
                          text: warningMsg,
                          type: 'system',
                          senderUid: 'system',
                          displayName: 'System',
                          photoURL: '',
                          createdAt: serverTimestamp(),
                      });
                      return;
                  }
                  
                  // Get reason from command
                  const reasonIndex = commandText.indexOf('motivo:');
                  const reason = reasonIndex !== -1 ? commandText.substring(reasonIndex + 7).trim() : "Violación de términos de servicio";
                  
                  // Set global ban flag
                  const targetUserRef = doc(db, "users", targetUserId);
                  await setDoc(targetUserRef, {
                      banned: true,
                      banReason: reason,
                      bannedAt: serverTimestamp(),
                      bannedBy: currentUser.uid
                  }, { merge: true });
                  
                  const banMsg = `🔨 ${targetUserData.displayName} ha sido baneado permanentemente. Razón: ${reason}`;
                  await addDoc(collection(db, "chats", chatId, "messages"), {
                      text: banMsg,
                      type: 'system',
                      senderUid: 'system',
                      displayName: 'System',
                      photoURL: '',
                      createdAt: serverTimestamp(),
                  });
                  
              } else {
                  // Private chat logic (existing)
                  const targetUserRef = doc(db, "users", selectedContact.id);
                  const targetUserSnap = await getDoc(targetUserRef);
                  
                  if (targetUserSnap.exists()) {
                      const targetUserData = targetUserSnap.data();
                      const targetEmail = targetUserData.email || '';
                      
                      // Check if target is admin or owner - prevent banning
                      if (ADMIN_EMAILS.includes(targetEmail) || targetEmail === OWNER_EMAIL) {
                          const isOwner = targetEmail === OWNER_EMAIL;
                          const warningMsg = isOwner 
                              ? "👑 ¿En serio crees que eres igual que yo? Soy el OWNER de esta plataforma. Tu intento de baneo ha sido registrado." 
                              : "🛡️ ¿Intentas banear a un ADMINISTRADOR? No tienes ese poder aquí. Conoce tu lugar.";
                          
                          await addDoc(collection(db, "chats", chatId, "messages"), {
                              text: warningMsg,
                              type: 'system',
                              senderUid: 'system',
                              displayName: 'System',
                              photoURL: '',
                              createdAt: serverTimestamp(),
                          });
                          return;
                      }
                      
                      // Get reason from command
                      const reasonIndex = commandText.indexOf('motivo:');
                      const reason = reasonIndex !== -1 ? commandText.substring(reasonIndex + 7).trim() : "Violación de términos de servicio";
                      
                      // Set global ban flag
                      await setDoc(targetUserRef, {
                          banned: true,
                          banReason: reason,
                          bannedAt: serverTimestamp(),
                          bannedBy: currentUser.uid
                      }, { merge: true });
                      
                      const banMsg = `🔨 Usuario baneado permanentemente. Razón: ${reason}`;
                      await addDoc(collection(db, "chats", chatId, "messages"), {
                          text: banMsg,
                          type: 'system',
                          senderUid: 'system',
                          displayName: 'System',
                          photoURL: '',
                          createdAt: serverTimestamp(),
                      });
                      
                      // Update their inbox with ban notification
                      const theirInboxRef = doc(db, "users", selectedContact.id, "active_chats", chatId);
                      await setDoc(theirInboxRef, {
                          partnerId: currentUser.uid,
                          partnerName: currentUser.displayName || "Admin",
                          partnerAvatar: currentUser.photoURL,
                          lastMessage: "🔨 Account Banned",
                          timestamp: serverTimestamp(),
                          unread: increment(1)
                      }, { merge: true });
                  }
              }
              return;
          }

          // /banip: BAN by IP address
          if (cmd === '/banip') {
              const targetUserArg = args.slice(1).join(' ').split(' motivo:')[0].trim();
              
              if (selectedContact.id === GENERAL_CHAT_ID) {
                  // In community chat, need to specify user
                  if (!targetUserArg) {
                      await addDoc(collection(db, "chats", chatId, "messages"), {
                          text: "❌ Uso: /banip @usuario motivo: razón",
                          type: 'system',
                          senderUid: 'system',
                          displayName: 'System',
                          photoURL: '',
                          createdAt: serverTimestamp(),
                      });
                      return;
                  }
                  
                  // Find user by display name or email
                  const usersRef = collection(db, "users");
                  const snapshot = await getDocs(usersRef);
                  let targetUserId = null;
                  let targetUserData = null;
                  
                  snapshot.forEach((docSnap) => {
                      const data = docSnap.data();
                      if (data.displayName?.toLowerCase() === targetUserArg.toLowerCase() || 
                          data.email?.toLowerCase() === targetUserArg.toLowerCase() ||
                          data.username?.toLowerCase() === targetUserArg.toLowerCase().replace('@', '')) {
                          targetUserId = docSnap.id;
                          targetUserData = data;
                      }
                  });
                  
                  if (!targetUserId || !targetUserData) {
                      await addDoc(collection(db, "chats", chatId, "messages"), {
                          text: `❌ Usuario "${targetUserArg}" no encontrado`,
                          type: 'system',
                          senderUid: 'system',
                          displayName: 'System',
                          photoURL: '',
                          createdAt: serverTimestamp(),
                      });
                      return;
                  }
                  
                  // Get IP from user data (if stored)
                  const userIP = targetUserData.lastIP || null;
                  
                  if (!userIP) {
                      await addDoc(collection(db, "chats", chatId, "messages"), {
                          text: `❌ No se pudo obtener la IP del usuario "${targetUserArg}"`,
                          type: 'system',
                          senderUid: 'system',
                          displayName: 'System',
                          photoURL: '',
                          createdAt: serverTimestamp(),
                      });
                      return;
                  }
                  
                  const reasonIndex = commandText.indexOf('motivo:');
                  const reason = reasonIndex !== -1 ? commandText.substring(reasonIndex + 7).trim() : "Violación grave de normas";
                  
                  // Ban the user account
                  const targetUserRef = doc(db, "users", targetUserId);
                  await setDoc(targetUserRef, { 
                      banned: true,
                      banReason: reason,
                      bannedAt: serverTimestamp(),
                      bannedBy: currentUser.uid
                  }, { merge: true });
                  
                  // Add IP to banned IPs collection
                  const bannedIPRef = doc(db, "bannedIPs", userIP);
                  await setDoc(bannedIPRef, {
                      ip: userIP,
                      reason: reason,
                      bannedAt: serverTimestamp(),
                      bannedBy: currentUser.uid,
                      bannedUser: targetUserId
                  });
                  
                  const banMsg = `🔨 ${targetUserData.displayName} ha sido BANEADO POR IP. Razón: ${reason}`;
                  await addDoc(collection(db, "chats", chatId, "messages"), {
                      text: banMsg,
                      type: 'system',
                      senderUid: 'system',
                      displayName: 'System',
                      photoURL: '',
                      createdAt: serverTimestamp(),
                  });
                  
              } else {
                  // Private chat - ban the selected contact by IP
                  const targetUserId = selectedContact.id;
                  const targetUserRef = doc(db, "users", targetUserId);
                  const targetUserSnap = await getDoc(targetUserRef);
                  
                  if (!targetUserSnap.exists()) {
                      await addDoc(collection(db, "chats", chatId, "messages"), {
                          text: "❌ Usuario no encontrado",
                          type: 'system',
                          senderUid: 'system',
                          displayName: 'System',
                          photoURL: '',
                          createdAt: serverTimestamp(),
                      });
                      return;
                  }
                  
                  const targetUserData = targetUserSnap.data();
                  const userIP = targetUserData.lastIP || null;
                  
                  if (!userIP) {
                      await addDoc(collection(db, "chats", chatId, "messages"), {
                          text: "❌ No se pudo obtener la IP del usuario",
                          type: 'system',
                          senderUid: 'system',
                          displayName: 'System',
                          photoURL: '',
                          createdAt: serverTimestamp(),
                      });
                      return;
                  }
                  
                  const reasonIndex = commandText.indexOf('motivo:');
                  const reason = reasonIndex !== -1 ? commandText.substring(reasonIndex + 7).trim() : "Violación grave de normas";
                  
                  // Ban the user account
                  await setDoc(targetUserRef, { 
                      banned: true,
                      banReason: reason,
                      bannedAt: serverTimestamp(),
                      bannedBy: currentUser.uid
                  }, { merge: true });
                  
                  // Add IP to banned IPs collection
                  const bannedIPRef = doc(db, "bannedIPs", userIP);
                  await setDoc(bannedIPRef, {
                      ip: userIP,
                      reason: reason,
                      bannedAt: serverTimestamp(),
                      bannedBy: currentUser.uid,
                      bannedUser: targetUserId
                  });
                  
                  const banMsg = `🔨 Usuario BANEADO POR IP. Razón: ${reason}`;
                  await addDoc(collection(db, "chats", chatId, "messages"), {
                      text: banMsg,
                      type: 'system',
                      senderUid: 'system',
                      displayName: 'System',
                      photoURL: '',
                      createdAt: serverTimestamp(),
                  });
              }
              return;
          }

          // /unban: Remove global ban
          if (cmd === '/unban') {
              const targetUserArg = args.slice(1).join(' ').trim();
              
              if (selectedContact.id === GENERAL_CHAT_ID) {
                  // In community chat, need to specify user
                  if (!targetUserArg) {
                      await addDoc(collection(db, "chats", chatId, "messages"), {
                          text: "❌ Uso: /unban @usuario",
                          type: 'system',
                          senderUid: 'system',
                          displayName: 'System',
                          photoURL: '',
                          createdAt: serverTimestamp(),
                      });
                      return;
                  }
                  
                  // Find user by display name or email
                  const usersRef = collection(db, "users");
                  const snapshot = await getDocs(usersRef);
                  let targetUserId = null;
                  let targetUserData = null;
                  
                  snapshot.forEach((doc) => {
                      const data = doc.data();
                      if (data.displayName?.toLowerCase() === targetUserArg.toLowerCase() || 
                          data.email?.toLowerCase() === targetUserArg.toLowerCase()) {
                          targetUserId = doc.id;
                          targetUserData = data;
                      }
                  });
                  
                  if (!targetUserId || !targetUserData) {
                      await addDoc(collection(db, "chats", chatId, "messages"), {
                          text: `❌ Usuario "${targetUserArg}" no encontrado`,
                          type: 'system',
                          senderUid: 'system',
                          displayName: 'System',
                          photoURL: '',
                          createdAt: serverTimestamp(),
                      });
                      return;
                  }
                  
                  if (targetUserData.banned === true) {
                      // Remove ban
                      const targetUserRef = doc(db, "users", targetUserId);
                      await setDoc(targetUserRef, {
                          banned: false,
                          banReason: null,
                          bannedAt: null,
                          bannedBy: null,
                          unbannedAt: serverTimestamp(),
                          unbannedBy: currentUser.uid
                      }, { merge: true });
                      
                      const unbanMsg = `✅ ${targetUserData.displayName} ha sido desbaneado exitosamente`;
                      await addDoc(collection(db, "chats", chatId, "messages"), {
                          text: unbanMsg,
                          type: 'system',
                          senderUid: 'system',
                          displayName: 'System',
                          photoURL: '',
                          createdAt: serverTimestamp(),
                      });
                  } else {
                      await addDoc(collection(db, "chats", chatId, "messages"), {
                          text: `❌ ${targetUserData.displayName} no está baneado`,
                          type: 'system',
                          senderUid: 'system',
                          displayName: 'System',
                          photoURL: '',
                          createdAt: serverTimestamp(),
                      });
                  }
                  
              } else {
                  // Private chat logic (existing)
                  const targetUserRef = doc(db, "users", selectedContact.id);
                  const targetUserSnap = await getDoc(targetUserRef);
                  
                  if (targetUserSnap.exists()) {
                      const targetUserData = targetUserSnap.data();
                      
                      if (targetUserData.banned === true) {
                          // Remove ban
                          await setDoc(targetUserRef, {
                              banned: false,
                              banReason: null,
                              bannedAt: null,
                              bannedBy: null,
                              unbannedAt: serverTimestamp(),
                              unbannedBy: currentUser.uid
                          }, { merge: true });
                          
                          const unbanMsg = `✅ Usuario desbaneado exitosamente`;
                          await addDoc(collection(db, "chats", chatId, "messages"), {
                              text: unbanMsg,
                              type: 'system',
                              senderUid: 'system',
                              displayName: 'System',
                              photoURL: '',
                              createdAt: serverTimestamp(),
                          });
                          
                          // Update their inbox with unban notification
                          const theirInboxRef = doc(db, "users", selectedContact.id, "active_chats", chatId);
                          await setDoc(theirInboxRef, {
                              partnerId: currentUser.uid,
                              partnerName: currentUser.displayName || "Admin",
                              partnerAvatar: currentUser.photoURL,
                              lastMessage: "✅ Account Unbanned",
                              timestamp: serverTimestamp(),
                              unread: increment(1)
                          }, { merge: true });
                      } else {
                          await addDoc(collection(db, "chats", chatId, "messages"), {
                              text: "❌ Este usuario no está baneado",
                              type: 'system',
                              senderUid: 'system',
                              displayName: 'System',
                              photoURL: '',
                              createdAt: serverTimestamp(),
                          });
                      }
                  }
              }
              return;
          }

          // /chatban: Ban user from CHAT only (not platform)
          if (cmd === '/chatban') {
              const targetUserArg = args.slice(1).join(' ').split(' motivo:')[0].trim();
              
              if (selectedContact.id === GENERAL_CHAT_ID) {
                  // In community chat, need to specify user
                  if (!targetUserArg) {
                      await addDoc(collection(db, "chats", chatId, "messages"), {
                          text: "❌ Uso: /chatban @usuario motivo: razón del baneo",
                          type: 'system',
                          senderUid: 'system',
                          displayName: 'System',
                          photoURL: '',
                          createdAt: serverTimestamp(),
                      });
                      return;
                  }
                  
                  // Find user by display name or email
                  const usersRef = collection(db, "users");
                  const snapshot = await getDocs(usersRef);
                  let targetUserId = null;
                  let targetUserData = null;
                  
                  snapshot.forEach((docSnap) => {
                      const data = docSnap.data();
                      if (data.displayName?.toLowerCase() === targetUserArg.toLowerCase() || 
                          data.email?.toLowerCase() === targetUserArg.toLowerCase() ||
                          data.username?.toLowerCase() === targetUserArg.toLowerCase().replace('@', '')) {
                          targetUserId = docSnap.id;
                          targetUserData = data;
                      }
                  });
                  
                  if (!targetUserId || !targetUserData) {
                      await addDoc(collection(db, "chats", chatId, "messages"), {
                          text: `❌ Usuario "${targetUserArg}" no encontrado`,
                          type: 'system',
                          senderUid: 'system',
                          displayName: 'System',
                          photoURL: '',
                          createdAt: serverTimestamp(),
                      });
                      return;
                  }
                  
                  const reasonIndex = commandText.indexOf('motivo:');
                  const reason = reasonIndex !== -1 ? commandText.substring(reasonIndex + 7).trim() : "Violación de normas del chat";
                  
                  // Set chat ban flag
                  const targetUserRef = doc(db, "users", targetUserId);
                  await setDoc(targetUserRef, {
                      chatBanned: true,
                      chatBanReason: reason,
                      chatBannedAt: serverTimestamp(),
                      chatBannedBy: currentUser.uid
                  }, { merge: true });
                  
                  const banMsg = `💬🔨 ${targetUserData.displayName} ha sido BANEADO DEL CHAT. Razón: ${reason}`;
                  await addDoc(collection(db, "chats", chatId, "messages"), {
                      text: banMsg,
                      type: 'system',
                      senderUid: 'system',
                      displayName: 'System',
                      photoURL: '',
                      createdAt: serverTimestamp(),
                  });
                  
              } else {
                  // Private chat - ban the selected contact from chat
                  const targetUserId = selectedContact.id;
                  const targetUserRef = doc(db, "users", targetUserId);
                  
                  const reasonIndex = commandText.indexOf('motivo:');
                  const reason = reasonIndex !== -1 ? commandText.substring(reasonIndex + 7).trim() : "Violación de normas del chat";
                  
                  // Set chat ban flag
                  await setDoc(targetUserRef, {
                      chatBanned: true,
                      chatBanReason: reason,
                      chatBannedAt: serverTimestamp(),
                      chatBannedBy: currentUser.uid
                  }, { merge: true });
                  
                  const banMsg = `💬🔨 Usuario BANEADO DEL CHAT. Razón: ${reason}`;
                  await addDoc(collection(db, "chats", chatId, "messages"), {
                      text: banMsg,
                      type: 'system',
                      senderUid: 'system',
                      displayName: 'System',
                      photoURL: '',
                      createdAt: serverTimestamp(),
                  });
                  
                  // Update their inbox with ban notification
                  const theirInboxRef = doc(db, "users", selectedContact.id, "active_chats", chatId);
                  await setDoc(theirInboxRef, {
                      partnerId: currentUser.uid,
                      partnerName: currentUser.displayName || "Admin",
                      partnerAvatar: currentUser.photoURL,
                      lastMessage: "💬🔨 Chat Ban",
                      timestamp: serverTimestamp(),
                      unread: increment(1)
                  }, { merge: true });
              }
              return;
          }

          // /chatunban: Remove chat ban
          if (cmd === '/chatunban') {
              const targetUserArg = args.slice(1).join(' ').trim();
              
              if (selectedContact.id === GENERAL_CHAT_ID) {
                  // In community chat, need to specify user
                  if (!targetUserArg) {
                      await addDoc(collection(db, "chats", chatId, "messages"), {
                          text: "❌ Uso: /chatunban @usuario",
                          type: 'system',
                          senderUid: 'system',
                          displayName: 'System',
                          photoURL: '',
                          createdAt: serverTimestamp(),
                      });
                      return;
                  }
                  
                  // Find user by display name or email
                  const usersRef = collection(db, "users");
                  const snapshot = await getDocs(usersRef);
                  let targetUserId = null;
                  let targetUserData = null;
                  
                  snapshot.forEach((docSnap) => {
                      const data = docSnap.data();
                      if (data.displayName?.toLowerCase() === targetUserArg.toLowerCase() || 
                          data.email?.toLowerCase() === targetUserArg.toLowerCase() ||
                          data.username?.toLowerCase() === targetUserArg.toLowerCase().replace('@', '')) {
                          targetUserId = docSnap.id;
                          targetUserData = data;
                      }
                  });
                  
                  if (!targetUserId || !targetUserData) {
                      await addDoc(collection(db, "chats", chatId, "messages"), {
                          text: `❌ Usuario "${targetUserArg}" no encontrado`,
                          type: 'system',
                          senderUid: 'system',
                          displayName: 'System',
                          photoURL: '',
                          createdAt: serverTimestamp(),
                      });
                      return;
                  }
                  
                  if (targetUserData.chatBanned === true) {
                      // Remove chat ban
                      const targetUserRef = doc(db, "users", targetUserId);
                      await setDoc(targetUserRef, {
                          chatBanned: false,
                          chatBanReason: null,
                          chatBannedAt: null,
                          chatBannedBy: null,
                          chatUnbannedAt: serverTimestamp(),
                          chatUnbannedBy: currentUser.uid
                      }, { merge: true });
                      
                      const unbanMsg = `✅ ${targetUserData.displayName} ha sido desbaneado del chat exitosamente`;
                      await addDoc(collection(db, "chats", chatId, "messages"), {
                          text: unbanMsg,
                          type: 'system',
                          senderUid: 'system',
                          displayName: 'System',
                          photoURL: '',
                          createdAt: serverTimestamp(),
                      });
                  } else {
                      await addDoc(collection(db, "chats", chatId, "messages"), {
                          text: `❌ ${targetUserData.displayName} no está baneado del chat`,
                          type: 'system',
                          senderUid: 'system',
                          displayName: 'System',
                          photoURL: '',
                          createdAt: serverTimestamp(),
                      });
                  }
                  
              } else {
                  // Private chat logic
                  const targetUserRef = doc(db, "users", selectedContact.id);
                  const targetUserSnap = await getDoc(targetUserRef);
                  
                  if (targetUserSnap.exists()) {
                      const targetUserData = targetUserSnap.data();
                      
                      if (targetUserData.chatBanned === true) {
                          // Remove chat ban
                          await setDoc(targetUserRef, {
                              chatBanned: false,
                              chatBanReason: null,
                              chatBannedAt: null,
                              chatBannedBy: null,
                              chatUnbannedAt: serverTimestamp(),
                              chatUnbannedBy: currentUser.uid
                          }, { merge: true });
                          
                          const unbanMsg = `✅ Usuario desbaneado del chat exitosamente`;
                          await addDoc(collection(db, "chats", chatId, "messages"), {
                              text: unbanMsg,
                              type: 'system',
                              senderUid: 'system',
                              displayName: 'System',
                              photoURL: '',
                              createdAt: serverTimestamp(),
                          });
                          
                          // Update their inbox with unban notification
                          const theirInboxRef = doc(db, "users", selectedContact.id, "active_chats", chatId);
                          await setDoc(theirInboxRef, {
                              partnerId: currentUser.uid,
                              partnerName: currentUser.displayName || "Admin",
                              partnerAvatar: currentUser.photoURL,
                              lastMessage: "✅ Chat Unbanned",
                              timestamp: serverTimestamp(),
                              unread: increment(1)
                          }, { merge: true });
                      } else {
                          await addDoc(collection(db, "chats", chatId, "messages"), {
                              text: "❌ Este usuario no está baneado del chat",
                              type: 'system',
                              senderUid: 'system',
                              displayName: 'System',
                              photoURL: '',
                              createdAt: serverTimestamp(),
                          });
                      }
                  }
              }
              return;
          }
      } catch (error) {
          console.error("Command Execution Error:", error);
      }
  };


  // 4. Send Message (Text)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !currentUser) return;

    // Check for Commands - Ensure we await properly and don't fall through
    if (isAdminOrOwner && inputText.startsWith('/')) {
        await handleCommand(inputText);
        setInputText('');
        return; 
    }

    await sendMessageToFirestore({ text: inputText });
    setInputText('');
  };

  // 4.5 Send Message Core Logic (Supports Image)
  const sendMessageToFirestore = async (content: { text: string, imageUrl?: string }) => {
    if (!currentUser) return;

    try {
      let collectionRef;
      let chatId;

      // Check if it's a support ticket
      if (selectedContact.id.startsWith('ticket_')) {
          const ticketId = selectedContact.id.replace('ticket_', '');
          chatId = selectedContact.id;
          collectionRef = collection(db, "supportTickets", ticketId, "messages");
          
          // Update ticket status to in_progress when admin responds
          const ticketRef = doc(db, "supportTickets", ticketId);
          await updateDoc(ticketRef, {
              status: 'in_progress',
              lastAdminResponse: serverTimestamp(),
              respondedBy: currentUser.email
          });
      } else if (selectedContact.id === GENERAL_CHAT_ID) {
          chatId = GENERAL_CHAT_ID;
          collectionRef = collection(db, "chats", GENERAL_CHAT_ID, "messages");
          
          // Clear typing status for community chat
          const myTypingRef = doc(db, "chats", chatId, "typing", currentUser.uid);
          setDoc(myTypingRef, { isTyping: false }, { merge: true });
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      } else {
          chatId = [currentUser.uid, selectedContact.id].sort().join('_');
          collectionRef = collection(db, "chats", chatId, "messages");
          
          const myTypingRef = doc(db, "chats", chatId, "typing", currentUser.uid);
          setDoc(myTypingRef, { isTyping: false }, { merge: true });
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      }

      const msgData: any = {
        text: content.text,
        imageUrl: content.imageUrl || null,
        senderUid: currentUser.uid,
        displayName: currentUser.displayName || "Anonymous",
        photoURL: currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.email}`,
        email: currentUser.email,
        read: false,
        type: 'text',
        createdAt: serverTimestamp()
      };
      
      // Add extra fields for support tickets
      if (selectedContact.id.startsWith('ticket_')) {
        msgData.senderId = currentUser.uid;
        msgData.senderName = currentUser.displayName || "Admin";
        msgData.senderAvatar = currentUser.photoURL || '';
        msgData.isAdmin = true;
        msgData.timestamp = serverTimestamp(); // Keep both for compatibility
      }

      // Add reply data if replying to a message
      if (replyingTo) {
        msgData.replyTo = {
          messageId: replyingTo.id,
          text: replyingTo.text || 'Image',
          senderName: replyingTo.displayName,
          senderUid: replyingTo.senderUid
        };
      }

      await addDoc(collectionRef, msgData);

      // Clear reply state after sending
      setReplyingTo(null);

      const displayMessage = content.imageUrl ? "Sent an image 📷" : content.text;

      // Don't update inbox for support tickets
      if (selectedContact.id !== GENERAL_CHAT_ID && !selectedContact.id.startsWith('ticket_')) {
          const myInboxRef = doc(db, "users", currentUser.uid, "active_chats", chatId);
          await setDoc(myInboxRef, {
              partnerId: selectedContact.id,
              partnerName: selectedContact.name,
              partnerAvatar: selectedContact.avatar,
              lastMessage: displayMessage,
              timestamp: serverTimestamp(),
              unread: 0 
          }, { merge: true });

          const theirInboxRef = doc(db, "users", selectedContact.id, "active_chats", chatId);
          await setDoc(theirInboxRef, {
              partnerId: currentUser.uid,
              partnerName: currentUser.displayName || "User",
              partnerAvatar: currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.email}`,
              lastMessage: displayMessage,
              timestamp: serverTimestamp(),
              unread: increment(1)
          }, { merge: true });
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // 5. Call Logic
  const startCall = async (type: 'video' | 'audio') => {
    setCallType(type);
    setIsCalling(true);
  };

  const endCall = () => {
    setIsCalling(false);
    if (localVideoRef.current && localVideoRef.current.srcObject) {
        const tracks = (localVideoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        localVideoRef.current.srcObject = null;
    }
  };

  // 6. Handle Image Upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.files && e.target.files[0]) {
         setIsUploading(true);
         const file = e.target.files[0];
         try {
             const formData = new FormData();
             formData.append('file', file);
             formData.append('upload_preset', UPLOAD_PRESET);
             
             const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
                 method: 'POST',
                 body: formData
             });
             const data = await response.json();
             
             await sendMessageToFirestore({ text: '', imageUrl: data.secure_url });
         } catch (error) {
             console.error("Upload failed", error);
         } finally {
             setIsUploading(false);
             if (fileInputRef.current) fileInputRef.current.value = '';
         }
     }
  };

  // 6.5 Handle Group Photo Upload (Owner Only)
  const handleGroupPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
     if (!isOwner) return; // Only owner can change group photo
     
     if (e.target.files && e.target.files[0]) {
         const file = e.target.files[0];
         
         // Read file as data URL for preview
         const reader = new FileReader();
         reader.onload = (event) => {
             if (event.target?.result) {
                 setImageToCrop(event.target.result as string);
                 setShowCropModal(true);
                 setCropPosition({ x: 0, y: 0 });
                 setCropZoom(1);
             }
         };
         reader.readAsDataURL(file);
         
         // Clear input
         if (groupPhotoInputRef.current) groupPhotoInputRef.current.value = '';
     }
  };
  
  // Upload Cropped Image
  const uploadCroppedImage = async () => {
      if (!imageToCrop) {
          alert("No hay imagen para subir");
          return;
      }
      
      setIsUploading(true);
      console.log("=== INICIANDO SUBIDA DE FOTO ===");
      
      try {
          // Create canvas for cropping
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
              throw new Error("No se pudo obtener el contexto del canvas");
          }
          
          // Set canvas size (square for profile photo)
          const size = 400;
          canvas.width = size;
          canvas.height = size;
          console.log("Canvas creado:", size, "x", size);
          
          // Load image
          const img = new Image();
          
          // Wait for image to load
          const imageLoaded = new Promise<void>((resolve, reject) => {
              img.onload = () => {
                  console.log("Imagen cargada exitosamente:", img.width, "x", img.height);
                  resolve();
              };
              img.onerror = (e) => {
                  console.error("Error al cargar imagen:", e);
                  reject(new Error("Error al cargar la imagen"));
              };
              // Set src after setting up handlers
              img.src = imageToCrop;
          });
          
          await imageLoaded;
          
          // Calculate dimensions for circular crop
          const minDimension = Math.min(img.width, img.height);
          const scale = cropZoom;
          
          // Calculate source crop area
          const sourceSize = minDimension / scale;
          const sourceX = (img.width - sourceSize) / 2 - (cropPosition.x * 0.5);
          const sourceY = (img.height - sourceSize) / 2 - (cropPosition.y * 0.5);
          
          console.log("Parámetros de recorte:", {
              sourceX,
              sourceY,
              sourceSize,
              scale,
              cropPosition
          });
          
          // Fill with white background
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, size, size);
          
          // Create circular clipping path
          ctx.save();
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          
          // Draw the image
          ctx.drawImage(
              img,
              sourceX, sourceY, sourceSize, sourceSize,
              0, 0, size, size
          );
          
          ctx.restore();
          console.log("Imagen dibujada en canvas");
          
          // Convert canvas to blob
          const blobCreated = new Promise<Blob>((resolve, reject) => {
              canvas.toBlob((blob) => {
                  if (blob) {
                      console.log("Blob creado:", blob.size, "bytes, tipo:", blob.type);
                      resolve(blob);
                  } else {
                      reject(new Error("Error al crear blob desde canvas"));
                  }
              }, 'image/jpeg', 0.9);
          });
          
          const blob = await blobCreated;
          
          // Upload to Cloudinary
          const formData = new FormData();
          formData.append('file', blob, 'group-photo.jpg');
          
          // Try with preset first, if it fails, try without preset
          let uploadData;
          
          try {
              // First attempt: with upload preset
              formData.append('upload_preset', UPLOAD_PRESET);
              
              console.log("Subiendo a Cloudinary con preset...");
              console.log("Cloud Name:", CLOUD_NAME);
              console.log("Upload Preset:", UPLOAD_PRESET);
              
              const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
                  method: 'POST',
                  body: formData
              });
              
              console.log("Respuesta de Cloudinary:", uploadResponse.status, uploadResponse.statusText);
              
              if (!uploadResponse.ok) {
                  const errorText = await uploadResponse.text();
                  console.error("Error con preset:", errorText);
                  throw new Error("Preset not found");
              }
              
              uploadData = await uploadResponse.json();
              
          } catch (presetError) {
              console.log("Preset falló, intentando sin preset (unsigned)...");
              
              // Second attempt: without preset (unsigned upload)
              const formDataUnsigned = new FormData();
              formDataUnsigned.append('file', blob, 'group-photo.jpg');
              formDataUnsigned.append('upload_preset', 'ml_default'); // Cloudinary default unsigned preset
              
              const uploadResponseUnsigned = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
                  method: 'POST',
                  body: formDataUnsigned
              });
              
              console.log("Respuesta sin preset:", uploadResponseUnsigned.status, uploadResponseUnsigned.statusText);
              
              if (!uploadResponseUnsigned.ok) {
                  const errorText = await uploadResponseUnsigned.text();
                  console.error("Error sin preset:", errorText);
                  throw new Error(`Error en Cloudinary: ${uploadResponseUnsigned.status} - ${errorText}`);
              }
              
              uploadData = await uploadResponseUnsigned.json();
          }
          
          console.log("Imagen subida exitosamente:", uploadData.secure_url);
          
          // Update Firebase
          console.log("Actualizando Firebase...");
          const chatRef = doc(db, "chats", GENERAL_CHAT_ID);
          await setDoc(chatRef, {
              avatar: uploadData.secure_url,
              updatedAt: serverTimestamp(),
              updatedBy: currentUser?.uid
          }, { merge: true });
          
          console.log("Firebase actualizado");
          
          // Update local state
          setSelectedContact(prev => ({
              ...prev,
              avatar: uploadData.secure_url
          }));
          
          console.log("Estado local actualizado");
          
          // Send system message
          await addDoc(collection(db, "chats", GENERAL_CHAT_ID, "messages"), {
              text: `👑 El Owner cambió la foto del grupo`,
              type: 'system',
              senderUid: 'system',
              displayName: 'System',
              photoURL: '',
              createdAt: serverTimestamp(),
          });
          
          console.log("Mensaje del sistema enviado");
          console.log("=== SUBIDA COMPLETADA EXITOSAMENTE ===");
          
          // Close modals
          setShowCropModal(false);
          setImageToCrop(null);
          
      } catch (error: any) {
          console.error("=== ERROR EN SUBIDA DE FOTO ===");
          console.error("Tipo de error:", error.constructor.name);
          console.error("Mensaje:", error.message);
          console.error("Stack:", error.stack);
          console.error("Error completo:", error);
          
          alert(`Error al subir la foto: ${error.message}\n\nRevisa la consola para más detalles.`);
      } finally {
          setIsUploading(false);
          console.log("=== FIN DEL PROCESO ===");
      }
  };
  
  // Crop Image Handlers
  const handleCropMouseDown = (e: React.MouseEvent) => {
      setIsDragging(true);
      setDragStart({ x: e.clientX - cropPosition.x, y: e.clientY - cropPosition.y });
  };
  
  const handleCropMouseMove = (e: React.MouseEvent) => {
      if (!isDragging) return;
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      setCropPosition({ x: newX, y: newY });
  };
  
  const handleCropMouseUp = () => {
      setIsDragging(false);
  };
  
  const handleCropTouchStart = (e: React.TouchEvent) => {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - cropPosition.x, y: touch.clientY - cropPosition.y });
  };
  
  const handleCropTouchMove = (e: React.TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      const newX = touch.clientX - dragStart.x;
      const newY = touch.clientY - dragStart.y;
      setCropPosition({ x: newX, y: newY });
  };
  
  const handleCropTouchEnd = () => {
      setIsDragging(false);
  };

  // 7. Menu Actions
  const handleMenuAction = async (action: 'mute' | 'block' | 'pin' | 'delete', chat: Contact, e: React.MouseEvent) => {
      e.stopPropagation();
      setActiveMenuId(null);
      if (!currentUser) return;

      const chatId = [currentUser.uid, chat.id].sort().join('_');
      
      if (action === 'delete') {
          // Check if target user is admin/owner - prevent deletion of admin chats
          try {
              const targetUserRef = doc(db, "users", chat.id);
              const targetUserSnap = await getDoc(targetUserRef);
              
              if (targetUserSnap.exists()) {
                  const targetUserData = targetUserSnap.data();
                  const targetEmail = targetUserData.email || '';
                  
                  // Prevent deleting chats with admins or owner
                  if (ADMIN_EMAILS.includes(targetEmail) || targetEmail === OWNER_EMAIL) {
                      const isOwner = targetEmail === OWNER_EMAIL;
                      const newAttempts = warningAttempts + 1;
                      setWarningAttempts(newAttempts);
                      
                      if (newAttempts === 1) {
                          // First attempt
                          const warningMsg = isOwner 
                              ? "¿Intentas eliminar una conversación conmigo? Soy el OWNER. Este chat permanece." 
                              : "No puedes eliminar conversaciones con administradores. Respeta la jerarquía.";
                          
                          setScaryWarningMessage(warningMsg);
                          setScaryWarningType(isOwner ? 'owner' : 'admin');
                          setShowScaryWarning(true);
                      } else if (newAttempts === 2) {
                          // Second attempt - ULTIMA ADVERTENCIA
                          const warningMsg = "⚠️ ÚLTIMA ADVERTENCIA ⚠️\n\nSi intentas ELIMINAR una vez más, habrá consecuencias graves.";
                          setScaryWarningMessage(warningMsg);
                          setScaryWarningType(isOwner ? 'owner' : 'admin');
                          setShowScaryWarning(true);
                      } else if (newAttempts >= 3) {
                          // Third attempt - COUNTDOWN AND BAN
                          setScaryWarningMessage("TE LO ADVERTÍ...");
                          setScaryWarningType(isOwner ? 'owner' : 'admin');
                          setShowScaryWarning(true);
                          setShowCountdown(true);
                          setCountdown(10);
                      }
                      return;
                  }
              }
          } catch (error) {
              console.error("Error checking target user:", error);
          }
          
          if (confirm(`Delete chat with ${chat.name}?`)) {
              // Send system message to the other user
              const systemMessage = {
                  text: "🚫 El chat ha sido cerrado por el otro usuario",
                  type: 'system',
                  senderUid: 'system',
                  displayName: 'System',
                  photoURL: '',
                  createdAt: serverTimestamp(),
              };
              
              await addDoc(collection(db, "chats", chatId, "messages"), systemMessage);
              
              // Update other user's inbox with system message
              const theirInboxRef = doc(db, "users", chat.id, "active_chats", chatId);
              await setDoc(theirInboxRef, {
                  partnerId: currentUser.uid,
                  partnerName: currentUser.displayName || "User",
                  partnerAvatar: currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.email}`,
                  lastMessage: "🚫 Chat cerrado",
                  timestamp: serverTimestamp(),
                  unread: increment(1),
                  chatClosed: true // Flag to indicate chat is closed
              }, { merge: true });
              
              // Delete from my inbox
              await deleteDoc(doc(db, "users", currentUser.uid, "active_chats", chatId));
              
              // Delete all messages from the chat (historial)
              try {
                  const messagesRef = collection(db, "chats", chatId, "messages");
                  const messagesSnapshot = await getDocs(messagesRef);
                  const batch = writeBatch(db);
                  
                  messagesSnapshot.forEach((messageDoc) => {
                      batch.delete(messageDoc.ref);
                  });
                  
                  await batch.commit();
              } catch (error) {
                  console.error("Error deleting messages:", error);
              }
              
              // After 3 seconds, delete from other user's inbox too
              setTimeout(async () => {
                  try {
                      await deleteDoc(doc(db, "users", chat.id, "active_chats", chatId));
                  } catch (error) {
                      console.error("Error deleting from other user's inbox:", error);
                  }
              }, 3000);
              
              setInboxChats(prev => prev.filter(c => c.id !== chat.id));
              if (selectedContact.id === chat.id) {
                   setSelectedContact({ id: GENERAL_CHAT_ID, name: "Community Chat", avatar: "https://res.cloudinary.com/dbfza2zyk/image/upload/v1768852307/ZZPO_lmy5e2.png", status: 'online', lastMessage: "Welcome", time: "Now", unread: 0 });
              }
          }
      } else if (action === 'block') {
          // Check if target user is admin/owner - prevent blocking admins
          try {
              const targetUserRef = doc(db, "users", chat.id);
              const targetUserSnap = await getDoc(targetUserRef);
              
              if (targetUserSnap.exists()) {
                  const targetUserData = targetUserSnap.data();
                  const targetEmail = targetUserData.email || '';
                  
                  // Prevent blocking admins or owner
                  if (ADMIN_EMAILS.includes(targetEmail) || targetEmail === OWNER_EMAIL) {
                      const isOwner = targetEmail === OWNER_EMAIL;
                      const newAttempts = warningAttempts + 1;
                      setWarningAttempts(newAttempts);
                      
                      if (newAttempts === 1) {
                          // First attempt
                          const warningMsg = isOwner 
                              ? "¿Bloquearme a mí? Soy el OWNER. Imposible." 
                              : "No puedes bloquear a los administradores. Respeta la autoridad.";
                          
                          setScaryWarningMessage(warningMsg);
                          setScaryWarningType(isOwner ? 'owner' : 'admin');
                          setShowScaryWarning(true);
                      } else if (newAttempts === 2) {
                          // Second attempt - ULTIMA ADVERTENCIA
                          const warningMsg = "⚠️ ÚLTIMA ADVERTENCIA ⚠️\n\nSi intentas BLOQUEAR una vez más, habrá consecuencias graves.";
                          setScaryWarningMessage(warningMsg);
                          setScaryWarningType(isOwner ? 'owner' : 'admin');
                          setShowScaryWarning(true);
                      } else if (newAttempts >= 3) {
                          // Third attempt - COUNTDOWN AND BAN
                          setScaryWarningMessage("TE LO ADVERTÍ...");
                          setScaryWarningType(isOwner ? 'owner' : 'admin');
                          setShowScaryWarning(true);
                          setShowCountdown(true);
                          setCountdown(10);
                      }
                      return;
                  }
              }
          } catch (error) {
              console.error("Error checking target user:", error);
          }
          
          // Add to blocked list logic here
          alert(`Blocked ${chat.name}`);
      }
  };

  // RENDER HELPERS
  const formatTime = (timestamp: any) => {
      if (!timestamp) return '';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-1 h-full max-w-7xl mx-auto bg-black md:bg-[#0A0A0A] md:border border-white/10 md:rounded-2xl overflow-hidden shadow-2xl relative font-sans">
      
      {/* Show Banned View if user is banned AND not viewing a support ticket */}
      {isChatBanned && !isAdminOrOwner && !selectedContact.isSupportTicket && (
        <ChatBannedView 
          reason={chatBanReason}
          onContactSupport={handleContactSupport}
          hasActiveTicket={hasActiveTicket}
        />
      )}
      
      {/* Show Support Ticket Chat if user is banned but viewing ticket */}
      {isChatBanned && !isAdminOrOwner && selectedContact.isSupportTicket && (
        <>
          {/* CHAT AREA ONLY (No Sidebar for banned users) */}
          <div className="flex flex-1 flex-col bg-black relative">
            
            {/* Ban Warning Banner */}
            <div className="bg-red-900/20 border-b border-red-600/30 px-4 py-2">
              <div className="flex items-center gap-2 text-xs text-red-200">
                <i className="fa-solid fa-circle-exclamation text-red-400"></i>
                <span>Estás baneado del chat. Este es tu ticket de soporte para apelar el ban.</span>
              </div>
            </div>
            
            {/* Chat Header */}
            <div className="p-3 md:p-4 border-b border-white/5 flex items-center justify-between bg-[#0A0A0A] sticky top-0 z-20 backdrop-blur-md bg-opacity-95">
              <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                <div className="relative flex-shrink-0">
                  <img src={selectedContact.avatar} className="w-10 h-10 md:w-11 md:h-11 rounded-full object-cover ring-2 ring-accent/30" alt="Support" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm md:text-base font-bold text-white flex items-center gap-2 truncate">
                    <span className="truncate">{selectedContact.name}</span>
                    <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs font-bold rounded-full flex items-center gap-1">
                      <i className="fa-solid fa-ticket"></i>
                      {selectedContact.ticketStatus === 'open' ? 'Abierto' : 'En Progreso'}
                    </span>
                  </h3>
                  <p className="text-xs text-yellow-500 truncate">
                    Ticket de soporte - Responderemos pronto
                  </p>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-2 md:p-3 space-y-2 md:space-y-3 bg-chat-pattern bg-repeat relative">
              <div className="absolute inset-0 bg-black/90 pointer-events-none"></div>
              
              {messages.length === 0 && (
                <div className="relative z-10 text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
                    <i className="fa-solid fa-headset text-2xl text-accent"></i>
                  </div>
                  <p className="text-gray-400 text-sm">Inicia la conversación con el equipo de soporte</p>
                  <p className="text-gray-500 text-xs mt-2">Explica tu situación y espera una respuesta</p>
                </div>
              )}
              
              {messages.map((msg) => {
                const isMe = msg.senderUid === currentUser?.uid;
                const isSystem = msg.type === 'system';
                const isAdminMsg = msg.type === 'admin_log';

                if (isSystem) {
                  return (
                    <div key={msg.id} className="relative z-10 flex justify-center my-4">
                      <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 max-w-md">
                        <p className="text-xs text-gray-400 text-center">{msg.text}</p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={`relative z-10 flex gap-2 md:gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <img 
                      src={msg.photoURL || 'https://ui-avatars.com/api/?name=User'} 
                      className="w-8 h-8 md:w-9 md:h-9 rounded-full object-cover flex-shrink-0 ring-2 ring-white/10"
                      alt={msg.displayName}
                    />
                    <div className={`flex-1 max-w-[75%] md:max-w-[60%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-400">
                          {msg.displayName}
                          {isAdminMsg && !isMe && (
                            <span className="ml-1 text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded">
                              ADMIN
                            </span>
                          )}
                        </span>
                      </div>
                      <div className={`rounded-2xl px-3 md:px-4 py-2 md:py-2.5 ${
                        isMe 
                          ? 'bg-accent text-white' 
                          : isAdminMsg
                            ? 'bg-blue-600/20 border border-blue-500/30 text-white'
                            : 'bg-white/5 text-white border border-white/10'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 md:p-4 bg-[#0A0A0A] border-t border-white/5 relative backdrop-blur-md bg-opacity-95">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Escribe tu mensaje al equipo de soporte..."
                  className="flex-1 bg-[#151515] border border-white/10 rounded-full px-4 py-3 text-white text-sm focus:outline-none focus:border-accent transition-all"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="ml-2 text-accent hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-110 active:scale-95 p-2 hover:bg-accent/10 rounded-full"
                >
                  <i className="fa-solid fa-paper-plane text-base"></i>
                </button>
              </form>
            </div>
          </div>
        </>
      )}
      
      {/* Show Isolated Chat if user is isolated OR admin is viewing isolated chat */}
      {(!isChatBanned && isIsolated) || (isAdminOrOwner && selectedContact.isIsolated) ? (
        <IsolatedChatView 
          currentUser={currentUser!}
          isAdmin={isAdminOrOwner}
          targetUserId={selectedContact.isIsolated ? selectedContact.id.replace('isolated_', '') : undefined}
          onClose={isAdminOrOwner ? async () => {
            // Admin closes isolation
            const userId = selectedContact.id.replace('isolated_', '');
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
              chatIsolated: false,
              isolationReason: null
            });
            
            // Return to community chat
            setSelectedContact({ 
              id: GENERAL_CHAT_ID, 
              name: "Community Chat", 
              avatar: "https://res.cloudinary.com/dbfza2zyk/image/upload/v1768852307/ZZPO_lmy5e2.png", 
              status: 'online', 
              lastMessage: "Welcome", 
              time: "Now", 
              unread: 0 
            });
          } : undefined}
        />
      ) : null}
      
      {/* Normal Chat View */}
      {!isChatBanned && !isIsolated && (
        <>
      {/* SIDEBAR (Desktop: Always Visible, Mobile: Conditional) */}
      <div className={`${showMobileList ? 'flex' : 'hidden'} md:flex w-full md:w-80 flex-col border-r border-white/5 bg-[#0F0F0F]`}>
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/5">
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-xl font-bold text-white tracking-tight">Messages</h2>
                <div className="flex gap-2">
                    <button className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                        <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                </div>
            </div>
            
            {/* Tabs for Admins */}
            {isAdminOrOwner && (
                <div className="flex gap-2">
                    <button
                        onClick={() => setSidebarTab('chats')}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                            sidebarTab === 'chats'
                                ? 'bg-accent text-white'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                    >
                        <i className="fa-solid fa-comments mr-2"></i>
                        Chats
                    </button>
                    <button
                        onClick={() => setSidebarTab('bans')}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                            sidebarTab === 'bans'
                                ? 'bg-red-500 text-white'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                    >
                        <i className="fa-solid fa-ban mr-2"></i>
                        Bans ({bannedUsers.length})
                    </button>
                </div>
            )}
        </div>

        {/* Search (only for chats tab) */}
        {sidebarTab === 'chats' && (
            <div className="px-4 py-3">
                <div className="relative">
                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-3 text-gray-600 text-xs"></i>
                    <input 
                        type="text" 
                        placeholder="Search messages..." 
                        className="w-full bg-[#151515] border border-white/5 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/10 transition-colors placeholder-gray-600"
                    />
                </div>
            </div>
        )}

        {/* Chats List */}
        {sidebarTab === 'chats' && (
            <div className="flex-1 overflow-y-auto scrollbar-hide">
                {/* General Chat Pinned */}
                <button 
                    onClick={() => { setSelectedContact({ id: GENERAL_CHAT_ID, name: "Community Chat", avatar: "https://res.cloudinary.com/dbfza2zyk/image/upload/v1768852307/ZZPO_lmy5e2.png", status: 'online', lastMessage: "Welcome", time: "Now", unread: 0 }); setShowMobileList(false); }}
                    className={`w-full flex items-center gap-3 p-4 transition-colors hover:bg-white/5 border-b border-white/5 ${selectedContact.id === GENERAL_CHAT_ID ? 'bg-white/10 border-l-2 border-l-accent' : ''}`}
                >
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent border border-accent/20">
                        <i className="fa-solid fa-users"></i>
                    </div>
                    <div className="flex-1 text-left">
                        <div className="flex justify-between items-center mb-0.5">
                            <span className="text-sm font-bold text-white">Community Chat</span>
                        </div>
                        <p className="text-xs text-gray-400">Official general channel</p>
                    </div>
                </button>

             {/* Divider between community chat and private chats */}
             {inboxChats.length > 0 && (
                 <div className="px-4 py-2 bg-[#151515] border-b border-white/5">
                     <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                         <i className="fa-solid fa-message mr-2"></i>
                         Chats Privados
                     </span>
                 </div>
             )}

             {/* Dynamic Inbox */}
             {inboxChats.map(chat => (
                 <ChatSidebarItem 
                    key={chat.id}
                    chat={chat}
                    currentUser={currentUser!}
                    isSelected={selectedContact.id === chat.id}
                    activeMenuId={activeMenuId}
                    onSelect={() => { setSelectedContact(chat); setShowMobileList(false); }}
                    onMenuToggle={(e) => { 
                        e.stopPropagation(); 
                        setActiveMenuId(activeMenuId === chat.id ? null : chat.id); 
                    }}
                    onMenuAction={handleMenuAction}
                 />
             ))}

             {inboxChats.length === 0 && (
                 <div className="p-8 text-center text-gray-600 text-xs">
                     No private messages yet.
                 </div>
             )}
        </div>
        )}

        {/* Banned Users List */}
        {sidebarTab === 'bans' && (
            <div className="flex-1 overflow-y-auto scrollbar-hide">
                {bannedUsers.length === 0 ? (
                    <div className="p-8 text-center">
                        <i className="fa-solid fa-shield-check text-4xl text-green-500 mb-3"></i>
                        <p className="text-gray-400 text-sm">No hay usuarios baneados</p>
                    </div>
                ) : (
                    bannedUsers.map(user => {
                        // Find the ticket for this banned user by userId
                        const userTicket = supportTickets.find(ticket => 
                            ticket.userId === user.uid
                        );
                        
                        return (
                            <div
                                key={user.uid}
                                onClick={() => {
                                    if (userTicket) {
                                        setSelectedContact(userTicket);
                                        setShowMobileList(false);
                                        // Stay in bans tab, don't switch to chats
                                    }
                                }}
                                className={`w-full p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${
                                    userTicket && selectedContact.id === userTicket.id ? 'bg-white/10 border-l-2 border-l-red-500' : ''
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <img 
                                        src={user.photoURL} 
                                        alt={user.displayName}
                                        className="w-10 h-10 rounded-full object-cover ring-2 ring-red-500/30"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-bold text-white truncate">{user.displayName}</span>
                                            <i className="fa-solid fa-ban text-red-500 text-xs"></i>
                                            {userTicket && (
                                                <i className="fa-solid fa-ticket text-yellow-500 text-xs ml-auto"></i>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 truncate mb-1">{user.email}</p>
                                        <p className="text-xs text-gray-400 mb-2">
                                            <i className="fa-solid fa-circle-exclamation mr-1"></i>
                                            {user.reason}
                                        </p>
                                        {user.bannedAt && (
                                            <p className="text-xs text-gray-600 mb-2">
                                                {new Date(user.bannedAt.toDate()).toLocaleDateString('es-ES', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleUnbanUser(user.uid);
                                            }}
                                            className="px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
                                        >
                                            <i className="fa-solid fa-unlock"></i>
                                            Desbanear
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        )}
      </div>

      {/* CHAT AREA (Desktop: Always Visible, Mobile: Conditional) */}
      <div className={`${!showMobileList ? 'flex' : 'hidden'} md:flex flex-1 flex-col bg-black relative`}>
        
        {/* Chat Header */}
        <div className="p-3 md:p-4 border-b border-white/5 flex items-center justify-between bg-[#0A0A0A] sticky top-0 z-20 backdrop-blur-md bg-opacity-95">
             <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                 <button 
                     onClick={() => setShowMobileList(true)} 
                     className="md:hidden text-white hover:text-accent transition-colors p-2 -ml-2 active:scale-95"
                 >
                     <i className="fa-solid fa-arrow-left text-lg"></i>
                 </button>
                 <div className="relative flex-shrink-0">
                     <img src={selectedContact.avatar} className="w-10 h-10 md:w-11 md:h-11 rounded-full object-cover ring-2 ring-white/10" alt="Avatar" />
                     {/* Green dot for active chat */}
                     {selectedContactOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0A0A0A] shadow-lg"></div>}
                 </div>
                 <div className="flex-1 min-w-0">
                     <h3 className="text-sm md:text-base font-bold text-white flex items-center gap-2 truncate">
                         <span className="truncate">{selectedContact.name}</span>
                         {selectedContact.id === GENERAL_CHAT_ID && <i className="fa-solid fa-circle-check text-accent text-xs flex-shrink-0"></i>}
                         {selectedContact.isSupportTicket && (
                             <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs font-bold rounded-full flex items-center gap-1">
                                 <i className="fa-solid fa-ticket"></i>
                                 {selectedContact.ticketStatus === 'open' ? 'Nuevo' : selectedContact.ticketStatus === 'in_progress' ? 'En Progreso' : 'Resuelto'}
                             </span>
                         )}
                         {selectedContact.isIsolated && (
                             <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-bold rounded-full flex items-center gap-1">
                                 <i className="fa-solid fa-user-lock"></i>
                                 ISOLATED
                             </span>
                         )}
                     </h3>
                     {isOtherUserTyping ? (
                         <p className="text-xs text-accent font-bold flex items-center gap-2">
                             <span>Escribiendo</span>
                             <span className="flex gap-1">
                                 <span className="typing-dot w-1 h-1 bg-accent rounded-full"></span>
                                 <span className="typing-dot w-1 h-1 bg-accent rounded-full"></span>
                                 <span className="typing-dot w-1 h-1 bg-accent rounded-full"></span>
                             </span>
                         </p>
                     ) : (
                         <p className={`text-xs ${selectedContact.isSupportTicket ? 'text-yellow-500' : selectedContactOnline ? 'text-green-400' : 'text-gray-500'} truncate`}>
                             {selectedContact.id === GENERAL_CHAT_ID 
                                ? `${onlineUsers.filter(u => u.isOnline).length} online` 
                                : (selectedContactOnline ? 'Active now' : `Last seen ${selectedContactLastSeen}`)}
                         </p>
                     )}
                 </div>
             </div>

             <div className="flex gap-3 md:gap-4 items-center flex-shrink-0">
                 {selectedContact.isSupportTicket && isAdminOrOwner && (
                     <button 
                         onClick={async () => {
                             if (!confirm('¿Cerrar este ticket? Esto eliminará todo el historial de mensajes.')) return;
                             
                             try {
                                 const ticketId = selectedContact.id.replace('ticket_', '');
                                 
                                 // Delete all messages in the ticket
                                 const messagesRef = collection(db, 'supportTickets', ticketId, 'messages');
                                 const messagesSnapshot = await getDocs(messagesRef);
                                 
                                 const batch = writeBatch(db);
                                 messagesSnapshot.forEach((msgDoc) => {
                                     batch.delete(doc(db, 'supportTickets', ticketId, 'messages', msgDoc.id));
                                 });
                                 await batch.commit();
                                 
                                 // Update ticket status to closed
                                 const ticketRef = doc(db, 'supportTickets', ticketId);
                                 await updateDoc(ticketRef, {
                                     status: 'closed',
                                     closedAt: serverTimestamp(),
                                     closedBy: currentUser?.email
                                 });
                                 
                                 alert('Ticket cerrado y historial eliminado');
                             } catch (error) {
                                 console.error('Error closing ticket:', error);
                                 alert('Error al cerrar el ticket');
                             }
                         }}
                         className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
                     >
                         <i className="fa-solid fa-xmark"></i>
                         Cerrar Ticket
                     </button>
                 )}
                 {selectedContact.id !== GENERAL_CHAT_ID && !selectedContact.isSupportTicket && (
                     <>
                        <button 
                            onClick={() => startCall('audio')} 
                            className="text-gray-400 hover:text-white transition-all p-2 hover:bg-white/5 rounded-full active:scale-95"
                        >
                            <i className="fa-solid fa-phone text-base"></i>
                        </button>
                        <button 
                            onClick={() => startCall('video')} 
                            className="text-gray-400 hover:text-white transition-all p-2 hover:bg-white/5 rounded-full active:scale-95 hidden md:flex"
                        >
                            <i className="fa-solid fa-video text-base"></i>
                        </button>
                     </>
                 )}
                 <button 
                     onClick={() => setShowGroupInfo(true)}
                     className="text-gray-400 hover:text-white transition-all p-2 hover:bg-white/5 rounded-full active:scale-95"
                 >
                     <i className="fa-solid fa-ellipsis-vertical text-base"></i>
                 </button>
             </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-2 md:p-3 space-y-2 md:space-y-3 bg-chat-pattern bg-repeat relative">
             <div className="absolute inset-0 bg-black/90 pointer-events-none"></div>
             
             {/* Locked Chat Notice */}
             {chatMetadata.isLocked && (
                 <div className="sticky top-2 z-10 flex justify-center mb-2">
                     <span className="bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-1.5 rounded-full text-xs font-bold backdrop-blur-md flex items-center gap-2">
                         <i className="fa-solid fa-lock"></i> Chat is locked by admin
                     </span>
                 </div>
             )}

             {messages.map((msg, index) => {
                 const isMe = msg.senderUid === currentUser?.uid;
                 const isSystem = msg.type === 'system';
                 const isAdminLog = msg.type === 'admin_log';
                 const isCurrentUserAdmin = ADMIN_EMAILS.includes(msg.email || '') || msg.email === OWNER_EMAIL;
                 const isOwner = msg.email === OWNER_EMAIL;
                 
                 const showHeader = index === 0 || messages[index - 1].senderUid !== msg.senderUid || (msg.createdAt && messages[index - 1].createdAt && (msg.createdAt.toMillis() - messages[index - 1].createdAt.toMillis() > 300000));

                 if (isAdminLog && !isAdminOrOwner) return null; // Hide admin logs from normal users

                 if (isSystem) {
                     const isWarning = msg.text.includes("ADVERTENCIA") || msg.text.includes("Warning") || msg.text.includes("expulsado") || msg.text.includes("locked");
                     const isDeleted = msg.text.includes("eliminó este mensaje");
                     return (
                         <div key={msg.id} className="flex justify-center my-4 relative z-10 system-message-enter">
                             <span className={`px-4 py-1.5 rounded-full text-xs text-center max-w-[85%] backdrop-blur-sm border shadow-sm flex items-center gap-2 transition-all duration-300 hover:scale-105 ${
                                 isDeleted
                                 ? 'bg-gray-500/10 border-gray-500/30 text-gray-400 italic'
                                 : isWarning 
                                 ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                                 : 'bg-white/5 border-white/10 text-gray-400'
                             }`}>
                                 {isDeleted && <i className="fa-solid fa-trash text-[10px]"></i>}
                                 {isWarning && !isDeleted && <i className="fa-solid fa-triangle-exclamation"></i>}
                                 {msg.text}
                             </span>
                         </div>
                     );
                 }

                 return (
                     <div 
                        key={msg.id} 
                        className={`flex gap-3 relative z-10 group ${isMe ? 'flex-row-reverse message-enter-right' : 'message-enter-left'}`}
                        style={{
                            transform: swipeState[msg.id] ? `translateX(${swipeState[msg.id]}px)` : 'none',
                            transition: isSwiping === msg.id ? 'none' : 'transform 0.2s ease-out'
                        }}
                        onTouchStart={(e) => handleTouchStart(e, msg.id)}
                        onTouchMove={(e) => handleTouchMove(e, msg.id, isMe)}
                        onTouchEnd={(e) => handleTouchEnd(e, msg.id, msg, isMe)}
                     >
                         {/* Reply Icon Indicator (shows during swipe on mobile) */}
                         {swipeState[msg.id] && Math.abs(swipeState[msg.id]) > 20 && (
                             <div className={`absolute top-1/2 -translate-y-1/2 ${isMe ? 'right-full mr-2' : 'left-full ml-2'} text-accent opacity-${Math.min(Math.abs(swipeState[msg.id]) / 50, 1) * 100}`}>
                                 <i className="fa-solid fa-reply text-xl"></i>
                             </div>
                         )}
                         
                         {!isMe && showHeader ? (
                             <img 
                               src={msg.photoURL} 
                               className="w-8 h-8 rounded-full object-cover self-end mb-1 cursor-pointer hover:ring-2 hover:ring-accent transition-all" 
                               alt={msg.displayName}
                               onClick={() => handleUserAvatarClick(msg)}
                               title={`Ver perfil de ${msg.displayName}`}
                             />
                         ) : !isMe && !showHeader ? (
                             <div className="w-8"></div>
                         ) : null}

                         <div className={`max-w-[70%] md:max-w-[60%] ${isMe ? 'items-end' : 'items-start'} flex flex-col relative`}>
                             {showHeader && !isMe && (
                                 <div className="ml-1 mb-1 flex items-center gap-2">
                                     {/* Display Name */}
                                     <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                         {msg.displayName}
                                     </span>
                                     {/* Owner Badge - Just Crown Icon */}
                                     {isOwner && (
                                         <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-500/20 border border-blue-500/30 flex items-center shadow-sm">
                                             <i className="fa-solid fa-crown text-blue-400"></i>
                                         </span>
                                     )}
                                     {/* Admin Badge - Just Shield Icon */}
                                     {!isOwner && isCurrentUserAdmin && (
                                         <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/30 flex items-center shadow-sm">
                                             <i className="fa-solid fa-shield-halved text-red-400"></i>
                                         </span>
                                     )}
                                 </div>
                             )}
                             
                             {/* Reply Button - Desktop only (hover) */}
                             {msg.type !== 'system' && (
                                 <button
                                     onClick={() => handleReplyToMessage(msg)}
                                     className={`hidden md:flex absolute ${isMe ? 'left-0 -translate-x-10' : 'right-0 translate-x-10'} top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-accent/20 hover:bg-accent/40 text-accent hover:text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 border border-accent/30 z-50`}
                                     title="Responder"
                                 >
                                     <i className="fa-solid fa-reply text-xs"></i>
                                 </button>
                             )}
                             
                             {/* Delete Button - Show on hover for own messages or if admin/owner */}
                             {(msg.senderUid === currentUser?.uid || isAdminOrOwner) && msg.type !== 'system' && (
                                 <button
                                     onClick={() => handleDeleteMessage(msg.id, msg.senderUid, msg.email)}
                                     className={`absolute ${isMe ? 'left-0 -translate-x-20' : 'right-0 translate-x-20'} top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 border border-red-500/30 z-50`}
                                     title="Eliminar mensaje"
                                 >
                                     <i className="fa-solid fa-trash text-[10px]"></i>
                                 </button>
                             )}
                             
                             {/* Message Bubble Logic - Owner gets Neon Purple + Crown on Bubble */}
                             {isOwner ? (
                                <div className="relative group mt-2">
                                    {/* Floating Crown - POSITONED OUTSIDE ABSOLUTELY */}
                                    <div className="absolute -top-4 -right-2 z-50 transform rotate-12">
                                        <i className="fa-solid fa-crown text-[#a855f7] text-lg drop-shadow-[0_0_8px_rgba(168,85,247,1)]"></i>
                                    </div>

                                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed break-words shadow-md relative overflow-hidden bg-gradient-to-br from-[#2e1065] via-[#4c1d95] to-black text-white border border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.4)] backdrop-blur-md message-bubble-hover ${isMe ? 'rounded-tr-none' : 'rounded-tl-none'}`}>
                                        {/* Animated Pulse BG */}
                                        <div className="absolute inset-0 bg-accent/10 animate-pulse pointer-events-none"></div>
                                        {/* Carbon Fibre Texture */}
                                        <div className="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none mix-blend-overlay"></div>
                                        
                                        <div className="relative z-10 flex flex-col">
                                            {/* Reply Preview */}
                                            {msg.replyTo && (
                                                <div className="mb-2 p-2 bg-black/30 border-l-2 border-purple-400 rounded text-xs">
                                                    <div className="flex items-center gap-1 mb-1">
                                                        <i className="fa-solid fa-reply text-[9px] text-purple-300"></i>
                                                        <span className="font-bold text-purple-300">{msg.replyTo.senderName}</span>
                                                    </div>
                                                    <p className="text-purple-200/70 truncate">{msg.replyTo.text}</p>
                                                </div>
                                            )}
                                            
                                            {msg.imageUrl && (
                                                <img src={msg.imageUrl} alt="Attachment" className="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity border border-accent/30" onClick={() => window.open(msg.imageUrl, '_blank')} />
                                            )}
                                            {renderTextWithMentions(msg.text)}
                                        </div>
                                        
                                        {/* Timestamp for Owner Bubble */}
                                        <div className="text-[9px] mt-1 flex items-center justify-end gap-1 opacity-70 text-purple-200/80 relative z-10">
                                            {formatTime(msg.createdAt)}
                                            {isMe && !isAdminLog && (
                                                <span>
                                                    {msg.read ? (
                                                        <i className="fa-solid fa-check-double text-[9px] text-purple-300"></i> 
                                                    ) : (
                                                        <i className="fa-solid fa-check text-[9px]"></i>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                             ) : (
                                 /* Standard Bubble - Admin gets Red Fire Style */
                                 <div 
                                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words relative group message-bubble-hover ${
                                        isAdminLog 
                                        ? 'bg-yellow-500/10 text-yellow-200 border border-yellow-500/30 font-mono text-xs w-full'
                                        : !isOwner && isCurrentUserAdmin
                                            ? 'bg-gradient-to-br from-red-950/80 via-red-900/60 to-black/90 text-white border border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                                            : isMe 
                                                ? 'bg-accent text-white rounded-tr-sm' 
                                                : 'bg-[#1a1a1a] text-gray-200 border border-white/5 rounded-tl-sm'
                                    } ${isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                                 >
                                     {/* Admin Fire Effect */}
                                     {!isOwner && isCurrentUserAdmin && (
                                         <>
                                             <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none rounded-2xl"></div>
                                             <div className="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay rounded-2xl"></div>
                                         </>
                                     )}
                                     
                                     {/* Reply Preview */}
                                     {msg.replyTo && (
                                         <div className={`mb-2 p-2 border-l-2 rounded text-xs relative z-10 ${
                                             !isOwner && isCurrentUserAdmin
                                             ? 'bg-red-900/30 border-red-500/40'
                                             : isMe 
                                             ? 'bg-white/10 border-white/30'
                                             : !isOwner && isCurrentUserAdmin
                                             ? 'bg-red-900/30 border-red-500/40'
                                             : 'bg-white/5 border-accent/30'
                                         }`}>
                                             <div className="flex items-center gap-1 mb-1">
                                                 <i className="fa-solid fa-reply text-[9px] opacity-70"></i>
                                                 <span className="font-bold opacity-90">{msg.replyTo.senderName}</span>
                                             </div>
                                             <p className="opacity-70 truncate">{msg.replyTo.text}</p>
                                         </div>
                                     )}
                                     
                                     <div className="relative z-10">
                                         {msg.imageUrl && (
                                             <img src={msg.imageUrl} alt="Attachment" className="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(msg.imageUrl, '_blank')} />
                                         )}
                                         {renderTextWithMentions(msg.text)}
                                     </div>

                                     {/* Message Timestamp & Status */}
                                     <div className={`text-[9px] mt-1 flex items-center justify-end gap-1 opacity-70 relative z-10 ${
                                         !isOwner && isCurrentUserAdmin
                                         ? 'text-red-300/80'
                                         : isMe 
                                         ? 'text-white/80' 
                                         : 'text-gray-500'
                                     }`}>
                                         {formatTime(msg.createdAt)}
                                         {isMe && !isAdminLog && (
                                             <span>
                                                 {msg.read ? (
                                                     <i className="fa-solid fa-check-double text-[9px] text-blue-500"></i>
                                                 ) : (
                                                     <i className="fa-solid fa-check text-[9px]"></i>
                                                 )}
                                             </span>
                                         )}
                                     </div>
                                 </div>
                             )}
                         </div>
                     </div>
                 );
             })}
             
             {/* Community Chat Typing Indicator */}
             {selectedContact.id === GENERAL_CHAT_ID && communityTypingUsers.length > 0 && (
                 <div className="flex gap-3 relative z-10 message-enter-left">
                     <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/20 to-purple-600/20 flex items-center justify-center border border-accent/30">
                         <i className="fa-solid fa-users text-accent text-xs"></i>
                     </div>
                     <div className="max-w-[70%] md:max-w-[60%] items-start flex flex-col">
                         <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-[#1a1a1a] border border-white/5 shadow-md">
                             <div className="flex items-center gap-2 mb-1">
                                 <span className="text-xs text-accent font-bold">
                                     {communityTypingUsers.length === 1 
                                         ? communityTypingUsers[0].displayName
                                         : communityTypingUsers.length === 2
                                         ? `${communityTypingUsers[0].displayName} y ${communityTypingUsers[1].displayName}`
                                         : `${communityTypingUsers[0].displayName} y ${communityTypingUsers.length - 1} más`
                                     }
                                 </span>
                             </div>
                             <div className="flex items-center gap-2">
                                 <span className="text-xs text-gray-400">
                                     {communityTypingUsers.length === 1 ? 'está escribiendo' : 'están escribiendo'}
                                 </span>
                                 <span className="flex gap-1">
                                     <span className="typing-dot w-1.5 h-1.5 bg-accent rounded-full"></span>
                                     <span className="typing-dot w-1.5 h-1.5 bg-accent rounded-full"></span>
                                     <span className="typing-dot w-1.5 h-1.5 bg-accent rounded-full"></span>
                                 </span>
                             </div>
                         </div>
                     </div>
                 </div>
             )}
             
             <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 md:p-4 bg-[#0A0A0A] border-t border-white/5 relative backdrop-blur-md bg-opacity-95 safe-area-bottom">
            {/* Reply Preview Bar */}
            {replyingTo && (
                <div className="mb-2 md:mb-3 p-2 md:p-3 bg-[#151515] border border-accent/20 rounded-xl flex items-start gap-2 md:gap-3 animate-[fadeIn_0.2s_ease-out]">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <i className="fa-solid fa-reply text-accent text-xs"></i>
                            <span className="text-xs font-bold text-accent truncate">Respondiendo a {replyingTo.displayName}</span>
                        </div>
                        <p className="text-xs text-gray-400 truncate">{replyingTo.text || 'Image'}</p>
                    </div>
                    <button
                        onClick={cancelReply}
                        className="flex-shrink-0 w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors active:scale-95"
                        title="Cancelar respuesta"
                    >
                        <i className="fa-solid fa-xmark text-xs"></i>
                    </button>
                </div>
            )}
            
            {/* User Suggestions Dropdown */}
            {showUserSuggestions && (
                <div className="absolute bottom-full left-4 right-4 mb-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50">
                    <div className="p-2 border-b border-white/5">
                        <p className="text-xs text-gray-400 font-bold">
                            {currentCommand === '@mention' ? 'Mencionar usuario:' : `Selecciona un usuario para ${currentCommand}:`}
                        </p>
                    </div>
                    {userSuggestions.map((user) => (
                        <button
                            key={user.uid}
                            onClick={() => {
                                if (currentCommand === '@mention') {
                                    // Handle mention
                                    const lastAtIndex = inputText.lastIndexOf('@');
                                    const beforeAt = inputText.slice(0, lastAtIndex);
                                    const username = (user as any).username || user.displayName.replace(/\s+/g, '_');
                                    setInputText(`${beforeAt}@${username} `);
                                } else {
                                    // Handle command
                                    const commandPart = inputText.split(' ')[0];
                                    const reasonPart = inputText.includes('motivo:') ? ' ' + inputText.split('motivo:')[1] : '';
                                    setInputText(`${commandPart} ${user.displayName}${reasonPart.includes('motivo:') ? reasonPart : ' motivo: '}`);
                                }
                                setShowUserSuggestions(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-3 transition-colors"
                        >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                                {user.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm text-white font-semibold truncate">{user.displayName}</p>
                                <p className="text-xs text-gray-500 truncate">@{(user as any).username || user.email.split('@')[0]}</p>
                            </div>
                            {currentCommand === '@mention' && (
                                <i className="fa-solid fa-at text-accent text-xs"></i>
                            )}
                        </button>
                    ))}
                </div>
            )}
            
            {chatMetadata.isLocked && !isAdminOrOwner ? (
                <div className="flex items-center justify-center p-3 bg-red-900/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-bold">
                    <i className="fa-solid fa-lock mr-2"></i> Only admins can send messages.
                </div>
            ) : selectedContact.id === 'system_bot_official' ? (
                <div className="flex items-center justify-center p-3 bg-purple-900/10 border border-purple-500/20 rounded-xl text-purple-400 text-sm font-bold">
                    <i className="fa-solid fa-info-circle mr-2"></i> Este es un chat de solo lectura. No puedes responder a System.
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2.5 md:p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-full md:rounded-xl transition-all duration-200 hover:scale-110 active:scale-95 flex-shrink-0"
                        title="Upload Image"
                    >
                        <i className="fa-solid fa-image text-lg md:text-base"></i>
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleImageUpload} 
                    />
                    
                    <button 
                        onClick={() => setShowTauntModal(true)}
                        className="p-3 text-gray-400 hover:text-accent hover:bg-white/5 rounded-xl transition-colors hidden md:block flex-shrink-0"
                        title="Send Taunt/Gift"
                    >
                        <i className="fa-solid fa-gift"></i>
                    </button>

                    <form onSubmit={handleSendMessage} className="flex-1 bg-[#151515] border border-white/10 rounded-full md:rounded-xl flex items-center px-4 md:px-4 py-2 md:py-1 focus-within:border-accent transition-all relative shadow-lg">
                        <input 
                            type="text" 
                            value={inputText}
                            onChange={handleInputChange}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.repeat) {
                                    e.preventDefault();
                                    handleSendMessage(e);
                                } else if (e.key === 'Enter' && e.repeat) {
                                    e.preventDefault(); // Prevent repeated Enter
                                }
                            }}
                            placeholder={
                                selectedContact.id === 'system_bot_official'
                                    ? "No puedes responder a System..."
                                    : selectedContact.id === GENERAL_CHAT_ID && isAdminOrOwner 
                                        ? "Mensaje..." 
                                        : chatMetadata.isLocked 
                                            ? "Chat bloqueado..." 
                                            : "Mensaje..."
                            }
                            className="flex-1 bg-transparent border-none text-white text-sm md:text-sm focus:ring-0 py-1 md:py-3 placeholder-gray-500"
                            disabled={isUploading || selectedContact.id === 'system_bot_official'}
                        />
                        <button 
                            type="submit" 
                            disabled={!inputText.trim() || isUploading || selectedContact.id === 'system_bot_official'}
                            className="ml-2 text-accent hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-110 active:scale-95 p-1.5 hover:bg-accent/10 rounded-full flex-shrink-0"
                        >
                            <i className="fa-solid fa-paper-plane text-base"></i>
                        </button>
                    </form>
                </div>
            )}
        </div>

        {/* LOADING OVERLAY FOR UPLOADS */}
        {isUploading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
                <div className="bg-[#1a1a1a] p-4 rounded-xl flex items-center gap-3 border border-white/10 shadow-xl">
                    <i className="fa-solid fa-circle-notch fa-spin text-accent"></i>
                    <span className="text-white text-sm font-bold">Sending...</span>
                </div>
            </div>
        )}

        {/* CALL OVERLAY */}
        {isCalling && (
            <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center animate-[fadeIn_0.3s_ease-out]">
                 <div className="absolute top-4 left-4 text-white font-bold bg-red-600 px-3 py-1 rounded animate-pulse">
                     LIVE
                 </div>
                 
                 <div className="relative w-full max-w-lg aspect-video bg-gray-900 rounded-2xl overflow-hidden mb-8 border border-white/10 shadow-2xl">
                     {/* Mock Video Stream */}
                     <img src={selectedContact.avatar} className="w-full h-full object-cover opacity-50 blur-sm" />
                     <div className="absolute inset-0 flex items-center justify-center">
                         <div className="w-24 h-24 rounded-full border-4 border-white overflow-hidden shadow-xl">
                             <img src={selectedContact.avatar} className="w-full h-full object-cover" />
                         </div>
                     </div>
                     <p className="absolute bottom-4 left-0 right-0 text-center text-white font-bold text-xl drop-shadow-md">
                         {callType === 'video' ? 'Video Calling' : 'Calling'} {selectedContact.name}...
                     </p>
                 </div>

                 <div className="flex items-center gap-6">
                     <button className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md flex items-center justify-center transition-all">
                         <i className={`fa-solid ${callType === 'video' ? 'fa-video-slash' : 'fa-microphone-slash'} text-xl`}></i>
                     </button>
                     <button 
                        onClick={endCall}
                        className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-900/50 scale-110 transition-transform active:scale-95"
                     >
                         <i className="fa-solid fa-phone-slash text-2xl"></i>
                     </button>
                     <button className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md flex items-center justify-center transition-all">
                         <i className="fa-solid fa-volume-high text-xl"></i>
                     </button>
                 </div>
            </div>
        )}

      {/* SCARY WARNING MODAL */}
      {showScaryWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center animate-[fadeIn_0.3s_ease-out]">
          {/* Animated Background */}
          <div className="absolute inset-0 bg-black animate-pulse" style={{
            backgroundImage: scaryWarningType === 'owner' 
              ? 'radial-gradient(circle at 50% 50%, rgba(139, 0, 139, 0.3) 0%, rgba(0, 0, 0, 0.95) 100%)'
              : 'radial-gradient(circle at 50% 50%, rgba(139, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.95) 100%)',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          }}></div>
          
          {/* Glitch Effect Overlay */}
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
            backgroundImage: scaryWarningType === 'owner'
              ? 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(168, 85, 247, 0.1) 2px, rgba(168, 85, 247, 0.1) 4px)'
              : 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 0, 0, 0.1) 2px, rgba(255, 0, 0, 0.1) 4px)',
            animation: 'glitch 0.3s infinite'
          }}></div>

          {/* Modal Content */}
          <div className="relative z-10 max-w-2xl w-full mx-4 animate-[scaleIn_0.5s_ease-out]">
            {/* Skull Icon with Glow */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className={`absolute inset-0 ${scaryWarningType === 'owner' ? 'bg-yellow-400' : 'bg-red-600'} blur-3xl opacity-50 animate-pulse`}></div>
                <i className={`fa-solid ${scaryWarningType === 'owner' ? 'fa-crown' : 'fa-skull-crossbones'} text-9xl relative z-10 animate-bounce`} 
                   style={{
                     color: scaryWarningType === 'owner' ? '#FFD700' : '#DC2626',
                     textShadow: scaryWarningType === 'owner' 
                       ? '0 0 30px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 215, 0, 0.6)'
                       : '0 0 30px rgba(220, 38, 38, 0.8), 0 0 60px rgba(220, 38, 38, 0.6)',
                     filter: scaryWarningType === 'owner'
                       ? 'drop-shadow(0 0 20px rgba(255, 215, 0, 0.9))'
                       : 'drop-shadow(0 0 20px rgba(220, 38, 38, 0.9))'
                   }}>
                </i>
              </div>
            </div>

            {/* Warning Box */}
            <div className={`bg-gradient-to-b ${scaryWarningType === 'owner' ? 'from-purple-950/90 to-black/95 border-purple-600' : 'from-red-950/90 to-black/95 border-red-600'} border-4 rounded-2xl p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden`}>
              {/* Animated Border Glow */}
              <div className={`absolute inset-0 border-4 ${scaryWarningType === 'owner' ? 'border-purple-500' : 'border-red-500'} rounded-2xl animate-pulse opacity-50`}></div>
              
              {/* Scanlines Effect */}
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 255, 255, 0.03) 2px, rgba(255, 255, 255, 0.03) 4px)'
              }}></div>

              <div className="relative z-10">
                {/* Title */}
                <h1 className="text-5xl font-black text-center mb-6 uppercase tracking-wider animate-pulse" style={{
                  color: scaryWarningType === 'owner' ? '#A855F7' : '#FF0000',
                  textShadow: scaryWarningType === 'owner'
                    ? '0 0 20px rgba(168, 85, 247, 0.8), 0 0 40px rgba(168, 85, 247, 0.6), 0 5px 10px rgba(0, 0, 0, 0.8)'
                    : '0 0 20px rgba(255, 0, 0, 0.8), 0 0 40px rgba(255, 0, 0, 0.6), 0 5px 10px rgba(0, 0, 0, 0.8)',
                  fontFamily: 'Impact, sans-serif',
                  letterSpacing: '0.1em'
                }}>
                  {scaryWarningType === 'owner' ? '⚠️ ACCESO DENEGADO ⚠️' : '🚫 PROHIBIDO 🚫'}
                </h1>

                {/* Message */}
                <div className={`bg-black/60 border-2 ${scaryWarningType === 'owner' ? 'border-purple-700' : 'border-red-700'} rounded-xl p-6 mb-6`}>
                  <p className="text-2xl font-bold text-white text-center leading-relaxed whitespace-pre-line" style={{
                    textShadow: scaryWarningType === 'owner' 
                      ? '0 0 10px rgba(168, 85, 247, 0.5)'
                      : '0 0 10px rgba(255, 0, 0, 0.5)',
                    fontFamily: 'Arial Black, sans-serif'
                  }}>
                    {scaryWarningMessage}
                  </p>
                  
                  {/* Countdown Display */}
                  {showCountdown && (
                    <div className="mt-6">
                      <div className="text-center mb-4">
                        <p className="text-white text-lg font-bold uppercase tracking-wider animate-pulse">
                          CUENTA REGRESIVA PARA TU BANEO
                        </p>
                      </div>
                      <div className="flex justify-center">
                        <div className={`w-32 h-32 rounded-full ${scaryWarningType === 'owner' ? 'bg-purple-900/50 border-purple-500' : 'bg-red-900/50 border-red-500'} border-8 flex items-center justify-center animate-pulse`}>
                          <span className="text-7xl font-black text-white" style={{
                            textShadow: '0 0 20px rgba(255, 255, 255, 0.8)'
                          }}>
                            {countdown}
                          </span>
                        </div>
                      </div>
                      <p className="text-center mt-4 text-white text-sm font-bold animate-pulse">
                        ⚠️ NO HAY VUELTA ATRÁS ⚠️
                      </p>
                    </div>
                  )}
                </div>

                {/* Warning Text */}
                <div className="text-center mb-6">
                  <p className={`${scaryWarningType === 'owner' ? 'text-purple-400' : 'text-red-400'} text-sm font-bold uppercase tracking-widest animate-pulse`}>
                    {scaryWarningType === 'owner' ? '👑 EL DUEÑO ESTÁ OBSERVANDO 👑' : '⚡ RESPETA LA AUTORIDAD ⚡'}
                  </p>
                </div>

                {/* Close Button */}
                {!showCountdown && (
                  <button 
                    onClick={() => setShowScaryWarning(false)}
                    className={`w-full py-4 ${scaryWarningType === 'owner' ? 'bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 border-purple-400' : 'bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 border-red-400'} text-white font-black text-xl rounded-xl transition-all transform hover:scale-105 active:scale-95 shadow-lg uppercase tracking-wider border-2`}
                    style={{
                      textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)',
                      boxShadow: scaryWarningType === 'owner'
                        ? '0 0 30px rgba(168, 85, 247, 0.6), inset 0 0 20px rgba(0, 0, 0, 0.3)'
                        : '0 0 30px rgba(220, 38, 38, 0.6), inset 0 0 20px rgba(0, 0, 0, 0.3)'
                    }}
                  >
                    ENTENDIDO
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Warning */}
            <div className="text-center mt-6">
              <p className={`${scaryWarningType === 'owner' ? 'text-purple-500' : 'text-red-500'} text-xs font-bold uppercase tracking-widest animate-pulse`}>
                ⚠️ No intentes esto de nuevo ⚠️
              </p>
            </div>
          </div>

          {/* Add CSS animations */}
          <style>{`
            @keyframes glitch {
              0%, 100% { transform: translate(0); }
              20% { transform: translate(-2px, 2px); }
              40% { transform: translate(-2px, -2px); }
              60% { transform: translate(2px, 2px); }
              80% { transform: translate(2px, -2px); }
            }
            @keyframes scaleIn {
              0% { transform: scale(0.5) rotate(-5deg); opacity: 0; }
              50% { transform: scale(1.05) rotate(2deg); }
              100% { transform: scale(1) rotate(0deg); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* SCREAMER MODAL */}
      {showScreamer && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black animate-[flash_0.1s_infinite]">
          {/* Screamer Image */}
          <div className="relative w-full h-full flex items-center justify-center">
            <img 
              src="https://i.imgur.com/rVHhFXz.gif" 
              alt="Screamer"
              className="w-full h-full object-cover animate-[shake_0.1s_infinite]"
              style={{
                filter: 'contrast(1.5) saturate(2)'
              }}
            />
            
            {/* Overlapping Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <h1 className="text-9xl font-black text-red-600 animate-pulse uppercase" style={{
                textShadow: '0 0 50px rgba(255, 0, 0, 1), 0 0 100px rgba(255, 0, 0, 0.8)',
                fontFamily: 'Impact, sans-serif',
                WebkitTextStroke: '3px black'
              }}>
                BANEADO
              </h1>
              <p className="text-4xl font-black text-white mt-4 animate-pulse" style={{
                textShadow: '0 0 30px rgba(0, 0, 0, 1)',
                WebkitTextStroke: '2px black'
              }}>
                TE LO ADVERTIMOS
              </p>
            </div>
          </div>

          {/* Add CSS animations for screamer */}
          <style>{`
            @keyframes flash {
              0%, 100% { background-color: black; }
              50% { background-color: #8B0000; }
            }
            @keyframes shake {
              0%, 100% { transform: translate(0, 0) rotate(0deg); }
              10% { transform: translate(-10px, -10px) rotate(-2deg); }
              20% { transform: translate(10px, 10px) rotate(2deg); }
              30% { transform: translate(-10px, 10px) rotate(-2deg); }
              40% { transform: translate(10px, -10px) rotate(2deg); }
              50% { transform: translate(-10px, -10px) rotate(-2deg); }
              60% { transform: translate(10px, 10px) rotate(2deg); }
              70% { transform: translate(-10px, 10px) rotate(-2deg); }
              80% { transform: translate(10px, -10px) rotate(2deg); }
              90% { transform: translate(-10px, -10px) rotate(-2deg); }
            }
          `}</style>
        </div>
      )}

      </div>

      {/* GROUP INFO MODAL - WhatsApp Style */}
      {showGroupInfo && selectedContact.id === GENERAL_CHAT_ID && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]" onClick={() => setShowGroupInfo(false)}>
          <div className="bg-[#0A0A0A] w-full max-w-lg rounded-2xl shadow-2xl border border-white/10 max-h-[90vh] overflow-hidden flex flex-col animate-[slideUp_0.3s_ease-out]" onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#151515]">
              <h2 className="text-lg font-bold text-white">Información del grupo</h2>
              <button 
                onClick={() => setShowGroupInfo(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              
              {/* Group Photo Section */}
              <div className="p-6 flex flex-col items-center bg-gradient-to-b from-[#151515] to-[#0A0A0A] border-b border-white/5">
                <div className="relative group">
                  <img 
                    src={selectedContact.avatar} 
                    className="w-32 h-32 rounded-full object-cover border-4 border-accent/30 shadow-xl"
                    alt="Group"
                  />
                  {isOwner && (
                    <>
                      <button 
                        onClick={() => groupPhotoInputRef.current?.click()}
                        className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <div className="text-center">
                          <i className="fa-solid fa-camera text-white text-2xl mb-1"></i>
                          <p className="text-white text-xs font-bold">CAMBIAR</p>
                        </div>
                      </button>
                      {/* Hidden file input for group photo */}
                      <input 
                        type="file" 
                        ref={groupPhotoInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleGroupPhotoUpload} 
                      />
                    </>
                  )}
                </div>
                <h3 className="text-xl font-bold text-white mt-4 flex items-center gap-2">
                  {selectedContact.name}
                  <i className="fa-solid fa-circle-check text-accent text-sm"></i>
                </h3>
                <p className="text-sm text-gray-400 mt-1">Grupo · {onlineUsers.length} participantes</p>
              </div>

              {/* Multimedia Section */}
              <div className="p-4 border-b border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <i className="fa-solid fa-image text-accent"></i>
                    Multimedia
                  </h4>
                  <span className="text-xs text-gray-500">Solo imágenes</span>
                </div>
                
                {/* Image Grid */}
                <div className="grid grid-cols-3 gap-2">
                  {messages
                    .filter(msg => msg.imageUrl && msg.type !== 'system')
                    .slice(-9) // Last 9 images
                    .map((msg, idx) => (
                      <div 
                        key={idx}
                        className="aspect-square rounded-lg overflow-hidden bg-[#151515] border border-white/5 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => window.open(msg.imageUrl, '_blank')}
                      >
                        <img 
                          src={msg.imageUrl} 
                          className="w-full h-full object-cover"
                          alt="Media"
                        />
                      </div>
                    ))}
                  
                  {messages.filter(msg => msg.imageUrl && msg.type !== 'system').length === 0 && (
                    <div className="col-span-3 text-center py-8 text-gray-500 text-sm">
                      <i className="fa-solid fa-image text-3xl mb-2 opacity-30"></i>
                      <p>No hay imágenes compartidas</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Members Section */}
              <div className="p-4 border-b border-white/5">
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-users text-accent"></i>
                  {onlineUsers.length} participantes
                </h4>
                
                {/* Members List */}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {/* Real Users from Firebase */}
                  {onlineUsers.map((user) => {
                    const isUserOwner = user.email === OWNER_EMAIL;
                    const isUserAdmin = ADMIN_EMAILS.includes(user.email) && !isUserOwner;
                    const isCurrentUser = user.uid === currentUser?.uid;
                    
                    return (
                      <div key={user.uid} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                        <div className="relative">
                          <img 
                            src={user.photoURL}
                            className="w-10 h-10 rounded-full object-cover"
                            alt={user.displayName}
                          />
                          {/* Online indicator */}
                          {user.isOnline && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0A0A0A]"></div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white flex items-center gap-2">
                            {user.displayName}
                            {/* Owner Badge */}
                            {isUserOwner && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 border border-blue-500/30 flex items-center">
                                <i className="fa-solid fa-crown text-blue-400"></i>
                              </span>
                            )}
                            {/* Admin Badge */}
                            {isUserAdmin && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/30 flex items-center">
                                <i className="fa-solid fa-shield-halved text-red-400"></i>
                              </span>
                            )}
                          </p>
                          <p className={`text-xs ${isCurrentUser ? 'text-accent font-bold' : user.isOnline ? 'text-green-400' : 'text-gray-500'}`}>
                            {isCurrentUser ? 'Tú' : isUserOwner ? 'Owner' : isUserAdmin ? 'Admin' : user.isOnline ? 'En línea' : 'Desconectado'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* No users message */}
                  {onlineUsers.length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      <i className="fa-solid fa-users text-3xl mb-2 opacity-30"></i>
                      <p>Cargando participantes...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Section */}
              <div className="p-4 space-y-2">
                
                {/* Mute Notifications Toggle */}
                <button 
                  onClick={() => {
                    const newMutedState = !isMuted;
                    setIsMuted(newMutedState);
                    localStorage.setItem('community_chat_muted', newMutedState.toString());
                    
                    // Show toast notification
                    const toastMsg = newMutedState ? 'Notificaciones silenciadas' : 'Notificaciones activadas';
                    console.log(toastMsg);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-[#151515] hover:bg-white/5 border border-white/5 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isMuted ? 'bg-gray-500/20' : 'bg-accent/20'}`}>
                      <i className={`fa-solid ${isMuted ? 'fa-bell-slash' : 'fa-bell'} ${isMuted ? 'text-gray-400' : 'text-accent'}`}></i>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-white">Silenciar notificaciones</p>
                      <p className="text-xs text-gray-500">{isMuted ? 'Silenciado' : 'Activo'}</p>
                    </div>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-colors ${isMuted ? 'bg-gray-600' : 'bg-accent'} relative`}>
                    <div className={`absolute top-0.5 ${isMuted ? 'left-0.5' : 'left-6'} w-5 h-5 rounded-full bg-white transition-all shadow-md`}></div>
                  </div>
                </button>

                {/* Delete Chat */}
                <button 
                  onClick={() => {
                    if (confirm('¿Estás seguro de que quieres eliminar este chat? Se borrarán todos los mensajes.')) {
                      // Clear messages locally (won't affect other users)
                      setMessages([]);
                      setShowGroupInfo(false);
                      console.log('Chat eliminado localmente');
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#151515] hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-full bg-red-500/20 group-hover:bg-red-500/30 flex items-center justify-center transition-colors">
                    <i className="fa-solid fa-trash text-red-400"></i>
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold text-red-400">Eliminar chat</p>
                    <p className="text-xs text-gray-500">Borra todos los mensajes</p>
                  </div>
                </button>

                {/* Leave Group */}
                <button 
                  onClick={() => {
                    if (confirm('¿Estás seguro de que quieres salir del grupo?')) {
                      // Navigate away or clear chat
                      setShowGroupInfo(false);
                      setShowMobileList(true);
                      console.log('Usuario salió del grupo');
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#151515] hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-full bg-red-500/20 group-hover:bg-red-500/30 flex items-center justify-center transition-colors">
                    <i className="fa-solid fa-right-from-bracket text-red-400"></i>
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold text-red-400">Salir del grupo</p>
                    <p className="text-xs text-gray-500">Ya no recibirás mensajes</p>
                  </div>
                </button>

              </div>
            </div>

          </div>

          {/* Add CSS animations */}
          <style>{`
            @keyframes slideUp {
              from {
                transform: translateY(100px);
                opacity: 0;
              }
              to {
                transform: translateY(0);
                opacity: 1;
              }
            }
            
            @keyframes messageSlideIn {
              from {
                transform: translateY(20px) scale(0.95);
                opacity: 0;
              }
              to {
                transform: translateY(0) scale(1);
                opacity: 1;
              }
            }
            
            @keyframes messageSlideInLeft {
              from {
                transform: translateX(-30px) scale(0.95);
                opacity: 0;
              }
              to {
                transform: translateX(0) scale(1);
                opacity: 1;
              }
            }
            
            @keyframes messageSlideInRight {
              from {
                transform: translateX(30px) scale(0.95);
                opacity: 0;
              }
              to {
                transform: translateX(0) scale(1);
                opacity: 1;
              }
            }
            
            @keyframes messagePop {
              0% {
                transform: scale(0.8);
                opacity: 0;
              }
              50% {
                transform: scale(1.05);
              }
              100% {
                transform: scale(1);
                opacity: 1;
              }
            }
            
            @keyframes typingDots {
              0%, 20% {
                opacity: 0.3;
                transform: translateY(0);
              }
              50% {
                opacity: 1;
                transform: translateY(-5px);
              }
              100% {
                opacity: 0.3;
                transform: translateY(0);
              }
            }
            
            @keyframes shimmer {
              0% {
                background-position: -1000px 0;
              }
              100% {
                background-position: 1000px 0;
              }
            }
            
            @keyframes bounce {
              0%, 100% {
                transform: translateY(0);
              }
              50% {
                transform: translateY(-10px);
              }
            }
            
            .message-enter {
              animation: messageSlideIn 0.3s ease-out;
            }
            
            .message-enter-left {
              animation: messageSlideInLeft 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            
            .message-enter-right {
              animation: messageSlideInRight 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            
            .system-message-enter {
              animation: messagePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            
            .typing-dot {
              animation: typingDots 1.4s infinite;
            }
            
            .typing-dot:nth-child(2) {
              animation-delay: 0.2s;
            }
            
            .typing-dot:nth-child(3) {
              animation-delay: 0.4s;
            }
            
            .message-bubble-hover {
              transition: all 0.2s ease;
            }
            
            .message-bubble-hover:hover {
              transform: translateY(-2px);
              box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
            }
            
            .send-button-active {
              animation: bounce 0.3s ease;
            }
          `}</style>
        </div>
      )}

      {/* IMAGE CROP MODAL */}
      {showCropModal && imageToCrop && (
        <div className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !isUploading && setShowCropModal(false)}>
          <div className="bg-[#0A0A0A] w-full max-w-2xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#151515]">
              <h2 className="text-lg font-bold text-white">Ajustar foto del grupo</h2>
              <button 
                onClick={() => !isUploading && setShowCropModal(false)}
                disabled={isUploading}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-50"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Crop Area */}
            <div className="p-6 flex flex-col items-center gap-4">
              
              {/* Image Preview with Crop Circle */}
              <div 
                className="relative w-full aspect-square max-w-md bg-black rounded-xl overflow-hidden cursor-move select-none"
                onMouseDown={handleCropMouseDown}
                onMouseMove={handleCropMouseMove}
                onMouseUp={handleCropMouseUp}
                onMouseLeave={handleCropMouseUp}
                onTouchStart={handleCropTouchStart}
                onTouchMove={handleCropTouchMove}
                onTouchEnd={handleCropTouchEnd}
              >
                {/* Image */}
                <img 
                  src={imageToCrop}
                  alt="Crop preview"
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  style={{
                    transform: `translate(${cropPosition.x}px, ${cropPosition.y}px) scale(${cropZoom})`,
                    transformOrigin: 'center'
                  }}
                  draggable={false}
                />
                
                {/* Crop Circle Overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Dark overlay with circle cutout */}
                  <svg className="w-full h-full">
                    <defs>
                      <mask id="cropMask">
                        <rect width="100%" height="100%" fill="white" />
                        <circle cx="50%" cy="50%" r="40%" fill="black" />
                      </mask>
                    </defs>
                    <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.7)" mask="url(#cropMask)" />
                  </svg>
                  
                  {/* Circle border */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-[80%] h-[80%] rounded-full border-4 border-white/50 border-dashed"></div>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-2">
                  <i className="fa-solid fa-hand-pointer mr-2"></i>
                  Arrastra para mover · Usa el slider para hacer zoom
                </p>
              </div>

              {/* Zoom Slider */}
              <div className="w-full max-w-md">
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-magnifying-glass-minus text-gray-400"></i>
                  <input 
                    type="range"
                    min="1"
                    max="3"
                    step="0.1"
                    value={cropZoom}
                    onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent"
                    style={{
                      background: `linear-gradient(to right, #FF1B6D 0%, #FF1B6D ${((cropZoom - 1) / 2) * 100}%, rgba(255, 255, 255, 0.1) ${((cropZoom - 1) / 2) * 100}%, rgba(255, 255, 255, 0.1) 100%)`
                    }}
                  />
                  <i className="fa-solid fa-magnifying-glass-plus text-gray-400"></i>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-xs text-gray-500">1x</span>
                  <span className="text-xs text-accent font-bold">{cropZoom.toFixed(1)}x</span>
                  <span className="text-xs text-gray-500">3x</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 w-full max-w-md mt-4">
                <button 
                  onClick={() => !isUploading && setShowCropModal(false)}
                  disabled={isUploading}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors border border-white/10 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  onClick={uploadCroppedImage}
                  disabled={isUploading}
                  className="flex-1 py-3 bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-600/90 text-white font-bold rounded-xl transition-all shadow-lg shadow-accent/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin"></i>
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check"></i>
                      Guardar
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Hidden canvas for cropping */}
            <canvas ref={cropCanvasRef} className="hidden" />
          </div>
        </div>
      )}

      </>
      )}

      {/* User Profile Modal */}
      {showUserProfile && selectedUserProfile && (
        <UserProfileModal 
          user={selectedUserProfile}
          currentUser={currentUser!}
          isAdmin={isAdminOrOwner}
          onClose={() => setShowUserProfile(false)}
          onStartChat={handleStartChatFromProfile}
          onReport={handleReportFromProfile}
        />
      )}

    </div>
  );
};

export default ChatView;