import React, { useState, useRef, useEffect, useCallback } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  addDoc, 
  serverTimestamp,
  deleteDoc,
  increment
} from 'firebase/firestore';
import { trackVideoView, trackVideoLike, trackVideoComment, getRecommendedVideos } from '../utils/recommendations';
import { notifyVideoLike, notifyVideoComment } from '../utils/notificationService';

interface Comment {
  id: string;
  text: string;
  userId: string;
  username: string;
  avatar: string;
  timestamp: any;
}

interface FeedVideo {
  id: string;
  userId: string;
  user: {
    name: string;
    handle: string;
    avatar: string;
    isVerified?: boolean;
  };
  content: string; // Used as description
  mediaUrl: string;
  likes: string[]; // Array of UIDs
  commentsCount?: number; // Optional, ideally synced
  tags: string[];
  music?: string; // Optional field
}

// Fallback Mock Data if DB is empty
const MOCK_FEED: FeedVideo[] = [
  {
    id: "mock1",
    userId: "u1",
    user: { name: "Ocean Lover", handle: "@ocean_vibes", avatar: "https://i.pravatar.cc/150?u=ocean" },
    content: "Swimming with turtles 🐢 #ocean #nature",
    mediaUrl: "https://res.cloudinary.com/demo/video/upload/v1690453533/samples/sea-turtle.mp4",
    likes: [],
    tags: ["ocean"],
    music: "Under the Sea - Remix"
  },
  {
    id: "mock2",
    userId: "u2",
    user: { name: "Travel Addict", handle: "@travel_life", avatar: "https://i.pravatar.cc/150?u=travel" },
    content: "Wait for the drop! 🏔️ Best vacation ever.",
    mediaUrl: "https://res.cloudinary.com/demo/video/upload/v1690453538/samples/cld-sample-video.mp4",
    likes: [],
    tags: ["travel"],
    music: "Adventure Vibes - Original Audio"
  }
];

