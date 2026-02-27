import React, { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, where, getDocs, setDoc, serverTimestamp, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../firebase';
import SocialLinksModal from './SocialLinksModal';

interface PublicProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null; // The UID of the user to show
  onMessage: () => void; // Function to trigger chat navigation
}

interface UserProfileData {
  displayName: string;
  username: string;
  email?: string; // Added email to check for admin/owner status
  photoURL: string;
  coverPhotoURL?: string;
  bio?: string;
  isVerified?: boolean;
  followers?: number;
  totalViews?: number;
  videoCount?: number;
  rank?: number;
}

const OWNER_EMAIL = 'zailasrj@gmail.com';
const OWNER_USERNAME = 'zailasrj';
const ADMIN_EMAILS = ['demo@poorn.ai', 'admin@poorn.com', 'eliasra.hdez@gmail.com']; // Add other admin emails here

const PublicProfileModal: React.FC<PublicProfileModalProps> = ({ isOpen, onClose, userId, onMessage }) => {
  const [userData, setUserData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');
  const [isSocialsOpen, setIsSocialsOpen] = useState(false);
  const [userVideos, setUserVideos] = useState<any[]>([]);
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      setLoading(true);
      const fetchUser = async () => {
        try {
          console.log('🔍 Fetching profile for userId:', userId);
          const docRef = doc(db, "users", userId);
          const docSnap = await getDoc(docRef);
          
          console.log('📄 User document exists:', docSnap.exists());
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            console.log('👤 User data:', data);
            
            // Get real followers count from user document
            const followers = data.followers || [];
            const followersCount = Array.isArray(followers) ? followers.length : 0;
            
            console.log('👥 Followers count:', followersCount, 'Followers array:', followers);
            
            // Get real video count (videos uploaded by this user)
            const videosQuery = query(
              collection(db, "posts"),
              where("userId", "==", userId)
            );
            const videosSnapshot = await getDocs(videosQuery);
            const videoCount = videosSnapshot.size;
            
            console.log('📹 Found', videoCount, 'videos for user');
            
            // Calculate total views from all videos
            let totalViews = 0;
            videosSnapshot.forEach((videoDoc) => {
              const videoData = videoDoc.data();
              totalViews += parseInt(videoData.views || '0');
            });
            
            // Calculate rank (position among all users by followers) - Simplified
            const allUsersSnapshot = await getDocs(collection(db, "users"));
            const usersWithFollowers: { id: string, followers: number }[] = [];
            
            allUsersSnapshot.forEach((userDoc) => {
              const userData = userDoc.data();
              const userFollowers = userData.followers || [];
              usersWithFollowers.push({
                id: userDoc.id,
                followers: Array.isArray(userFollowers) ? userFollowers.length : 0
              });
            });
            
            // Sort by followers descending
            usersWithFollowers.sort((a, b) => b.followers - a.followers);
            const rank = usersWithFollowers.findIndex(u => u.id === userId) + 1;
            
            // Get user's videos for display
            const userVideosData: any[] = [];
            videosSnapshot.forEach((videoDoc) => {
              const videoData = videoDoc.data();
              userVideosData.push({
                id: videoDoc.id,
                name: videoData.title || videoData.name || 'Untitled',
                image: videoData.mediaType === 'video' 
                  ? (videoData.mediaUrl?.replace(/\.[^/.]+$/, ".jpg")) 
                  : videoData.mediaUrl,
                thumbnail: videoData.thumbnail,
                views: videoData.views || 0,
                likes: videoData.likes || [],
                ...videoData
              });
            });
            console.log('📹 User videos:', userVideosData);
            setUserVideos(userVideosData.slice(0, 8)); // Show first 8 videos
            
            setUserData({
              displayName: data.displayName || data.name || 'User',
              username: data.username || data.handle || data.displayName?.toLowerCase().replace(/\s+/g, '_') || 'user',
              email: data.email || '',
              photoURL: data.photoURL || data.avatar || `https://ui-avatars.com/api/?name=${data.displayName || 'User'}`,
              coverPhotoURL: data.coverPhotoURL || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1000&auto=format&fit=crop',
              bio: data.bio || 'No bio yet.',
              isVerified: data.isVerified || false,
              followers: followersCount,
              totalViews: totalViews,
              videoCount: videoCount,
              rank: rank > 0 ? rank : 999
            });
            
            console.log('✅ Profile loaded:', {
              displayName: data.displayName,
              username: data.username,
              followers: followersCount,
              videos: videoCount,
              views: totalViews
            });
          } else {
            console.log('❌ User document not found for userId:', userId);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchUser();
    } else {
        setUserData(null);
    }
  }, [isOpen, userId]);

  // Load friend request status and subscription status
  useEffect(() => {
    const loadStatuses = async () => {
      if (isOpen && userId && auth.currentUser) {
        try {
          // Load friend request status
          const requestId = [auth.currentUser.uid, userId].sort().join('_');
          const requestRef = doc(db, "friendRequests", requestId);
          const requestSnap = await getDoc(requestRef);
          
          if (requestSnap.exists()) {
            setFriendRequestSent(true);
          } else {
            setFriendRequestSent(false);
          }
          
          // Load subscription status
          const userRef = doc(db, "users", userId);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const followers = userData.followers || [];
            setIsSubscribed(Array.isArray(followers) && followers.includes(auth.currentUser.uid));
          }
        } catch (error) {
          console.error("Error loading statuses:", error);
        }
      }
    };
    loadStatuses();
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const isOwner = userData?.email === OWNER_EMAIL || userData?.username === OWNER_USERNAME;
  const isAdmin = userData?.email && ADMIN_EMAILS.includes(userData.email);

  return (
    <>
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-sans">
      <div 
        className="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="relative w-full max-w-5xl bg-[#0F0F0F] border border-white/10 rounded-xl shadow-2xl animate-[fadeIn_0.3s_ease-out] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-50 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-white/20 text-white transition-colors backdrop-blur-md"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        {loading ? (
            <div className="h-96 flex items-center justify-center text-white">
                <i className="fa-solid fa-circle-notch fa-spin text-3xl text-accent"></i>
            </div>
        ) : userData ? (
            <div className="overflow-y-auto custom-scrollbar">
                
                {/* --- HEADER / BANNER SECTION --- */}
                <div className="relative w-full h-48 md:h-64 bg-gray-800">
                    <img 
                        src={userData.coverPhotoURL} 
                        alt="Cover" 
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F0F] via-transparent to-transparent opacity-90"></div>
                    
                    {/* Floating Info on Banner (Right Side - Stats) */}
                    <div className="absolute bottom-4 right-4 md:right-8 flex gap-6 md:gap-12 text-center text-white drop-shadow-md hidden md:flex">
                        <div>
                            <p className="text-xl font-bold flex items-center gap-1">
                                {isOwner ? (
                                    <span className="text-blue-400">?</span>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-arrow-down text-red-500 text-sm"></i> {userData.rank}
                                    </>
                                )}
                            </p>
                            <p className="text-[10px] uppercase tracking-wider text-gray-300">Model Rank</p>
                        </div>
                        <div>
                            <p className="text-xl font-bold">
                                {isOwner ? (
                                    <span className="text-blue-400">?</span>
                                ) : (
                                    userData.totalViews && userData.totalViews >= 1000000 
                                    ? `${(userData.totalViews / 1000000).toFixed(1)}M`
                                    : userData.totalViews && userData.totalViews >= 1000
                                    ? `${(userData.totalViews / 1000).toFixed(1)}K`
                                    : userData.totalViews || 0
                                )}
                            </p>
                            <p className="text-[10px] uppercase tracking-wider text-gray-300">Video Views</p>
                        </div>
                        <div>
                            <p className="text-xl font-bold">
                                {userData.followers && userData.followers >= 1000
                                    ? `${(userData.followers / 1000).toFixed(1)}K`
                                    : userData.followers || 0}
                            </p>
                            <p className="text-[10px] uppercase tracking-wider text-gray-300">Subscribers</p>
                        </div>
                    </div>
                </div>

                {/* --- PROFILE INFO STRIP --- */}
                <div className="relative px-6 md:px-10 pb-4 -mt-16 md:-mt-20 flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
                    
                    {/* Left: Avatar & Name */}
                    <div className="flex items-end gap-4 md:gap-6">
                        <div className={`w-24 h-24 md:w-32 md:h-32 rounded-full border-4 overflow-hidden bg-black shadow-2xl relative z-10 ${isOwner ? 'border-blue-500/50 shadow-blue-500/20' : isAdmin ? 'border-red-500/50 shadow-red-500/20' : 'border-[#0F0F0F]'}`}>
                            <img src={userData.photoURL} alt={userData.displayName} className="w-full h-full object-cover" />
                        </div>
                        <div className="mb-2 z-10">
                            <div className="flex items-center gap-2 mb-1">
                                <h1 className="text-2xl md:text-3xl font-bold text-white shadow-black drop-shadow-md flex items-center gap-2">
                                    {userData.displayName}
                                    {isOwner && <i className="fa-solid fa-crown text-blue-400 text-lg animate-pulse" title="Owner"></i>}
                                </h1>
                                {userData.isVerified && !isOwner && (
                                    <i className="fa-solid fa-circle-check text-blue-400 text-lg drop-shadow-md" title="Verified Creator"></i>
                                )}
                            </div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-sm text-gray-300 font-medium">@{userData.username}</span>
                                
                                {/* --- BADGES LOGIC --- */}
                                {isOwner ? (
                                    // OWNER BADGE (BLUE FIRE)
                                    <div className="relative group">
                                        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-cyan-500 rounded blur opacity-60 group-hover:opacity-100 transition duration-200 animate-pulse"></div>
                                        <div className="relative px-3 py-0.5 bg-black rounded border border-blue-500/50 flex items-center gap-1.5 shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                                            <i className="fa-solid fa-crown text-blue-400 text-[10px]"></i>
                                            <span className="text-[10px] font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-cyan-200 uppercase tracking-wider">OWNER</span>
                                            <i className="fa-solid fa-fire text-blue-500 text-[10px] animate-bounce"></i>
                                        </div>
                                    </div>
                                ) : isAdmin ? (
                                    // ADMIN BADGE (RED/ORANGE FIRE)
                                    <div className="relative group">
                                        <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-orange-500 rounded blur opacity-60 group-hover:opacity-100 transition duration-200 animate-pulse"></div>
                                        <div className="relative px-3 py-0.5 bg-black rounded border border-red-500/50 flex items-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                                            <i className="fa-solid fa-shield-halved text-red-400 text-[10px]"></i>
                                            <span className="text-[10px] font-black text-transparent bg-clip-text bg-gradient-to-r from-red-200 to-orange-200 uppercase tracking-wider">ADMIN</span>
                                            <i className="fa-solid fa-fire text-orange-500 text-[10px] animate-bounce"></i>
                                        </div>
                                    </div>
                                ) : (
                                    // STANDARD CREATOR BADGE
                                    <div className="bg-white/10 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase border border-white/20 flex items-center gap-1">
                                        <i className="fa-solid fa-gem text-accent"></i> Creator
                                    </div>
                                )}
                            </div>
                            {/* Bio below username */}
                            {userData.bio && userData.bio !== 'No bio yet.' && (
                                <p className="text-sm text-gray-400 mt-1 max-w-md">{userData.bio}</p>
                            )}
                        </div>
                    </div>

                    {/* Right: Actions (Responsive Layout) */}
                    <div className="w-full md:w-auto mt-4 md:mt-0 z-10">
                        <div className="grid grid-cols-2 md:flex md:flex-row gap-2 md:gap-3">
                             <button 
                                onClick={() => setIsSocialsOpen(true)}
                                className="col-span-2 md:col-span-auto md:w-auto bg-accent hover:bg-accent-hover text-white font-bold py-2.5 px-6 rounded text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30"
                             >
                                More of me <i className="fa-solid fa-arrow-up-right-from-square"></i>
                             </button>
                             <button 
                                onClick={() => {
                                    onMessage();
                                    onClose();
                                }}
                                className="md:w-auto border border-white/20 bg-[#1a1a1a] hover:bg-[#252525] text-white font-bold py-2.5 px-4 rounded text-sm transition-colors flex items-center justify-center gap-2"
                             >
                                <i className="fa-solid fa-comment"></i> <span className="truncate">Message</span>
                             </button>
                             <button 
                                onClick={async () => {
                                    if (!friendRequestSent && auth.currentUser && userId) {
                                        try {
                                            const requestId = [auth.currentUser.uid, userId].sort().join('_');
                                            const requestRef = doc(db, "friendRequests", requestId);
                                            
                                            await setDoc(requestRef, {
                                                fromUserId: auth.currentUser.uid,
                                                toUserId: userId,
                                                status: 'pending',
                                                createdAt: serverTimestamp()
                                            });
                                            
                                            setFriendRequestSent(true);
                                            console.log('✅ Friend request sent to:', userId);
                                        } catch (error) {
                                            console.error("Error sending friend request:", error);
                                        }
                                    }
                                }}
                                className={`md:w-auto border border-white/20 ${
                                    friendRequestSent 
                                    ? 'bg-green-600/20 border-green-500/30' 
                                    : 'bg-[#1a1a1a] hover:bg-[#252525]'
                                } text-white font-bold py-2.5 px-4 rounded text-sm transition-colors flex items-center justify-center gap-2`}
                                disabled={friendRequestSent}
                             >
                                <i className={`fa-solid ${friendRequestSent ? 'fa-check' : 'fa-user-plus'}`}></i> 
                                <span className="truncate">{friendRequestSent ? 'Request Sent' : 'Add Friend'}</span>
                             </button>
                             <button 
                                onClick={async () => {
                                    if (!auth.currentUser) {
                                        alert("Please login to subscribe");
                                        return;
                                    }
                                    if (!userId) return;
                                    
                                    try {
                                        const userRef = doc(db, "users", userId);
                                        
                                        if (isSubscribed) {
                                            await updateDoc(userRef, { 
                                                followers: arrayRemove(auth.currentUser.uid) 
                                            });
                                            setIsSubscribed(false);
                                        } else {
                                            await updateDoc(userRef, { 
                                                followers: arrayUnion(auth.currentUser.uid) 
                                            });
                                            setIsSubscribed(true);
                                        }
                                        
                                        console.log(isSubscribed ? 'Unsubscribed from:' : 'Subscribed to:', userId);
                                    } catch (error) {
                                        console.error("Error updating subscription:", error);
                                    }
                                }}
                                className={`md:w-auto border border-white/20 ${
                                    isSubscribed 
                                    ? 'bg-accent/20 border-accent/30' 
                                    : 'bg-[#1a1a1a] hover:bg-[#252525]'
                                } text-white font-bold py-2.5 px-4 rounded text-sm transition-colors flex items-center justify-center gap-2`}
                             >
                                <i className={`fa-solid ${isSubscribed ? 'fa-check' : 'fa-rss'}`}></i> 
                                <span className="truncate">{isSubscribed ? 'Subscribed' : 'Subscribe'}</span>
                             </button>
                        </div>
                    </div>
                </div>

                {/* --- NAVIGATION TABS --- */}
                <div className="mt-4 px-4 md:px-10 border-b border-white/10 bg-[#0F0F0F] sticky top-0 z-20">
                    <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide">
                        {['Home', 'Uploads', 'Favorites', 'Photos', 'Info & Stats'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`py-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap px-2 ${
                                    activeTab === tab 
                                    ? 'border-white text-white' 
                                    : 'border-transparent text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                <i className={`mr-2 fa-solid ${
                                    tab === 'Home' ? 'fa-house' : 
                                    tab === 'Uploads' ? 'fa-cloud-upload-alt' : 
                                    tab === 'Favorites' ? 'fa-heart' :
                                    tab === 'Photos' ? 'fa-camera' : 
                                    tab === 'Info & Stats' ? 'fa-chart-bar' : 'fa-user'
                                }`}></i>
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* --- CONTENT AREA --- */}
                <div className="p-6 md:px-10 min-h-[300px] bg-[#0F0F0F]">
                    {activeTab === 'Home' && (
                        <div className="animate-[fadeIn_0.2s_ease-out]">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-white">
                                    Recent Uploads
                                    {userData.videoCount !== undefined && (
                                        <span className="ml-2 text-sm text-gray-500">
                                            ({isOwner ? '?' : userData.videoCount} uploads)
                                        </span>
                                    )}
                                </h3>
                                {userVideos.length > 0 && (
                                    <button className="text-sm text-accent hover:text-accent-hover font-medium">
                                        See All →
                                    </button>
                                )}
                            </div>

                            {/* Real Videos Grid */}
                            {userVideos.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {userVideos.map((video) => (
                                        <div key={video.id} className="aspect-[3/4] bg-gray-800 rounded-lg overflow-hidden relative group cursor-pointer">
                                            <img 
                                                src={video.image || video.thumbnail || `https://picsum.photos/300/400?random=${video.id}`} 
                                                alt={video.name}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                                            />
                                            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                                            <div className="absolute bottom-2 left-2 right-2">
                                                <p className="text-xs font-bold text-white drop-shadow-md truncate mb-1">
                                                    {video.name}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs text-white/80">
                                                    <span><i className="fa-solid fa-play mr-1"></i>{video.views || 0}</span>
                                                    <span><i className="fa-solid fa-heart mr-1"></i>{Array.isArray(video.likes) ? video.likes.length : (video.likes || 0)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                                    <i className="fa-solid fa-video-slash text-4xl mb-4"></i>
                                    <p>No videos uploaded yet</p>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {activeTab === 'Uploads' && (
                        <div className="animate-[fadeIn_0.2s_ease-out]">
                            <h3 className="text-lg font-bold text-white mb-4">All Uploads</h3>
                            {userVideos.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {userVideos.map((video) => (
                                        <div key={video.id} className="aspect-[3/4] bg-gray-800 rounded-lg overflow-hidden relative group cursor-pointer">
                                            <img 
                                                src={video.image || video.thumbnail || `https://picsum.photos/300/400?random=${video.id}`} 
                                                alt={video.name}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                                            />
                                            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                                            <div className="absolute bottom-2 left-2 right-2">
                                                <p className="text-xs font-bold text-white drop-shadow-md truncate mb-1">
                                                    {video.name}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs text-white/80">
                                                    <span><i className="fa-solid fa-play mr-1"></i>{video.views || 0}</span>
                                                    <span><i className="fa-solid fa-heart mr-1"></i>{Array.isArray(video.likes) ? video.likes.length : (video.likes || 0)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                                    <i className="fa-solid fa-video-slash text-4xl mb-4"></i>
                                    <p>No videos uploaded yet</p>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {activeTab === 'Favorites' && (
                        <div className="animate-[fadeIn_0.2s_ease-out]">
                            <h3 className="text-lg font-bold text-white mb-4">Favorites</h3>
                            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                                <i className="fa-solid fa-heart text-4xl mb-4"></i>
                                <p>No favorites yet</p>
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'Photos' && (
                        <div className="animate-[fadeIn_0.2s_ease-out]">
                            <h3 className="text-lg font-bold text-white mb-4">Photos</h3>
                            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                                <i className="fa-solid fa-camera text-4xl mb-4"></i>
                                <p>No photos uploaded yet</p>
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'Info & Stats' && (
                        <div className="animate-[fadeIn_0.2s_ease-out]">
                            <div className="bg-[#1a1a1a] rounded-lg border border-white/10 p-6">
                                <h3 className="text-lg font-bold text-white mb-6 pb-3 border-b border-white/10">Info & Stats</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex justify-between py-2 border-b border-white/5">
                                        <span className="text-gray-400">Joined:</span>
                                        <span className="text-white font-medium">
                                            {userData.createdAt ? new Date(userData.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-white/5">
                                        <span className="text-gray-400">Last Seen:</span>
                                        <span className="text-white font-medium">Recently</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-white/5">
                                        <span className="text-gray-400">Uploads:</span>
                                        <span className="text-white font-medium">{userData.videoCount || 0}</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-white/5">
                                        <span className="text-gray-400">Upload Views:</span>
                                        <span className="text-white font-medium">
                                            {userData.totalViews ? userData.totalViews.toLocaleString() : 0}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-white/5">
                                        <span className="text-gray-400">Profile Views:</span>
                                        <span className="text-white font-medium">0</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-white/5">
                                        <span className="text-gray-400">Favorited:</span>
                                        <span className="text-white font-medium">0</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-white/5">
                                        <span className="text-gray-400">Friend Count:</span>
                                        <span className="text-white font-medium">0</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-white/5">
                                        <span className="text-gray-400">Subscribers:</span>
                                        <span className="text-white font-medium">{userData.followers || 0}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        ) : (
            <div className="p-10 text-center text-red-400">User not found</div>
        )}
      </div>
    </div>
    
    {/* Social Links Overlay Modal */}
    {userData && (
        <SocialLinksModal 
            isOpen={isSocialsOpen} 
            onClose={() => setIsSocialsOpen(false)} 
            user={{
                displayName: userData.displayName,
                username: userData.username,
                photoURL: userData.photoURL
            }}
        />
    )}
    </>
  );
};

export default PublicProfileModal;