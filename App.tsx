import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, getDoc, setDoc, serverTimestamp, getDocs, deleteDoc, arrayUnion, addDoc, updateDoc, increment } from 'firebase/firestore';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Filters from './components/Filters';
import CharacterCard from './components/CharacterCard';
import LoginModal from './components/LoginModal';
import UploadModal from './components/UploadModal';
import ProfileView from './components/ProfileView';
import AdminPanel from './components/AdminPanel';
import ChatView from './components/ChatView';
import FeedView from './components/FeedView';
import CommunityView from './components/CommunityView';
import CreateView from './components/CreateView';
import VideoPlayerModal from './components/VideoPlayerModal';
import UpgradeModal from './components/UpgradeModal';
import PublicProfileModal from './components/PublicProfileModal';
import AgeGate from './components/AgeGate';
import Toast from './components/Toast';
import AdBanner from './components/AdBanner';
import StickyMobileAd from './components/StickyMobileAd';
import { CHARACTERS } from './constants';
import { Character } from './types';
import { AD_CONFIG, shouldShowAds } from './adConfig';

export type UserTier = 'Free' | 'Premium' | 'VIP';

const App: React.FC = () => {
  const [isAgeVerified, setIsAgeVerified] = useState<boolean>(false);

  // App States
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('Welcome Back');
  const [currentView, setCurrentView] = useState<'home' | 'profile' | 'admin' | 'chat' | 'feed' | 'community' | 'create'>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Public Profile State
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [chatTargetId, setChatTargetId] = useState<string | null>(null);
  
  // Toast & Error State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [dbError, setDbError] = useState<{title: string, msg: string} | null>(null);

  // Data State
  const [videos, setVideos] = useState<Character[]>(CHARACTERS);
  const [selectedVideo, setSelectedVideo] = useState<Character | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGender, setSelectedGender] = useState('Any');
  const [selectedStyle, setSelectedStyle] = useState('Any');
  const [selectedAge, setSelectedAge] = useState('Any');
  const [selectedSort, setSelectedSort] = useState('Popular · Month');
  const [selectedTags, setSelectedTags] = useState<string[]>(['All']);

  // Auth & Admin State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [mockUser, setMockUser] = useState<any | null>(null); 
  const [adminEmails, setAdminEmails] = useState<string[]>([]);  // Start empty, will be loaded from Firebase
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Ban State
  const [isGlobalBanned, setIsGlobalBanned] = useState(false);

  // Modal States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'success';
  } | null>(null);
  
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptModalConfig, setPromptModalConfig] = useState<{
    title: string;
    message: string;
    placeholder: string;
    onConfirm: (value: string) => void;
  } | null>(null);
  const [promptValue, setPromptValue] = useState('');

  const [userTier, setUserTier] = useState<UserTier>('Free');
  const [isTierLoaded, setIsTierLoaded] = useState(false);
  const [isUpgradeBannerDismissed, setIsUpgradeBannerDismissed] = useState(false);
  const [showDismissBannerModal, setShowDismissBannerModal] = useState(false);
  const [showGuestLogoutModal, setShowGuestLogoutModal] = useState(false);
  const [showEggplantGif, setShowEggplantGif] = useState(true);
  const [showPeachGif, setShowPeachGif] = useState(false);

  // State for beta banner
  const [showBetaBanner, setShowBetaBanner] = useState(() => {
    return localStorage.getItem('beta_banner_dismissed') !== 'true';
  });

  const handleDismissBanner = () => {
    setShowBetaBanner(false);
    localStorage.setItem('beta_banner_dismissed', 'true');
  };

  const handleDismissUpgradeBanner = () => {
    setShowDismissBannerModal(true);
  };

  const confirmDismissUpgradeBanner = () => {
    setIsUpgradeBannerDismissed(true);
    setShowDismissBannerModal(false);
    if (user?.uid) {
      // Save dismissal in localStorage with user ID
      localStorage.setItem(`upgrade_banner_dismissed_${user.uid}`, 'true');
    } else {
      // For non-logged users, use a generic key
      localStorage.setItem('upgrade_banner_dismissed_guest', 'true');
    }
    setToast({ message: 'Banner oculto hasta el próximo login', type: 'info' });
  };

  const user = firebaseUser || mockUser;

  // Helper functions for modals
  const showConfirm = (config: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'success';
  }) => {
    setConfirmModalConfig({
      ...config,
      confirmText: config.confirmText || 'Confirm',
      cancelText: config.cancelText || 'Cancel'
    });
    setShowConfirmModal(true);
  };

  const showPrompt = (config: {
    title: string;
    message: string;
    placeholder: string;
    onConfirm: (value: string) => void;
  }) => {
    setPromptModalConfig(config);
    setPromptValue('');
    setShowPromptModal(true);
  };

  // Filter handlers
  const handleTagToggle = (tag: string) => {
    if (tag === 'All') {
      setSelectedTags(['All']);
    } else {
      setSelectedTags(prev => {
        const newTags = prev.filter(t => t !== 'All');
        if (newTags.includes(tag)) {
          const filtered = newTags.filter(t => t !== tag);
          return filtered.length === 0 ? ['All'] : filtered;
        } else {
          return [...newTags, tag];
        }
      });
    }
  };

  useEffect(() => {
    const verified = localStorage.getItem('poorn_age_verified');
    if (verified === 'true') {
      setIsAgeVerified(true);
    }
  }, []);

  // Check if upgrade banner was dismissed for this user
  useEffect(() => {
    if (user?.uid) {
      const dismissed = localStorage.getItem(`upgrade_banner_dismissed_${user.uid}`);
      setIsUpgradeBannerDismissed(dismissed === 'true');
    } else {
      // If no user, always show banner (reset dismissed state)
      setIsUpgradeBannerDismissed(false);
    }
  }, [user?.uid]);

  // Eggplant and Peach GIF animation cycle - Continuous loop
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const toggleGifs = (showEggplant: boolean) => {
      setShowEggplantGif(showEggplant);
      setShowPeachGif(!showEggplant);
      
      // Schedule next toggle in 5 seconds
      timeoutId = setTimeout(() => toggleGifs(!showEggplant), 5000);
    };
    
    // Start with eggplant
    toggleGifs(true);

    return () => clearTimeout(timeoutId);
  }, []);

  const handleAgeVerify = () => {
    localStorage.setItem('poorn_age_verified', 'true');
    setIsAgeVerified(true);
  };

  // --- ONLINE STATUS & GLOBAL BAN CHECK & IP BAN CHECK ---
  useEffect(() => {
    if (user?.uid) {
        const userRef = doc(db, "users", user.uid);
        
        // Load user data including tier
        const loadUserData = async () => {
            try {
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    
                    // Load user tier if exists
                    if (userData.tier && (userData.tier === 'Premium' || userData.tier === 'VIP')) {
                        setUserTier(userData.tier as UserTier);
                        console.log(`✅ Loaded user tier: ${userData.tier}`);
                    }
                    
                    // Check if user is banned
                    if (userData.banned) {
                        setIsGlobalBanned(true);
                        return;
                    }
                }
            } catch (error) {
                console.error('❌ Error loading user data:', error);
            }
        };
        
        // Check IP ban first
        const checkIPBan = async () => {
            try {
                const ipResponse = await fetch('https://api.ipify.org?format=json');
                const ipData = await ipResponse.json();
                const userIP = ipData.ip;
                
                // Check if IP is banned
                const bannedIPRef = doc(db, "bannedIPs", userIP);
                const bannedIPSnap = await getDoc(bannedIPRef);
                
                if (bannedIPSnap.exists()) {
                    // IP is banned, ban this user too
                    await setDoc(userRef, { 
                        banned: true,
                        banReason: "IP baneada",
                        bannedAt: serverTimestamp()
                    }, { merge: true });
                    setIsGlobalBanned(true);
                    return;
                }
            } catch (error) {
                console.error("Error checking IP ban:", error);
            }
        };
        
        checkIPBan();
        loadUserData(); // Load initial user data including tier
        
        // Set Online Status immediately
        setDoc(userRef, { 
            isOnline: true, 
            lastSeen: serverTimestamp() 
        }, { merge: true });

        // Listen for Ban Status and Tier
        const unsubscribe = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.banned === true) {
                    setIsGlobalBanned(true);
                } else {
                    setIsGlobalBanned(false);
                }
                
                // Load user tier from database
                if (data.tier) {
                    setUserTier(data.tier as UserTier);
                } else {
                    setUserTier('Free');
                }
                setIsTierLoaded(true);
            } else {
                // User document doesn't exist yet, default to Free
                setUserTier('Free');
                setIsTierLoaded(true);
            }
        });

        // Cleanup: Set offline when unmounting (switching user/closing)
        return () => {
            unsubscribe();
            // Best effort to set offline
            setDoc(userRef, { isOnline: false }, { merge: true }).catch(() => {});
        };
    } else {
        setIsGlobalBanned(false);
        setUserTier('Free');
        setIsTierLoaded(true);
    }
  }, [user?.uid]);

  // Handle window close for offline status
  useEffect(() => {
    const handleBeforeUnload = () => {
        if (user?.uid) {
            // Note: This is synchronous and might not always fire in modern browsers
            // but it's the standard way without Beacon API complexity
            // Since we can't reliably await firestore here, we rely on the component unmount effect primarily
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentSuccess = params.get('payment_success');
    const plan = params.get('plan');

    if (paymentSuccess === 'true' && plan && user?.uid) {
      if (plan === 'Premium' || plan === 'VIP') {
        // Actualizar tier en la sesión actual
        setUserTier(plan as UserTier);
        
        // NUEVO: Guardar tier en Firebase para persistencia
        const updateUserTier = async () => {
          try {
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
              tier: plan,
              tierUpdatedAt: serverTimestamp(),
              subscriptionActive: true
            });
            console.log(`✅ User tier updated to ${plan} in database`);
          } catch (error) {
            console.error('❌ Error updating user tier:', error);
          }
        };
        
        updateUserTier();
        setToast({ message: `Upgrade successful! Welcome to ${plan} tier.`, type: 'success' });
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [user?.uid]);

  // Listen for video open events from VideoPlayerModal recommendations
  useEffect(() => {
    const handleOpenVideo = (event: any) => {
      const video = event.detail;
      if (video) {
        setSelectedVideo(video);
      }
    };

    window.addEventListener('openVideo', handleOpenVideo);
    return () => window.removeEventListener('openVideo', handleOpenVideo);
  }, []);

  // Listen for chat open events from profile modals
  useEffect(() => {
    const handleOpenChat = (event: any) => {
      const { userId, userName } = event.detail;
      if (userId) {
        console.log('Opening chat with user:', userId);
        setSelectedVideo(null); // Close video modal
        setChatTargetId(userId);
        setCurrentView('chat');
        setToast({ 
          message: `Opening private chat with @${userName}`, 
          type: 'info' 
        });
      }
    };

    window.addEventListener('openChat', handleOpenChat);
    return () => window.removeEventListener('openChat', handleOpenChat);
  }, []);

  useEffect(() => {
    setDbError(null);
    const q = query(
        collection(db, "posts"), 
        orderBy("timestamp", "desc")
    );
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
        const dbVideos = await Promise.all(
            snapshot.docs
                .filter(doc => {
                    const data = doc.data();
                    // Only filter out community IMAGES, allow all videos
                    return !(data.source === 'community' && data.mediaType === 'image');
                })
                .map(async (docSnapshot) => {
                    const data = docSnapshot.data();
                    
                    // Migrate videos without tags to "General" category
                    if (!data.tags || data.tags.length === 0) {
                        try {
                            await updateDoc(doc(db, "posts", docSnapshot.id), {
                                tags: ['general']
                            });
                            console.log(`✅ Migrated video ${docSnapshot.id} to General category`);
                        } catch (error) {
                            console.error(`❌ Error migrating video ${docSnapshot.id}:`, error);
                        }
                    }
                    
                    // Count existing comments if commentCount doesn't exist
                    let commentCount = data.commentCount || 0;
                    if (!data.commentCount) {
                        try {
                            const commentsSnapshot = await getDocs(
                                collection(db, "posts", docSnapshot.id, "comments")
                            );
                            commentCount = commentsSnapshot.size;
                            
                            // Update the document with the actual count
                            if (commentCount > 0) {
                                await updateDoc(doc(db, "posts", docSnapshot.id), {
                                    commentCount: commentCount
                                });
                            }
                        } catch (error) {
                            console.error("Error counting comments:", error);
                        }
                    }
                    
                    return {
                        id: docSnapshot.id,
                        name: data.title || (data.content ? (data.content.length > 50 ? data.content.substring(0, 50) + "..." : data.content) : "Untitled"),
                        description: data.description || data.content || undefined,
                        duration: data.mediaType === 'video' ? 'VID' : 'IMG',
                        image: data.mediaType === 'video' 
                            ? (data.mediaUrl.replace(/\.[^/.]+$/, ".jpg")) 
                            : data.mediaUrl,
                        videoUrl: data.mediaUrl,
                        likes: (data.likes?.length || 0).toString(),
                        views: (data.views || 0).toString(),
                        comments: commentCount,
                        category: data.tags?.[0] || 'general',
                        tags: data.tags || ['general'],
                        // Map author info
                        authorId: data.userId, // Critical for subscriptions
                        authorName: data.user?.name,
                        authorAvatar: data.user?.avatar,
                        authorHandle: data.user?.handle
                    } as Character;
                })
        );
        
        if (dbVideos.length > 0) {
            setVideos(dbVideos);
            setIsOfflineMode(false);
        } else {
             if (CHARACTERS.length > 0) setVideos(CHARACTERS);
        }
    }, (error) => {
        console.error("Firestore connection error:", error);
        
        if (error.code === 'permission-denied') {
            setDbError({
                title: "Database Permissions Error",
                msg: "Go to Firebase Console > Firestore Database > Rules and set 'allow read: if true;'"
            });
            setIsOfflineMode(true);
        } else if (error.message && error.message.includes('BLOCKED')) {
            setDbError({
                title: "Connection Blocked",
                msg: "An AdBlocker is blocking the database connection. Please disable AdBlock for this site."
            });
            setIsOfflineMode(true);
        } else {
             setDbError({
                title: "Connection Issue",
                msg: "Could not connect to the global feed. Showing local data."
            });
            setIsOfflineMode(true);
        }
        setVideos(CHARACTERS);
    });
    return () => unsubscribe();
  }, []);

  // Load Admin Emails from Firebase with Real-time Listener
  useEffect(() => {
    console.log("=== SETTING UP ADMIN LISTENER ===");
    const adminsRef = doc(db, "platformSettings", "admins");
    
    // Real-time listener
    const unsubscribe = onSnapshot(adminsRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        let adminsList = data.emails || [];
        
        // Always ensure both owners are in the list
        const OWNER_EMAILS = ['zailasrj@gmail.com', 'yapadesing.contacto@gmail.com'];
        OWNER_EMAILS.forEach(ownerEmail => {
          if (!adminsList.includes(ownerEmail)) {
            adminsList = [ownerEmail, ...adminsList];
          }
        });
        
        setAdminEmails(adminsList);
        console.log("✅ Admins updated from Firebase (real-time):", adminsList);
      } else {
        // Initialize with default admins (both owners)
        const defaultAdmins = ['zailasrj@gmail.com', 'yapadesing.contacto@gmail.com'];
        console.log("⚠️ No admin document found, creating with defaults:", defaultAdmins);
        try {
          await setDoc(adminsRef, {
            emails: defaultAdmins,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp()
          });
          setAdminEmails(defaultAdmins);
          console.log("✅ Admins initialized in Firebase");
        } catch (error) {
          console.error("❌ Error initializing admins:", error);
        }
      }
    }, (error) => {
      console.error("❌ Error in admin listener:", error);
    });
    
    console.log("===================================");
    
    return () => {
      console.log("🔌 Unsubscribing from admin listener");
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isInitialLoad = true;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setFirebaseUser(currentUser);
      if (currentUser && !isInitialLoad) {
         const name = currentUser.displayName || currentUser.email?.split('@')[0] || 'Dreamer';
         setToast({ message: `Successfully logged in as ${name}`, type: 'success' });
      }
      isInitialLoad = false;
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const userEmail = user.email || '';
      const isUserAdmin = adminEmails.includes(userEmail);
      setIsAdmin(isUserAdmin);
      
      // DETAILED DEBUG LOG
      console.log("=== ADMIN CHECK DEBUG ===");
      console.log("User Email:", userEmail);
      console.log("User Email Length:", userEmail.length);
      console.log("Admin Emails Array:", adminEmails);
      console.log("Is Admin Result:", isUserAdmin);
      console.log("Exact Match Check:");
      adminEmails.forEach((adminEmail, index) => {
        console.log(`  [${index}] "${adminEmail}" === "${userEmail}": ${adminEmail === userEmail}`);
        console.log(`      Length: ${adminEmail.length} vs ${userEmail.length}`);
      });
      console.log("========================");
    } else {
      setIsAdmin(false);
      setUserTier('Free');
      setIsTierLoaded(true);
      if (currentView === 'admin' || currentView === 'chat') setCurrentView('home');
    }
  }, [user, adminEmails, currentView]);

  const openLogin = (title = 'Welcome Back') => {
    setModalTitle(title);
    setIsLoginOpen(true);
  };

  const handleLogout = async () => {
    // Check if it's a guest/demo user
    if (mockUser) {
      setShowGuestLogoutModal(true);
      return;
    }

    try {
      if (user?.uid) {
         await setDoc(doc(db, "users", user.uid), { isOnline: false }, { merge: true });
      }

      await signOut(auth);
      setToast({ message: 'Logged out successfully', type: 'info' });
      setCurrentView('home');
    } catch (error) {
      console.error("Error signing out: ", error);
      setToast({ message: 'Error signing out', type: 'error' });
    }
  };

  const confirmGuestLogout = async () => {
    try {
      setMockUser(null);
      setShowGuestLogoutModal(false);
      setToast({ message: 'Logged out from guest mode', type: 'info' });
      setCurrentView('home');
    } catch (error) {
      console.error("Error signing out: ", error);
      setToast({ message: 'Error signing out', type: 'error' });
    }
  };

  const handleDemoLogin = () => {
    setMockUser({
      uid: 'demo-user-123',
      email: 'demo@poorn.ai',
      displayName: 'Demo Dreamer',
      photoURL: 'https://i.pravatar.cc/150?u=demo',
      isMock: true
    });
    setIsLoginOpen(false);
    setToast({ message: 'Welcome to Demo Mode!', type: 'success' });
  };

  const navigateTo = (view: 'home' | 'profile' | 'admin' | 'chat' | 'feed' | 'community' | 'create') => {
    if (view === 'chat' && !user) {
        openLogin('Login to Chat');
        return;
    }
    setSelectedVideo(null); // Close video if open
    setCurrentView(view);
    setIsSidebarOpen(false);
    window.scrollTo(0, 0);
  };

  const handleLogoClick = () => {
    // Cerrar todos los modales y vistas que existen
    setSelectedVideo(null);
    setIsUpgradeOpen(false);
    setIsUploadOpen(false);
    setIsLoginOpen(false);
    setIsSidebarOpen(false);
    
    // Navegar a Explore (home)
    setCurrentView('home');
    window.scrollTo(0, 0);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleVideoUpload = (newVideo: Character) => {
    setToast({ message: 'Post uploaded successfully!', type: 'success' });
    if (isOfflineMode) setVideos(prev => [newVideo, ...prev]);
    if (currentView !== 'home') setCurrentView('home');
  };

  const handleAddAdmin = async (email: string) => {
    console.log("🔧 Adding admin:", email);
    
    if (!adminEmails.includes(email)) {
      const newAdminsList = [...adminEmails, email];
      
      // Save to Firebase FIRST
      try {
        const adminsRef = doc(db, "platformSettings", "admins");
        await setDoc(adminsRef, {
          emails: newAdminsList,
          updatedAt: serverTimestamp(),
          updatedBy: user?.email || 'system'
        });
        
        console.log("✅ Admin added to Firebase successfully");
        console.log("New admins list:", newAdminsList);
        
        // The real-time listener will update the state automatically
        setToast({ message: `${email} added as admin successfully`, type: 'success' });
      } catch (error) {
        console.error("❌ Error adding admin:", error);
        setToast({ message: 'Error adding admin to database', type: 'error' });
      }
    } else {
      console.log("⚠️ User is already an admin");
      setToast({ message: 'User is already an admin', type: 'info' });
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    console.log("🔧 Removing admin:", email);
    
    // Prevent removing owners
    const OWNER_EMAILS = ['zailasrj@gmail.com', 'yapadesing.contacto@gmail.com'];
    if (OWNER_EMAILS.includes(email)) {
      console.log("❌ Cannot remove owner");
      setToast({ message: 'Cannot remove the owner', type: 'error' });
      return;
    }
    
    const newAdminsList = adminEmails.filter(e => e !== email);
    
    // Save to Firebase FIRST
    try {
      const adminsRef = doc(db, "platformSettings", "admins");
      await setDoc(adminsRef, {
        emails: newAdminsList,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'system'
      });
      
      console.log("✅ Admin removed from Firebase successfully");
      console.log("New admins list:", newAdminsList);
      
      // The real-time listener will update the state automatically
      setToast({ message: 'Admin removed successfully', type: 'info' });
    } catch (error) {
      console.error("❌ Error removing admin:", error);
      setToast({ message: 'Error removing admin from database', type: 'error' });
    }
  };

  const handleVideoClick = async (video: Character) => {
    // Open video
    setSelectedVideo(video);
    
    // Increment view count in Firebase (only for non-local videos)
    if (!video.id.startsWith('local_')) {
      try {
        const videoRef = doc(db, "posts", video.id);
        await updateDoc(videoRef, {
          views: increment(1)
        });
        console.log(`✅ View counted for video: ${video.id}`);
      } catch (error) {
        console.error("Error incrementing view count:", error);
      }
    }
    
    // Save to watch history (only for logged-in users)
    if (user?.uid && !video.id.startsWith('local_')) {
      try {
        const historyRef = doc(db, "users", user.uid, "watchHistory", video.id);
        await setDoc(historyRef, {
          videoId: video.id,
          videoName: video.name,
          videoImage: video.image,
          videoUrl: video.videoUrl,
          watchedAt: serverTimestamp()
        });
        console.log(`✅ Added to watch history: ${video.id}`);
      } catch (error) {
        console.error("Error saving to watch history:", error);
      }
    }
  };

  const handleDeleteVideo = async (id: string) => {
    showConfirm({
      title: 'Delete Video',
      message: 'Are you sure you want to delete this video? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        try {
          // Delete from Firebase
          await deleteDoc(doc(db, "posts", id));
          setToast({ message: 'Video deleted successfully', type: 'success' });
        } catch (error) {
          console.error('Error deleting video:', error);
          // Still remove from local state even if Firebase fails
          setVideos(prev => prev.filter(v => v.id !== id));
          setToast({ message: 'Video deleted locally', type: 'info' });
        }
      }
    });
  };

  const handleReportVideo = async (id: string) => {
    if (!user) return openLogin('Login to report content');
    
    showPrompt({
      title: 'Report Video',
      message: 'Please provide a reason for reporting this video:',
      placeholder: 'Enter reason...',
      onConfirm: async (reason: string) => {
        if (!reason || reason.trim() === '') {
          return;
        }

        try {
          // Find the video to get details
          const video = videos.find(v => v.id === id);
          
          await addDoc(collection(db, "reports"), {
            type: 'Video',
            content: video?.name || 'Video content',
            videoId: id,
            reason: reason.trim(),
            reporter: user.email || user.uid,
            reporterId: user.uid,
            reportedUser: video?.authorName || video?.creator || 'Unknown',
            reportedUserId: video?.authorId,
            reportedUserEmail: video?.authorHandle || 'Unknown',
            status: 'Pending',
            createdAt: serverTimestamp()
          });
          
          setToast({ message: 'Report submitted successfully', type: 'success' });
        } catch (error) {
          console.error("Error submitting report:", error);
          setToast({ message: 'Failed to submit report', type: 'error' });
        }
      }
    });
  };

  const handleCopyLink = (id: string) => {
    const link = `https://zpoorn.com/video/${id}`;
    navigator.clipboard.writeText(link).then(() => {
      setToast({ message: 'Link copied to clipboard!', type: 'success' });
    });
  };

  const handleNotInterested = async (id: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, "users", user.uid), {
        notInterested: arrayUnion(id)
      }, { merge: true });
      setToast({ message: "We'll show you less content like this", type: 'info' });
    } catch (error) {
      console.error('Error marking not interested:', error);
    }
  };

  const handleHideVideo = async (id: string) => {
    if (!isAdmin) return;
    try {
      await setDoc(doc(db, "posts", id), {
        isHidden: true
      }, { merge: true });
      setToast({ message: 'Video hidden successfully', type: 'success' });
    } catch (error) {
      console.error('Error hiding video:', error);
    }
  };

  const handleViewProfile = (userId: string) => {
      setViewingProfileId(userId);
  };

  const handleStartChat = () => {
    if (viewingProfileId) {
      setChatTargetId(viewingProfileId); // Set the target user ID for the chat
      setViewingProfileId(null); // Close the modal
      navigateTo('chat'); // Go to chat view
    }
  };

  const handleToggleFavorite = async (videoId: string) => {
    console.log('🔧 handleToggleFavorite called with videoId:', videoId);
    console.log('🔧 Current user:', user?.email);
    
    if (!user) {
      openLogin('Login to save favorites');
      return;
    }

    try {
      const favoriteRef = doc(db, "users", user.uid, "favorites", videoId);
      const favoriteSnap = await getDoc(favoriteRef);

      if (favoriteSnap.exists()) {
        // Remove from favorites
        await deleteDoc(favoriteRef);
        console.log('✅ Removed from favorites:', videoId);
        setToast({ message: 'Removed from favorites', type: 'info' });
      } else {
        // Add to favorites
        const video = videos.find(v => v.id === videoId);
        if (video) {
          await setDoc(favoriteRef, {
            videoId: video.id,
            videoName: video.name,
            videoImage: video.image,
            videoUrl: video.videoUrl,
            savedAt: serverTimestamp()
          });
          console.log('✅ Added to favorites:', videoId);
          setToast({ message: 'Added to favorites!', type: 'success' });
        } else {
          console.log('❌ Video not found in videos array');
        }
      }
    } catch (error) {
      console.error("❌ Error toggling favorite:", error);
      setToast({ message: 'Error updating favorites', type: 'error' });
    }
  };

  // Filter videos based on all criteria
  const filteredVideos = videos.filter(video => {
    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = (
        video.name.toLowerCase().includes(query) ||
        video.description?.toLowerCase().includes(query) ||
        video.category?.toLowerCase().includes(query) ||
        video.authorName?.toLowerCase().includes(query)
      );
      if (!matchesSearch) return false;
    }

    // Gender filter
    if (selectedGender !== 'Any') {
      // Assuming video has a gender property or we can infer from tags/category
      const videoGender = video.gender || 'Female'; // Default to Female if not specified
      if (videoGender !== selectedGender) return false;
    }

    // Style filter
    if (selectedStyle !== 'Any') {
      // Assuming video has a style property or we can infer from tags/category
      const videoStyle = video.style || 'Realistic'; // Default to Realistic if not specified
      if (videoStyle !== selectedStyle) return false;
    }

    // Age filter
    if (selectedAge !== 'Any') {
      // Assuming video has an age property or we can infer from tags/category
      const videoAge = video.age || '18-25'; // Default age range if not specified
      if (videoAge !== selectedAge) return false;
    }

    // Tags filter
    if (!selectedTags.includes('All') && selectedTags.length > 0) {
      const videoTags = video.tags || [video.category || ''];
      const hasMatchingTag = selectedTags.some(tag => 
        videoTags.some(videoTag => 
          videoTag.toLowerCase().includes(tag.toLowerCase()) ||
          tag.toLowerCase().includes(videoTag.toLowerCase())
        )
      );
      if (!hasMatchingTag) return false;
    }

    return true;
  });

  // Sort filtered videos
  const sortedVideos = [...filteredVideos].sort((a, b) => {
    switch (selectedSort) {
      case 'Popular · Week':
        return (b.weeklyViews || 0) - (a.weeklyViews || 0);
      case 'Popular · All Time':
        return (b.totalViews || 0) - (a.totalViews || 0);
      case 'Newest':
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      case 'Oldest':
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      case 'Popular · Month':
      default:
        return (b.monthlyViews || b.totalViews || 0) - (a.monthlyViews || a.totalViews || 0);
    }
  });

  if (!isAgeVerified) {
    return <AgeGate onVerify={handleAgeVerify} />;
  }

  // --- BANNED SCREEN ---
  if (isGlobalBanned) {
      return (
          <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center animate-[fadeIn_0.5s_ease-out]">
              <div className="w-24 h-24 rounded-full bg-red-600/20 flex items-center justify-center mb-6 animate-pulse border border-red-600/50">
                  <i className="fa-solid fa-ban text-5xl text-red-600"></i>
              </div>
              <h1 className="text-4xl font-black text-white mb-2">ACCESS DENIED</h1>
              <p className="text-red-400 font-bold text-lg mb-6 uppercase tracking-wider">Account Permanently Banned</p>
              <div className="bg-[#111] p-6 rounded-xl border border-white/10 max-w-md w-full">
                  <p className="text-gray-400 text-sm mb-4">
                      Your account has been suspended for violating our Community Guidelines. You can no longer access poorn.
                  </p>
                  <p className="text-gray-500 text-xs mb-4">
                      Comunícate a soporte abajo el link del Discord
                  </p>
                  <a 
                      href="https://discord.gg/RaXBWkV8xv" 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold py-3 px-4 rounded-lg transition-colors text-center"
                  >
                      <i className="fa-brands fa-discord mr-2"></i>
                      Unirse al Discord
                  </a>
              </div>
              <button 
                onClick={handleLogout}
                className="mt-8 px-8 py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors"
              >
                  Sign Out
              </button>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-background text-text flex font-sans selection:bg-accent selection:text-white">
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      {/* Dismiss Banner Confirmation Modal */}
      {showDismissBannerModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowDismissBannerModal(false)}></div>
          <div className="relative bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-2xl p-6 md:p-8 max-w-md w-full border border-white/10 shadow-2xl animate-[slideUp_0.3s_ease-out]">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/10 border-2 border-yellow-500/30">
              <i className="fa-solid fa-triangle-exclamation text-3xl text-yellow-500"></i>
            </div>
            <h3 className="text-2xl font-bold text-white text-center mb-3">
              Hide Upgrade Banner?
            </h3>
            <p className="text-gray-400 text-center mb-6 leading-relaxed">
              Are you sure you want to hide this banner? It won't appear again until you log in next time.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDismissBannerModal(false)}
                className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/10 hover:border-white/20"
              >
                Cancel
              </button>
              <button
                onClick={confirmDismissUpgradeBanner}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-500/20"
              >
                Hide Banner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guest Logout Confirmation Modal */}
      {showGuestLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowGuestLogoutModal(false)}></div>
          <div className="relative bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-2xl p-6 md:p-8 max-w-md w-full border border-white/10 shadow-2xl animate-[slideUp_0.3s_ease-out]">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/10 border-2 border-blue-500/30">
              <i className="fa-solid fa-right-from-bracket text-3xl text-blue-500"></i>
            </div>
            <h3 className="text-2xl font-bold text-white text-center mb-3">
              Exit Guest Mode?
            </h3>
            <p className="text-gray-400 text-center mb-6 leading-relaxed">
              Are you sure you want to exit guest mode? You'll need to log in again to access your account.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowGuestLogoutModal(false)}
                className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/10 hover:border-white/20"
              >
                Cancel
              </button>
              <button
                onClick={confirmGuestLogout}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-accent to-accent-hover hover:from-accent-hover hover:to-accent text-white font-bold rounded-xl transition-all shadow-lg shadow-accent/20"
              >
                Exit Guest Mode
              </button>
            </div>
          </div>
        </div>
      )}

      <Sidebar 
        currentView={selectedVideo ? 'video' : currentView} 
        onNavigate={navigateTo} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isAdmin={isAdmin}
        onUpgrade={() => setIsUpgradeOpen(true)}
        userTier={userTier}
        onViewProfile={handleViewProfile}
        userEmail={user?.email}
        onLogin={() => openLogin('Login to continue')}
        isGlobalBanned={isGlobalBanned}
      />

      <main className={`flex-1 relative w-full transition-all duration-300 ease-in-out ${isSidebarOpen ? 'md:ml-64' : 'ml-0'}`}>
        {/* CONFIGURATION ERROR BANNER */}
        {dbError && (
            <div className="bg-red-900/80 border-b border-red-500/50 text-white px-6 py-4 flex items-start gap-4 sticky top-0 z-[100] backdrop-blur-md">
                <i className="fa-solid fa-triangle-exclamation text-xl mt-1 text-red-300"></i>
                <div className="flex-1">
                    <h3 className="font-bold text-red-200">{dbError.title}</h3>
                    <p className="text-sm text-white/90">{dbError.msg}</p>
                </div>
                <button onClick={() => setDbError(null)} className="text-white/50 hover:text-white">
                    <i className="fa-solid fa-xmark"></i>
                </button>
            </div>
        )}

        {/* Header - Hidden in feed view for fullscreen experience */}
        {currentView !== 'feed' && (
          <Header 
            user={user}
            onLoginClick={() => openLogin()} 
            onJoinClick={() => openLogin()} 
            onMenuClick={toggleSidebar}
            onLogout={handleLogout}
            onProfileClick={() => navigateTo('profile')}
            isSidebarOpen={isSidebarOpen}
            currentView={currentView}
            onLogoClick={handleLogoClick}
          />
        )}
        
        <div className="px-4 md:px-8 lg:px-12 pb-20 md:pb-12 max-w-[1600px] mx-auto mt-2 md:mt-0 relative">
          
          {currentView === 'home' && (
            <div className="animate-[fadeIn_0.3s_ease-out]">
              {isTierLoaded && (!user || !isUpgradeBannerDismissed) && userTier !== 'VIP' && userTier !== 'Premium' && (
                <div className="w-full h-36 md:h-48 rounded-2xl overflow-hidden mb-8 md:mb-10 relative group shadow-2xl shadow-black/50 border border-white/5 cursor-pointer" onClick={() => setIsUpgradeOpen(true)}>
                   {user && (
                     <button
                       onClick={(e) => {
                         e.stopPropagation();
                         handleDismissUpgradeBanner();
                       }}
                       className="absolute top-3 right-3 z-10 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-all border border-white/20 hover:border-white/40"
                       title="Cerrar banner"
                     >
                       <i className="fa-solid fa-xmark text-sm"></i>
                     </button>
                   )}
                   <img 
                     src="https://picsum.photos/1200/400?grayscale&blur=2" 
                     alt="Premium Background" 
                     className="w-full h-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-105"
                   />
                   <div className="absolute inset-0 bg-gradient-to-r from-purple-900/60 to-indigo-900/40 flex flex-col items-center justify-center text-center p-4">
                      <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter text-white uppercase drop-shadow-lg leading-none md:leading-tight">
                          <span className="text-4xl md:text-7xl mr-2 md:mr-3 font-extrabold">UPGRADE</span> 
                          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-200 block md:inline text-xl md:text-4xl mt-1 md:mt-0">
                             To Premium
                          </span>
                      </h2>
                   </div>
                </div>
              )}
              {isTierLoaded && (!user || !isUpgradeBannerDismissed) && userTier === 'Premium' && (
                <div className="w-full h-36 md:h-48 rounded-2xl overflow-hidden mb-8 md:mb-10 relative group shadow-2xl shadow-black/50 border border-white/5 cursor-pointer" onClick={() => setIsUpgradeOpen(true)}>
                   {user && (
                     <button
                       onClick={(e) => {
                         e.stopPropagation();
                         handleDismissUpgradeBanner();
                       }}
                       className="absolute top-3 right-3 z-10 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-all border border-white/20 hover:border-white/40"
                       title="Cerrar banner"
                     >
                       <i className="fa-solid fa-xmark text-sm"></i>
                     </button>
                   )}
                   <img 
                     src="https://picsum.photos/1200/400?grayscale&blur=2" 
                     alt="VIP Background" 
                     className="w-full h-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-105"
                   />
                   <div className="absolute inset-0 bg-gradient-to-r from-purple-900/60 to-indigo-900/40 flex flex-col items-center justify-center text-center p-4">
                      <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter text-white uppercase drop-shadow-lg leading-none md:leading-tight">
                          <span className="text-4xl md:text-7xl mr-2 md:mr-3 font-extrabold">UPGRADE</span> 
                          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-200 block md:inline text-xl md:text-4xl mt-1 md:mt-0">
                             To VIP
                          </span>
                      </h2>
                   </div>
                </div>
              )}

              <div className="text-center mb-8 md:mb-10 relative">
                <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-2 flex items-center justify-center gap-3">
                  {/* Animated Peach GIF - Left side */}
                  <img 
                    src="https://custom-doodle.com/wp-content/uploads/doodle/peach-emoji/peach-emoji-doodle.gif" 
                    alt="🍑"
                    className={`w-10 h-10 md:w-12 md:h-12 transition-all duration-500 ${
                      showPeachGif ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                    }`}
                  />
                  Explore the Best <span className="text-accent relative inline-block">
                    Videos
                    <svg className="absolute w-full h-2 md:h-3 -bottom-1 left-0 text-accent opacity-40" viewBox="0 0 100 10" preserveAspectRatio="none">
                      <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="3" fill="none" />
                    </svg>
                  </span>
                  {/* Animated Eggplant GIF - Right side */}
                  <img 
                    src="/gifs/eggplant gif.gif" 
                    alt="🍆"
                    className={`w-8 h-8 md:w-10 md:h-10 transition-all duration-500 ${
                      showEggplantGif ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                    }`}
                  />
                </h1>
                <p className="text-gray-400 text-sm md:text-lg font-medium px-4">Discover amazing content here on Zpoorn.</p>
              </div>

              <Filters 
                searchQuery={searchQuery} 
                onSearchChange={setSearchQuery}
                selectedGender={selectedGender}
                onGenderChange={setSelectedGender}
                selectedStyle={selectedStyle}
                onStyleChange={setSelectedStyle}
                selectedAge={selectedAge}
                onAgeChange={setSelectedAge}
                selectedSort={selectedSort}
                onSortChange={setSelectedSort}
                selectedTags={selectedTags}
                onTagToggle={handleTagToggle}
              />

              {/* Native Ads - Horizontal Layout */}
              {shouldShowAds(userTier, isAdmin) && (
                <div className="my-6 w-full flex flex-col md:flex-row gap-4 justify-center items-center">
                  <AdBanner 
                    zoneId={AD_CONFIG.ZONES.NATIVE_AD} 
                    format="native" 
                    width={360} 
                    height={140}
                    className="w-full max-w-[360px]"
                  />
                  
                  {/* Second Ad (only in aggressive mode) */}
                  {AD_CONFIG.AGGRESSIVE_MODE && (
                    <AdBanner 
                      zoneId={AD_CONFIG.ZONES.INLINE_NATIVE} 
                      format="native" 
                      width={360} 
                      height={140}
                      className="w-full max-w-[360px]"
                    />
                  )}
                </div>
              )}

              {sortedVideos.length === 0 ? (
                searchQuery ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-white/5 rounded-3xl bg-white/5">
                    <div className="bg-white/10 p-4 rounded-full mb-4">
                      <i className="fa-solid fa-magnifying-glass text-3xl text-gray-500"></i>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">No results found</h3>
                    <p className="text-gray-400 text-sm max-w-xs mx-auto">Try searching with different keywords</p>
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="mt-4 px-6 py-2 bg-accent hover:bg-accent-hover text-white font-bold rounded-lg transition-colors"
                    >
                      Clear Search
                    </button>
                  </div>
                ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-white/5 rounded-3xl bg-white/5">
                   <div className="bg-white/10 p-4 rounded-full mb-4">
                     <i className="fa-solid fa-film text-3xl text-gray-500"></i>
                   </div>
                   <h3 className="text-xl font-bold text-white mb-2">No videos yet</h3>
                   <p className="text-gray-400 text-sm max-w-xs mx-auto">Upload the first video to get started!</p>
                </div>
                )
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                    {sortedVideos.map((char) => (
                      <CharacterCard 
                        key={char.id}
                        character={char} 
                        onClick={() => handleVideoClick(char)}
                        currentUserId={user?.uid}
                        isAdmin={isAdmin}
                        onDelete={handleDeleteVideo}
                        onReport={handleReportVideo}
                        onCopyLink={handleCopyLink}
                        onNotInterested={handleNotInterested}
                        onHide={handleHideVideo}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    ))}
                  </div>

                  {/* Ads at the bottom */}
                  {shouldShowAds(userTier, isAdmin) && sortedVideos.length > 0 && (
                    <div className="mt-8 mb-6 w-full flex flex-col md:flex-row gap-4 justify-center items-center">
                      <AdBanner 
                        zoneId={AD_CONFIG.ZONES.INLINE_NATIVE} 
                        format="native" 
                        width={360} 
                        height={140}
                        className="w-full max-w-[360px]"
                      />

                      {/* Second Ad (only in aggressive mode) */}
                      {AD_CONFIG.AGGRESSIVE_MODE && (
                        <AdBanner 
                          zoneId={AD_CONFIG.ZONES.NATIVE_AD} 
                          format="native" 
                          width={360} 
                          height={140}
                          className="w-full max-w-[360px]"
                        />
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          
          {currentView === 'profile' && (
            <ProfileView 
              currentUser={user}
              onVideoClick={handleVideoClick}
            />
          )}

          {currentView === 'chat' && user && (
            <div className="h-[calc(100vh-125px)] overflow-hidden mt-4">
              <ChatView currentUser={user} initialTargetId={chatTargetId} />
            </div>
          )}
          
          {currentView === 'feed' && (
            user ? (
              <FeedView 
                onClose={() => setCurrentView('home')}
                onToggleSidebar={toggleSidebar}
              />
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-[fadeIn_0.3s_ease-out]">
                <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mb-6">
                  <i className="fa-solid fa-lock text-4xl text-accent"></i>
                </div>
                <h2 className="text-3xl font-bold text-white mb-3">Login Required</h2>
                <p className="text-gray-400 mb-8 max-w-md">
                  You need to be logged in to access the Feed. Join our community to discover amazing content!
                </p>
                <button 
                  onClick={() => openLogin('Login to access Feed')}
                  className="bg-accent hover:bg-accent-hover text-white font-bold py-3 px-8 rounded-full transition-all shadow-lg"
                >
                  Login Now
                </button>
              </div>
            )
          )}

          {currentView === 'community' && (
            user ? (
              <CommunityView 
                isAdmin={isAdmin} 
                currentUser={user}
                onProfileClick={(userId) => {
                  setViewingProfileId(userId);
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-[fadeIn_0.3s_ease-out]">
                <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mb-6">
                  <i className="fa-solid fa-lock text-4xl text-accent"></i>
                </div>
                <h2 className="text-3xl font-bold text-white mb-3">Login Required</h2>
                <p className="text-gray-400 mb-8 max-w-md">
                  You need to be logged in to access the Community Hub. Connect with other members and share content!
                </p>
                <button 
                  onClick={() => openLogin('Login to access Community')}
                  className="bg-accent hover:bg-accent-hover text-white font-bold py-3 px-8 rounded-full transition-all shadow-lg"
                >
                  Login Now
                </button>
              </div>
            )
          )}
          
          {currentView === 'create' && (
            user ? (
              <CreateView onUploadClick={() => setIsUploadOpen(true)} />
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-[fadeIn_0.3s_ease-out]">
                <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mb-6">
                  <i className="fa-solid fa-lock text-4xl text-accent"></i>
                </div>
                <h2 className="text-3xl font-bold text-white mb-3">Login Required</h2>
                <p className="text-gray-400 mb-8 max-w-md">
                  You need to be logged in to create and upload content. Join us to start sharing!
                </p>
                <button 
                  onClick={() => openLogin('Login to create content')}
                  className="bg-accent hover:bg-accent-hover text-white font-bold py-3 px-8 rounded-full transition-all shadow-lg"
                >
                  Login Now
                </button>
              </div>
            )
          )}

          {currentView === 'admin' && isAdmin && (
            <AdminPanel 
              admins={adminEmails}
              onAddAdmin={handleAddAdmin}
              onRemoveAdmin={handleRemoveAdmin}
              videos={videos}
              onDeleteVideo={handleDeleteVideo}
              currentUserEmail={user?.email}
              onOpenVideo={(videoId) => {
                const video = videos.find(v => v.id === videoId);
                if (video) {
                  setSelectedVideo(video);
                  setCurrentView('home'); // Switch to home view to show the video
                }
              }}
            />
          )}

        </div>
      </main>

      {/* Video Player - Full Screen Overlay */}
      {selectedVideo && (
        <VideoPlayerModal
          isOpen={!!selectedVideo}
          onClose={() => setSelectedVideo(null)}
          video={selectedVideo}
          allVideos={videos}
          onToggleFavorite={handleToggleFavorite}
          currentUserId={user?.uid}
          onNavigateToProfile={() => navigateTo('profile')}
          onToggleSidebar={toggleSidebar}
        />
      )}

      <LoginModal 
        isOpen={isLoginOpen} 
        onClose={() => setIsLoginOpen(false)} 
        title={modalTitle}
        onDemoLogin={handleDemoLogin}
      />
      
      <UploadModal 
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUpload={handleVideoUpload}
      />

      <UpgradeModal 
        isOpen={isUpgradeOpen}
        onClose={() => setIsUpgradeOpen(false)}
        currentTier={userTier}
      />

      {/* Public Profile Modal for Search Results */}
      <PublicProfileModal 
        isOpen={!!viewingProfileId}
        onClose={() => setViewingProfileId(null)}
        userId={viewingProfileId}
        onMessage={handleStartChat}
      />

      {/* Sticky Mobile Ad */}
      {shouldShowAds(userTier, isAdmin) && (
        <StickyMobileAd zoneId={AD_CONFIG.ZONES.TOP_BANNER_MOBILE} />
      )}

      {/* Confirm Modal */}
      {showConfirmModal && confirmModalConfig && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)}></div>
          <div className="relative bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-2xl p-6 max-w-md w-full border border-white/10 shadow-2xl animate-[slideUp_0.3s_ease-out]">
            <div className="flex items-start gap-4 mb-6">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                confirmModalConfig.type === 'danger' ? 'bg-red-500/20 text-red-400' :
                confirmModalConfig.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-green-500/20 text-green-400'
              }`}>
                <i className={`fa-solid ${
                  confirmModalConfig.type === 'danger' ? 'fa-exclamation-triangle' :
                  confirmModalConfig.type === 'warning' ? 'fa-exclamation-circle' :
                  'fa-check-circle'
                } text-2xl`}></i>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2">{confirmModalConfig.title}</h3>
                <p className="text-gray-300 text-sm">{confirmModalConfig.message}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/10"
              >
                {confirmModalConfig.cancelText}
              </button>
              <button
                onClick={() => {
                  confirmModalConfig.onConfirm();
                  setShowConfirmModal(false);
                }}
                className={`flex-1 px-4 py-3 font-bold rounded-xl transition-all ${
                  confirmModalConfig.type === 'danger' 
                    ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white'
                    : 'bg-gradient-to-r from-accent to-accent-hover text-white'
                }`}
              >
                {confirmModalConfig.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Modal */}
      {showPromptModal && promptModalConfig && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowPromptModal(false)}></div>
          <div className="relative bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-2xl p-6 max-w-md w-full border border-white/10 shadow-2xl animate-[slideUp_0.3s_ease-out]">
            <h3 className="text-xl font-bold text-white mb-2">{promptModalConfig.title}</h3>
            <p className="text-gray-300 text-sm mb-4">{promptModalConfig.message}</p>
            <textarea
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              placeholder={promptModalConfig.placeholder}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 mb-4 resize-none focus:outline-none focus:border-accent transition-colors"
              rows={3}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowPromptModal(false)}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (promptValue.trim()) {
                    promptModalConfig.onConfirm(promptValue);
                    setShowPromptModal(false);
                  }
                }}
                disabled={!promptValue.trim()}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-accent to-accent-hover text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;