const FeedView: React.FC = () => {
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentUser = auth.currentUser;

  // Comments State
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  
  // Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  // Follow State (Local simulation for UX)
  const [followedUsers, setFollowedUsers] = useState<string[]>([]);

  // 1. Fetch Videos from Firestore
  useEffect(() => {
    // We query posts that are videos
    const q = query(
        collection(db, "posts"), 
        where("mediaType", "==", "video"),
        orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
        const fetchedVideos: FeedVideo[] = snapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data()
            } as FeedVideo));
            // No filter needed - all videos appear in Feed (community videos included)
        
        // If DB is empty, use Mock data for demonstration
        if (fetchedVideos.length === 0) {
            setVideos(MOCK_FEED);
        } else {
            // Apply recommendation algorithm if user is logged in
            if (currentUser) {
                const videoData = fetchedVideos.map(v => ({
                    id: v.id,
                    tags: v.tags || [],
                    category: v.tags?.[0],
                    userId: v.userId
                }));
                
                const recommendedVideos = await getRecommendedVideos(currentUser.uid, videoData);
                
                // Reorder fetchedVideos based on recommendations
                const orderedVideos = recommendedVideos
                    .map(rv => fetchedVideos.find(fv => fv.id === rv.id))
                    .filter(Boolean) as FeedVideo[];
                
                setVideos(orderedVideos);
            } else {
                // No user logged in, show in chronological order
                setVideos(fetchedVideos);
            }
        }
    });

    return () => unsubscribe();
  }, [currentUser]);

  // 2. Intersection Observer for Autoplay
  useEffect(() => {
    const viewTimers: { [key: string]: NodeJS.Timeout } = {};
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const videoId = entry.target.getAttribute('data-id');
            setPlayingId(videoId);
            const videoElement = entry.target.querySelector('video');
            if (videoElement) {
                videoElement.currentTime = 0;
                videoElement.play().catch(() => {}); 
                
                // Track view after 3 seconds of watching
                if (videoId && currentUser) {
                  viewTimers[videoId] = setTimeout(async () => {
                    const video = videos.find(v => v.id === videoId);
                    if (video) {
                      await trackVideoView(currentUser.uid, videoId, video.tags || []);
                    }
                  }, 3000);
                }
            }
          } else {
             const videoElement = entry.target.querySelector('video');
             const videoId = entry.target.getAttribute('data-id');
             
             if (videoElement) {
                 videoElement.pause();
             }
             
             // Clear view timer if user scrolls away before 3 seconds
             if (videoId && viewTimers[videoId]) {
               clearTimeout(viewTimers[videoId]);
               delete viewTimers[videoId];
             }
          }
        });
      },
      { threshold: 0.6 }
    );

    const videoContainers = document.querySelectorAll('.video-snap-item');
    videoContainers.forEach((el) => observer.observe(el));

    // Cleanup
    return () => {
      observer.disconnect();
      Object.values(viewTimers).forEach(timer => clearTimeout(timer));
    };
  }, [videos, currentUser]);

  // 3. Interactions

  const togglePlay = (e: React.MouseEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const handleLike = async (video: FeedVideo) => {
    if (!currentUser) return alert("Login to like videos!");
    
    // Optimistic UI handled by Firestore listener, but we check specific mock case
    if (video.id.startsWith('mock')) {
        alert("This is a demo video. Create a real post to interact!");
        return;
    }

    const postRef = doc(db, "posts", video.id);
    const isLiked = video.likes?.includes(currentUser.uid);

    try {
        if (isLiked) {
            await updateDoc(postRef, { likes: arrayRemove(currentUser.uid) });
        } else {
            await updateDoc(postRef, { likes: arrayUnion(currentUser.uid) });
            // Track like for recommendations
            await trackVideoLike(currentUser.uid, video.id, video.tags || []);
            
            // Notify video owner about the like
            const videoThumbnail = video.mediaUrl.replace(/\.[^/.]+$/, ".jpg");
            await notifyVideoLike(
                video.userId,
                currentUser.uid,
                currentUser.displayName || 'User',
                currentUser.photoURL || '',
                video.id,
                videoThumbnail
            );
        }
    } catch (error) {
        console.error("Error liking:", error);
    }
  };

  const handleDeleteVideo = async (videoId: string, videoUserId: string) => {
    if (!currentUser) return;
    
    // Check if user is admin
    const adminEmails = ['zailasrj@gmail.com', 'demo@poorn.ai', 'admin@poorn.com', 'eliasra.hdez@gmail.com'];
    const isAdmin = adminEmails.includes(currentUser.email || '');
    const isOwner = currentUser.uid === videoUserId;
    
    if (!isAdmin && !isOwner) {
      alert('You do not have permission to delete this video.');
      return;
    }
    
    if (confirm('Are you sure you want to delete this video? This cannot be undone.')) {
      try {
        await deleteDoc(doc(db, "posts", videoId));
        setActiveMenuId(null);
      } catch (error) {
        console.error('Error deleting video:', error);
        alert('Error deleting video. Please try again.');
      }
    }
  };

  const handleReport = async (videoId: string) => {
    if (!currentUser) return alert("Login to report content!");
    
    const reason = prompt("Please provide a reason for reporting this video:");
    if (!reason || reason.trim() === '') {
      setActiveMenuId(null);
      return;
    }

    try {
      // Find the video to get details
      const video = videos.find(v => v.id === videoId);
      
      await addDoc(collection(db, "reports"), {
        type: 'Video',
        content: video?.title || video?.name || 'Video content',
        videoId: videoId,
        reason: reason.trim(),
        reporter: currentUser.email || currentUser.uid,
        reporterId: currentUser.uid,
        reportedUser: video?.authorName || video?.creator || 'Unknown',
        reportedUserId: video?.authorId,
        reportedUserEmail: video?.authorHandle || 'Unknown',
        status: 'Pending',
        createdAt: serverTimestamp()
      });
      
      alert("Report submitted successfully. Our team will review it.");
    } catch (error) {
      console.error("Error submitting report:", error);
      alert("Failed to submit report. Please try again.");
    }
    
    setActiveMenuId(null);
  };

  const handleCopyLink = (videoId: string) => {
    const link = `https://zpoorn.com/video/${videoId}`;
    navigator.clipboard.writeText(link).then(() => {
      alert("Link copied to clipboard!");
    });
    setActiveMenuId(null);
  };

  const handleHideVideo = async (videoId: string, currentStatus?: boolean) => {
    if (!currentUser) return;
    
    const adminEmails = ['zailasrj@gmail.com', 'demo@poorn.ai', 'admin@poorn.com', 'eliasra.hdez@gmail.com'];
    const isAdmin = adminEmails.includes(currentUser.email || '');
    
    if (!isAdmin) {
      alert('Only admins can hide/unhide content.');
      return;
    }
    
    try {
      await updateDoc(doc(db, "posts", videoId), {
        isHidden: !currentStatus
      });
      setActiveMenuId(null);
    } catch (error) {
      console.error('Error hiding video:', error);
    }
  };

  const handleNotInterested = async (videoId: string) => {
    if (!currentUser) return;
    
    try {
      // Save to user preferences
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        notInterested: arrayUnion(videoId)
      });
      alert("We'll show you less content like this.");
      setActiveMenuId(null);
    } catch (error) {
      console.error('Error marking not interested:', error);
    }
  };

  const handleFollow = (userId: string) => {
      if (!currentUser) return alert("Login to follow creators!");
      if (followedUsers.includes(userId)) {
          setFollowedUsers(prev => prev.filter(id => id !== userId));
      } else {
          setFollowedUsers(prev => [...prev, userId]);
          // Here you would implement real backend follow logic
      }
  };

  const handleShare = async (videoId: string) => {
    const video = videos.find(v => v.id === videoId);
    if (!video) return;
    
    const shareData = {
      title: `Check out this video by ${video.user.name}`,
      text: video.content,
      url: `${window.location.origin}/video/${videoId}`
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareData.url);
        alert('Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(shareData.url);
        alert('Link copied to clipboard!');
      } catch (clipboardError) {
        console.error('Clipboard error:', clipboardError);
      }
    }
  };

  // 4. Comments Logic
  useEffect(() => {
      if (activeCommentId && !activeCommentId.startsWith('mock')) {
          setLoadingComments(true);
          const q = query(collection(db, "posts", activeCommentId, "comments"), orderBy("timestamp", "desc"));
          const unsubscribe = onSnapshot(q, (snapshot) => {
              const fetchedComments: Comment[] = snapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data()
              } as Comment));
              setComments(fetchedComments);
              setLoadingComments(false);
          });
          return () => unsubscribe();
      } else {
          setComments([]);
      }
  }, [activeCommentId]);

  const handleSendComment = async () => {
      if (!currentUser || !activeCommentId || !newCommentText.trim()) return;
      if (activeCommentId.startsWith('mock')) return alert("Cannot comment on demo videos.");

      try {
          await addDoc(collection(db, "posts", activeCommentId, "comments"), {
              text: newCommentText,
              userId: currentUser.uid,
              username: currentUser.displayName || "User",
              avatar: currentUser.photoURL || "",
              timestamp: serverTimestamp()
          });
          
          // Increment comment count in the post document
          const postRef = doc(db, "posts", activeCommentId);
          await updateDoc(postRef, {
              commentCount: increment(1)
          });
          
          // Track comment for recommendations
          const video = videos.find(v => v.id === activeCommentId);
          if (video) {
            await trackVideoComment(currentUser.uid, activeCommentId, video.tags || []);
            
            // Notify video owner about the comment
            const videoThumbnail = video.mediaUrl.replace(/\.[^/.]+$/, ".jpg");
            await notifyVideoComment(
                video.userId,
                currentUser.uid,
                currentUser.displayName || 'User',
                currentUser.photoURL || '',
                activeCommentId,
                videoThumbnail,
                newCommentText
            );
          }
          
          setNewCommentText("");
      } catch (error) {
          console.error("Error commenting:", error);
      }
  };

  return (
    <div className="flex justify-center items-start h-full w-full bg-black animate-[fadeIn_0.3s_ease-out] overflow-hidden relative rounded-[2.5rem]">
      
      {/* Feed Container */}
      <div 
        ref={containerRef}
        className="w-full md:max-w-[420px] h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide bg-black relative rounded-[2.5rem]"
      >
        {videos.map((item) => {
            const isLiked = currentUser && item.likes?.includes(currentUser.uid);
            const isFollowing = followedUsers.includes(item.userId);

            return (
              <div 
                key={item.id} 
                data-id={item.id}
                className="video-snap-item w-full h-full snap-start relative bg-[#111] overflow-hidden rounded-2xl"
              >
                {/* Video Player */}
                <video
                  className="w-full h-full object-cover cursor-pointer rounded-2xl"
                  src={item.mediaUrl}
                  loop
                  muted={true} // Start muted to allow autoplay policy
                  playsInline
                  onClick={togglePlay}
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60 pointer-events-none"></div>

                {/* Three-dot Menu Button (Top Right) */}
                {currentUser && (
                  (() => {
                    const adminEmails = ['zailasrj@gmail.com', 'demo@poorn.ai', 'admin@poorn.com', 'eliasra.hdez@gmail.com'];
                    const isAdmin = adminEmails.includes(currentUser.email || '');
                    const isOwner = currentUser.uid === item.userId;
                    const canDelete = isAdmin || isOwner;
                    
                    return canDelete ? (
                      <div className="absolute top-4 right-4 z-30">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === item.id ? null : item.id);
                          }}
                          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg hover:bg-black/80 transition-colors"
                        >
                          <i className="fa-solid fa-ellipsis text-white"></i>
                        </button>
                        
                        {/* Dropdown Menu */}
                        {activeMenuId === item.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-40" 
                              onClick={() => setActiveMenuId(null)}
                            />
                            <div className="absolute right-0 mt-2 w-52 bg-[#1a1a1a] rounded-xl shadow-2xl border border-white/10 overflow-hidden z-50 animate-[fadeIn_0.1s_ease-out]">
                              
                              {/* Report - Always visible */}
                              <button
                                onClick={() => handleReport(item.id)}
                                className="w-full py-3 px-4 text-left text-red-500 font-bold hover:bg-white/5 transition-colors border-b border-white/10"
                              >
                                Report
                              </button>
                              
                              {/* User Options */}
                              <button
                                onClick={() => handleNotInterested(item.id)}
                                className="w-full py-3 px-4 text-left text-white hover:bg-white/5 transition-colors border-b border-white/10"
                              >
                                Not interested
                              </button>
                              
                              <button
                                onClick={() => handleCopyLink(item.id)}
                                className="w-full py-3 px-4 text-left text-white hover:bg-white/5 transition-colors border-b border-white/10"
                              >
                                Copy link
                              </button>
                              
                              {/* Admin Controls */}
                              {isAdmin && (
                                <>
                                  <div className="bg-white/5 px-3 py-1.5 text-[10px] text-gray-500 font-bold text-center uppercase tracking-widest border-b border-white/10">
                                    Admin Controls
                                  </div>
                                  
                                  <button
                                    onClick={() => handleHideVideo(item.id, false)}
                                    className="w-full py-3 px-4 text-left text-yellow-400 font-medium hover:bg-white/5 transition-colors border-b border-white/10 flex items-center gap-3"
                                  >
                                    <i className="fa-regular fa-eye-slash"></i>
                                    Hide Video
                                  </button>
                                </>
                              )}
                              
                              {/* Delete - Owner or Admin */}
                              {canDelete && (
                                <button
                                  onClick={() => handleDeleteVideo(item.id, item.userId)}
                                  className="w-full py-3 px-4 text-left text-red-400 font-medium hover:bg-white/5 transition-colors flex items-center gap-3"
                                >
                                  <i className="fa-regular fa-trash-can"></i>
                                  Delete Video
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ) : null;
                  })()
                )}

                {/* --- RIGHT SIDEBAR ACTIONS --- */}
                {/* Mobile - Inside video */}
                <div className="md:hidden absolute right-3 bottom-24 flex flex-col items-center gap-6 z-20">
                    
                    {/* Avatar with Follow Button */}
                    <div className="relative mb-2">
                        <div className="w-12 h-12 rounded-full border border-white p-[1px] overflow-hidden bg-black transition-transform active:scale-95">
                            <img src={item.user.avatar} alt={item.user.name} className="w-full h-full object-cover rounded-full" />
                        </div>
                        
                        {currentUser?.uid !== item.userId && (
                            <button 
                                onClick={() => handleFollow(item.userId)}
                                className={`absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full w-5 h-5 flex items-center justify-center text-[10px] text-white shadow-md transition-all duration-300 ${isFollowing ? 'bg-gray-500 scale-0' : 'bg-accent scale-100'}`}
                            >
                                <i className="fa-solid fa-plus"></i>
                            </button>
                        )}
                    </div>

                    {/* Like Button */}
                    <button 
                        onClick={() => handleLike(item)}
                        className="flex flex-col items-center gap-1 group"
                    >
                        <div className="relative">
                           <i className={`fa-solid fa-heart text-3xl drop-shadow-lg transition-all duration-200 ${isLiked ? 'text-red-500 scale-110' : 'text-white group-active:scale-90'}`}></i>
                        </div>
                        <span className="text-xs font-bold text-white drop-shadow-md">{item.likes?.length || 0}</span>
                    </button>

                    {/* Comment Button */}
                    <button 
                        onClick={() => setActiveCommentId(item.id)}
                        className="flex flex-col items-center gap-1 group"
                    >
                        <div className="relative">
                             <i className="fa-solid fa-comment-dots text-3xl text-white drop-shadow-lg transition-all group-active:scale-90"></i>
                        </div>
                        <span className="text-xs font-bold text-white drop-shadow-md">
                            {/* Simple generic count if mocked, or fetch real count if optimized */}
                            {comments.length > 0 && activeCommentId === item.id ? comments.length : 'Chat'}
                        </span>
                    </button>

                    {/* Share Button */}
                    <button className="flex flex-col items-center gap-1 group">
                        <div className="relative">
                            <i className="fa-solid fa-share text-3xl text-white drop-shadow-lg transition-all group-active:scale-90"></i>
                        </div>
                        <span className="text-xs font-bold text-white drop-shadow-md">Share</span>
                    </button>

                    {/* Rotating Music Disc */}
                    <div className="w-12 h-12 rounded-full bg-black border-4 border-gray-800 flex items-center justify-center mt-4 animate-spin-slow overflow-hidden shadow-lg shadow-black/50">
                         <img src={item.user.avatar} className="w-7 h-7 rounded-full object-cover opacity-80" />
                    </div>
                </div>

              </div>
            );
        })}
      </div>

      {/* Desktop Action Buttons - Positioned next to video, not in corner */}
      {videos.length > 0 && playingId && (
        <div className="hidden md:flex fixed right-6 top-1/2 transform -translate-y-1/2 flex-col items-center gap-4 z-50">
          {/* Ad Banner for Feed - Desktop */}
          <div className="bg-gradient-to-br from-[#151515] to-[#0A0A0A] border border-white/10 rounded-lg flex flex-col items-center justify-center p-4 w-full mb-4" style={{minHeight: '90px', width: '200px'}}>
            <div className="flex items-center gap-2 mb-2">
              <i className="fa-solid fa-ad text-gray-600 text-2xl"></i>
              <div className="h-6 w-px bg-white/10"></div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Advertisement</p>
                <p className="text-[8px] text-gray-700">Zone: 5839814</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></div>
              <p className="text-[10px] text-gray-600">Loading content...</p>
            </div>
          </div>
          
          {/* Action Buttons for Current Playing Video */}
          {(() => {
            const currentVideo = videos.find(v => v.id === playingId);
            if (!currentVideo) return null;
            
            const isLiked = currentUser && currentVideo.likes?.includes(currentUser.uid);
            const isFollowing = followedUsers.includes(currentVideo.userId);
            
            return (
              <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-3 border border-white/5 flex flex-col items-center gap-4">
                
                {/* Avatar with Follow Button */}
                <div className="relative mb-2">
                    <div className="w-12 h-12 rounded-full border border-white p-[1px] overflow-hidden bg-black transition-transform active:scale-95">
                        <img src={currentVideo.user.avatar} alt={currentVideo.user.name} className="w-full h-full object-cover rounded-full" />
                    </div>
                    
                    {currentUser?.uid !== currentVideo.userId && (
                        <button 
                            onClick={() => handleFollow(currentVideo.userId)}
                            className={`absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full w-5 h-5 flex items-center justify-center text-[10px] text-white shadow-md transition-all duration-300 ${isFollowing ? 'bg-gray-500 scale-0' : 'bg-accent scale-100'}`}
                        >
                            <i className="fa-solid fa-plus"></i>
                        </button>
                    )}
                </div>

                {/* Like Button */}
                <button 
                    onClick={() => handleLike(currentVideo)}
                    className="flex flex-col items-center gap-1 group"
                >
                    <div className="relative">
                       <i className={`fa-solid fa-heart text-3xl drop-shadow-lg transition-all duration-200 ${isLiked ? 'text-red-500 scale-110' : 'text-white group-active:scale-90'}`}></i>
                    </div>
                    <span className="text-xs font-bold text-white drop-shadow-md">{currentVideo.likes?.length || 0}</span>
                </button>

                {/* Comment Button */}
                <button 
                    onClick={() => setActiveCommentId(currentVideo.id)}
                    className="flex flex-col items-center gap-1 group"
                >
                    <div className="relative">
                         <i className="fa-solid fa-comment-dots text-3xl text-white drop-shadow-lg transition-all group-active:scale-90"></i>
                    </div>
                    <span className="text-xs font-bold text-white drop-shadow-md">
                        {comments.length > 0 && activeCommentId === currentVideo.id ? comments.length : 'Chat'}
                    </span>
                </button>

                {/* Share Button */}
                <button 
                    onClick={() => handleShare(currentVideo.id)}
                    className="flex flex-col items-center gap-1 group"
                >
                    <div className="relative">
                        <i className="fa-solid fa-share text-3xl text-white drop-shadow-lg transition-all group-active:scale-90"></i>
                    </div>
                    <span className="text-xs font-bold text-white drop-shadow-md">Share</span>
                </button>

                {/* Rotating Music Disc */}
                <div className="w-12 h-12 rounded-full bg-black border-4 border-gray-800 flex items-center justify-center mt-4 animate-spin-slow overflow-hidden shadow-lg shadow-black/50">
                     <img src={currentVideo.user.avatar} className="w-7 h-7 rounded-full object-cover opacity-80" />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* --- COMMENTS DRAWER (TikTok Style) --- */}
      {activeCommentId && (
        <>
            <div className="absolute inset-0 z-30 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setActiveCommentId(null)}></div>
            <div className="absolute bottom-0 left-0 right-0 z-40 bg-[#121212] rounded-t-2xl border-t border-white/10 h-[65%] flex flex-col animate-[slideUp_0.3s_ease-out] shadow-2xl">
                
                {/* Drawer Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#121212] rounded-t-2xl">
                    <h3 className="text-sm font-bold text-white text-center flex-1">
                        {comments.length} comments
                    </h3>
                    <button onClick={() => setActiveCommentId(null)} className="text-gray-400 hover:text-white p-2">
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                {/* Comments List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loadingComments ? (
                        <div className="text-center py-10 text-gray-500"><i className="fa-solid fa-circle-notch fa-spin"></i></div>
                    ) : comments.length === 0 ? (
                        <div className="text-center py-10 text-gray-500 text-sm">No comments yet. Be the first!</div>
                    ) : (
                        comments.map(c => (
                            <div key={c.id} className="flex gap-3 items-start">
                                <img src={c.avatar || "https://ui-avatars.com/api/?name=User"} className="w-8 h-8 rounded-full object-cover border border-white/10" />
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-gray-400 mb-0.5">{c.username}</p>
                                    <p className="text-sm text-white leading-tight">{c.text}</p>
                                    <div className="flex gap-4 mt-2 text-[10px] text-gray-500 font-medium">
                                        <span>Just now</span>
                                        <button className="hover:text-gray-300">Reply</button>
                                        <div className="flex items-center gap-1">
                                            <i className="fa-regular fa-heart"></i>
                                            <span>0</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-white/10 bg-[#121212] flex items-center gap-3">
                    <img src={currentUser?.photoURL || "https://ui-avatars.com/api/?name=Me"} className="w-8 h-8 rounded-full border border-white/10" />
                    <div className="flex-1 relative">
                        <input 
                            type="text" 
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                            placeholder="Add comment..."
                            className="w-full bg-[#2a2a2a] border-none rounded-full py-2.5 pl-4 pr-10 text-sm text-white focus:ring-1 focus:ring-accent placeholder-gray-500"
                        />
                        <button 
                            onClick={handleSendComment}
                            disabled={!newCommentText.trim()}
                            className="absolute right-2 top-1.5 text-accent hover:text-white p-1 disabled:opacity-50"
                        >
                            <i className="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
        </>
      )}
      
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
        .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
        @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
        }
        .animate-marquee {
            animation: marquee 8s linear infinite;
        }
        .animate-spin-slow {
            animation: spin 5s linear infinite;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default FeedView;