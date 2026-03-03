import React, { useState, useRef, useEffect } from 'react';
import { BOTTOM_NAV_ITEMS } from '../constants';
import { db } from '../firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import NotificationsPanel from './NotificationsPanel';

interface SidebarProps {
  currentView: 'home' | 'profile' | 'admin' | 'chat' | 'feed' | 'community' | 'create' | 'video';
  onNavigate: (view: 'home' | 'profile' | 'admin' | 'chat' | 'feed' | 'community' | 'create') => void;
  isOpen: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
  isAdmin?: boolean;
  userTier?: 'Free' | 'Premium' | 'VIP';
  onViewProfile: (userId: string) => void;
  userEmail?: string;
  onLogin?: () => void;
  isGlobalBanned?: boolean;
}

interface UserSearchResult {
  uid: string;
  username: string;
  displayName: string;
  avatar?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, isOpen, onClose, onUpgrade, isAdmin, userTier = 'Free', onViewProfile, userEmail, onLogin, isGlobalBanned = false }) => {
  const OWNER_EMAILS = ['zailasrj@gmail.com', 'yapadesing.contacto@gmail.com'];
  const isOwner = userEmail ? OWNER_EMAILS.includes(userEmail) : false;
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen for unread notifications count
  useEffect(() => {
    if (!userEmail) {
      setUnreadCount(0);
      return;
    }

    // Get current user ID from users collection
    const getUserId = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', userEmail));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const userId = snapshot.docs[0].id;
          
          // Listen for unread notifications
          const notificationsQuery = query(
            collection(db, 'notifications'),
            where('toUserId', '==', userId),
            where('read', '==', false)
          );
          
          const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
            setUnreadCount(snapshot.size);
          });
          
          return unsubscribe;
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    getUserId();
  }, [userEmail]);

  const handleSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        if (!searchTerm.trim()) return;
        
        setIsSearching(true);
        setShowResults(true);
        setSearchResults([]);

        try {
            const term = searchTerm.toLowerCase().replace('@', ''); 
            const usersRef = collection(db, "users");
            
            // Get all users and filter client-side (more flexible)
            const snapshot = await getDocs(usersRef);
            const foundUsers: UserSearchResult[] = [];
            
            snapshot.forEach((doc) => {
                const data = doc.data();
                const displayName = data.displayName || data.email?.split('@')[0] || 'User';
                const username = data.username || data.email?.split('@')[0] || '';
                const email = data.email || '';
                
                // Search in displayName, username, or email
                const matchesDisplayName = displayName.toLowerCase().includes(term);
                const matchesUsername = username.toLowerCase().includes(term);
                const matchesEmail = email.toLowerCase().includes(term);
                
                if (matchesDisplayName || matchesUsername || matchesEmail) {
                    foundUsers.push({
                        uid: doc.id,
                        username: username,
                        displayName: displayName,
                        avatar: data.photoURL || `https://ui-avatars.com/api/?name=${displayName}&background=random`
                    });
                }
            });

            setSearchResults(foundUsers);
        } catch (error) {
            console.error("Error searching users:", error);
        } finally {
            setIsSearching(false);
        }
    }
  };

  const getNavItemClass = (isActive: boolean) => {
      return isActive 
        ? "flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 group border border-transparent bg-white/10 text-white border-white/5 shadow-inner"
        : "flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 group border border-transparent text-gray-400 hover:text-white hover:bg-white/5";
  };

  return (
    <>
      {/* Backdrop Overlay - Only on mobile */}
      <div 
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] md:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => { setShowNotifications(false); onClose(); }}
      />

      {/* Sidebar Container */}
      <aside 
        className={`fixed left-0 top-0 h-screen w-72 md:w-64 bg-black/95 md:bg-black/90 backdrop-blur-xl border-r border-white/5 flex flex-col z-[200] font-sans shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo Header with Close Button */}
        <div className="p-6 flex items-center justify-between">
          {/* Close/Menu Button */}
          <button 
            onClick={() => { setShowNotifications(false); onClose(); }}
            className="w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10"
          >
            <i className="fa-solid fa-times text-xl transition-transform duration-300"></i>
          </button>
          
          {/* Logo */}
          <div 
            className="flex items-center gap-1.5 cursor-pointer flex-1 ml-4" 
            onClick={() => {
              onNavigate('home');
              onClose();
            }}
          >
             <img 
               src="https://res.cloudinary.com/dbfza2zyk/image/upload/v1768852307/ZZPO_lmy5e2.png" 
               alt="poorn Logo" 
               className="w-11 h-11 object-contain"
             />
             <div className="flex flex-col -space-y-1">
                {/* Owner Badge - Blue */}
                {isOwner && (
                    <span className="text-[7px] font-bold uppercase tracking-wider px-1 py-[1px] rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 inline-flex items-center gap-0.5 w-fit">
                        <i className="fa-solid fa-crown text-[6px]"></i>
                        OWNER
                    </span>
                )}
                {/* Admin Badge - Red */}
                {!isOwner && isAdmin && (
                    <span className="text-[7px] font-bold uppercase tracking-wider px-1 py-[1px] rounded bg-red-500/20 text-red-400 border border-red-500/30 inline-flex items-center gap-0.5 w-fit">
                        <i className="fa-solid fa-shield-halved text-[6px]"></i>
                        ADMIN
                    </span>
                )}
                <span className="text-2xl font-extrabold tracking-tighter text-white leading-tight">
                    poorn
                </span>
                {/* User Tier Badge */}
                {userTier !== 'Free' && !isAdmin && !isOwner && (
                    <span className={`text-[9px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-md inline-flex items-center justify-center gap-1 ${
                        userTier === 'VIP' 
                            ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/40 shadow-sm' 
                            : 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-400 border border-yellow-500/40 shadow-sm'
                    }`}>
                        {userTier}
                        <i className={`fa-solid fa-fire text-[8px] animate-pulse ${
                            userTier === 'VIP' ? 'text-orange-500' : 'text-yellow-500'
                        }`}></i>
                    </span>
                )}
             </div>
          </div>
        </div>

        {/* Main Navigation - EXACT RECREATION OF PROVIDED HTML */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto relative">
            
            {/* Search Bar Container */}
            <div className="mb-4 mt-2 px-1 relative z-50" ref={searchRef}>
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <i className={`fa-solid ${isSearching ? 'fa-circle-notch fa-spin' : 'fa-magnifying-glass'} text-gray-500 group-focus-within:text-accent transition-colors text-xs`}></i>
                    </div>
                    <input 
                        placeholder="Search users..." 
                        className="w-full bg-[#151515] border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent/50 focus:bg-white/5 transition-all shadow-inner" 
                        type="text" 
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            if(e.target.value === '') setShowResults(false);
                        }}
                        onKeyDown={handleSearch}
                        onFocus={() => { if(searchResults.length > 0) setShowResults(true); }}
                    />
                </div>
                {/* Search Results Dropdown */}
                {showResults && (
                    <div className="absolute top-full left-1 right-1 mt-2 bg-[#151515] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-[fadeIn_0.1s_ease-out] z-[100]">
                        {searchResults.length > 0 ? (
                            <div className="max-h-60 overflow-y-auto">
                                {searchResults.map(user => (
                                    <div 
                                        key={user.uid} 
                                        className="px-4 py-3 hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-colors border-b border-white/5 last:border-0"
                                        onClick={() => {
                                            onViewProfile(user.uid);
                                            setSearchTerm('');
                                            setShowResults(false);
                                            if (window.innerWidth < 768) onClose();
                                        }}
                                    >
                                        <img src={user.avatar} alt={user.username} className="w-8 h-8 rounded-full object-cover border border-white/10" />
                                        <div className="overflow-hidden">
                                            <p className="text-xs font-bold text-white truncate">{user.displayName}</p>
                                            <p className="text-[10px] text-gray-500 truncate">@{user.username}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-4 text-center">
                                <p className="text-xs text-gray-500">
                                    {isSearching ? 'Searching...' : 'No users found'}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Navigation Items */}
            {!isGlobalBanned && (
                <>
                    {/* Notifications Button - Moved above Create */}
                    <button
                        onClick={(e) => { e.preventDefault(); setShowNotifications(!showNotifications); }}
                        className={`w-full ${getNavItemClass(false)} relative`}
                    >
                        <span className="w-6 text-center mr-3 text-lg opacity-80 group-hover:opacity-100 transition-opacity relative">
                            <i className="fa-regular fa-bell"></i>
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </span>
                        Notifications
                        <i className={`fa-solid fa-chevron-${showNotifications ? 'up' : 'down'} ml-auto text-xs text-gray-500`}></i>
                    </button>

                    {/* Notifications Panel (Collapsible) */}
                    {showNotifications && (
                        <div className="ml-2 mr-1 mb-2 rounded-xl border border-white/10 bg-[#0A0A0A] overflow-hidden animate-[fadeIn_0.2s_ease-out] max-h-[400px]">
                            <NotificationsPanel 
                                onVideoClick={(videoId) => {
                                    // Handle video click - navigate to video
                                    console.log('Navigate to video:', videoId);
                                    setShowNotifications(false);
                                    onClose();
                                }}
                                onProfileClick={(userId) => {
                                    onViewProfile(userId);
                                    setShowNotifications(false);
                                    if (window.innerWidth < 768) onClose();
                                }}
                            />
                        </div>
                    )}

                    <a 
                        href="#" 
                        onClick={(e) => { 
                            e.preventDefault(); 
                            setShowNotifications(false); // Close notifications
                            if (!userEmail && onLogin) {
                                onLogin();
                                onClose();
                            } else {
                                onNavigate('create'); 
                                onClose();
                            }
                        }}
                        className={getNavItemClass(currentView === 'create')}
                    >
                        <span className="w-6 text-center mr-3 text-lg opacity-80 group-hover:opacity-100 transition-opacity">
                            <i className="fa-regular fa-square-plus"></i>
                        </span>
                        Create
                    </a>

                    <a 
                        href="#" 
                        onClick={(e) => { e.preventDefault(); setShowNotifications(false); onNavigate('home'); onClose(); }}
                        className={getNavItemClass(currentView === 'home')}
                    >
                        <span className="w-6 text-center mr-3 text-lg opacity-80 group-hover:opacity-100 transition-opacity">
                            <i className="fa-regular fa-compass"></i>
                        </span>
                        Explore
                    </a>

                    <a 
                        href="#" 
                        onClick={(e) => { e.preventDefault(); setShowNotifications(false); onNavigate('chat'); onClose(); }}
                        className={getNavItemClass(currentView === 'chat')}
                    >
                        <span className="w-6 text-center mr-3 text-lg opacity-80 group-hover:opacity-100 transition-opacity">
                            <i className="fa-regular fa-comment-dots"></i>
                        </span>
                        Chat
                    </a>

                    <a 
                        href="#" 
                        onClick={(e) => { 
                            e.preventDefault(); 
                            setShowNotifications(false); // Close notifications
                            if (!userEmail && onLogin) {
                                onLogin();
                                onClose();
                            } else {
                                onNavigate('feed'); 
                                onClose();
                            }
                        }}
                        className={getNavItemClass(currentView === 'feed')}
                    >
                        <span className="w-6 text-center mr-3 text-lg opacity-80 group-hover:opacity-100 transition-opacity">
                            <i className="fa-solid fa-play"></i>
                        </span>
                        Z Tok
                    </a>

                    <a 
                        href="#" 
                        onClick={(e) => { 
                            e.preventDefault(); 
                            setShowNotifications(false); // Close notifications
                            if (!userEmail && onLogin) {
                                onLogin();
                                onClose();
                            } else {
                                onNavigate('community'); 
                                onClose();
                            }
                        }}
                        className={getNavItemClass(currentView === 'community')}
                    >
                        <span className="w-6 text-center mr-3 text-lg opacity-80 group-hover:opacity-100 transition-opacity">
                            <i className="fa-solid fa-user-group"></i>
                        </span>
                        Community
                    </a>
                </>
            )}

            {/* Support Chat - Only visible for banned users */}
            {isGlobalBanned && (
                <a 
                    href="#" 
                    onClick={(e) => { 
                        e.preventDefault(); 
                        setShowNotifications(false); // Close notifications
                        onNavigate('chat'); 
                        onClose();
                    }}
                    className="flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 group border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                >
                    <span className="w-6 text-center mr-3 text-lg opacity-80 group-hover:opacity-100 transition-opacity">
                        <i className="fa-solid fa-life-ring"></i>
                    </span>
                    Support Chat
                    <span className="ml-auto text-xs bg-yellow-500/20 px-2 py-0.5 rounded-full border border-yellow-500/30">
                        Unban Request
                    </span>
                </a>
            )}

            {isAdmin && (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('admin');
                    onClose();
                  }}
                  className={getNavItemClass(currentView === 'admin')}
                >
                  <span className="w-6 text-center mr-3 text-lg opacity-80 group-hover:opacity-100 transition-opacity">
                      <i className="fa-solid fa-shield-halved"></i>
                  </span>
                  Admin Panel
                </a>
            )}

            {/* Upgrade Button */}
            {!isAdmin && userTier !== 'VIP' && (
                <div className="mt-6 px-2">
                    <button 
                        onClick={(e) => {
                            e.preventDefault();
                            onUpgrade?.();
                            onClose();
                        }}
                        className="w-full bg-gradient-to-r from-purple-700 to-accent hover:from-purple-600 hover:to-purple-400 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/20 border border-white/10 hover:shadow-purple-500/20 tracking-wide text-sm"
                    >
                        <i className="fa-regular fa-gem"></i>
                        UPGRADE
                    </button>
                </div>
            )}
             
            {!isAdmin && userTier === 'VIP' && (
                 <div className="mt-6 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                        <i className="fa-solid fa-crown"></i>
                     </div>
                     <div>
                         <p className="text-xs font-bold text-amber-400">VIP Status</p>
                         <p className="text-[10px] text-gray-400">All Features Unlocked</p>
                     </div>
                 </div>
            )}
        </nav>

        {/* Bottom Navigation */}
        <div className="px-4 pb-4 pt-2 space-y-1 border-t border-white/5">
          {BOTTOM_NAV_ITEMS.map((item, index) => {
            const isItemActive = currentView === 'profile' && item.label === 'Profile';
            
            return (
              <a
                key={index}
                href={item.link || "#"}
                target={item.link ? "_blank" : undefined}
                rel={item.link ? "noopener noreferrer" : undefined}
                onClick={(e) => {
                  if (item.link) { onClose(); return; }
                  e.preventDefault();
                  if (item.label === 'Profile') onNavigate('profile');
                  onClose();
                }}
                className={`flex items-center px-4 py-3 text-sm font-semibold rounded-lg transition-colors ${
                   isItemActive 
                   ? 'bg-white/10 text-white' 
                   : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                 <span className="w-6 text-center mr-3 text-lg">
                    <i className={`${item.iconClass}`}></i>
                </span>
                {item.label}
              </a>
            );
          })}
          
          <div className="px-4 mt-4 text-[10px] text-gray-600 leading-relaxed">
            <div className="flex flex-wrap gap-2 mb-2">
              <a href="#" className="hover:text-gray-400 transition-colors">Terms</a>
              <span className="opacity-40">•</span>
              <a href="#" className="hover:text-gray-400 transition-colors">Privacy</a>
              <span className="opacity-40">•</span>
              <a href="#" className="hover:text-gray-400 transition-colors">Cookies</a>
            </div>
            <p className="opacity-40">© 2026 POORN INC.</p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;