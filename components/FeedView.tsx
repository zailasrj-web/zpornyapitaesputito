import React, { useState, useRef, useEffect } from 'react';
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
  increment,
  getDoc,
  getDocs
} from 'firebase/firestore';

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
  content: string;
  mediaUrl: string;
  likes: string[];
  commentsCount?: number;
  tags: string[];
  music?: string;
}

interface FeedViewProps {
  onClose: () => void;
  onToggleSidebar: () => void;
}

const FeedView: React.FC<FeedViewProps> = ({ onClose, onToggleSidebar }) => {
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  
  // Comments state
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  
  // Touch/Swipe state
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const currentUser = auth.currentUser;

  const minSwipeDistance = 50;
  const currentVideo = videos[currentIndex];

  // Check subscription status
  useEffect(() => {
    if (!currentUser || !currentVideo) return;

    const checkSubscription = async () => {
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      const subscriptions = userDoc.data()?.subscriptions || [];
      setIsSubscribed(subscriptions.includes(currentVideo.userId));
    };

    checkSubscription();
  }, [currentUser, currentVideo?.userId]);

  // Fetch videos from Firestore
  useEffect(() => {
    const q = query(
      collection(db, "posts"), 
      where("mediaType", "==", "video"),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedVideos: FeedVideo[] = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // Get user info - check if it's in a nested 'user' object first
        let userName = 'Unknown User';
        let userHandle = '@unknownuser';
        let userAvatar = 'https://ui-avatars.com/api/?name=User';
        let userId = data.userId || '';
        
        if (data.user && typeof data.user === 'object') {
          // New format with nested user object
          userName = data.user.name || userName;
          userHandle = data.user.handle || userHandle;
          userAvatar = data.user.avatar || userAvatar;
        } else {
          // Old format with flat fields
          userName = data.authorName || data.creator || data.displayName || data.username || userName;
          userHandle = data.authorHandle || data.handle || userHandle;
          userAvatar = data.authorAvatar || data.authorPhoto || data.photoURL || data.avatar || userAvatar;
        }
        
        return {
          id: doc.id,
          userId: userId,
          user: {
            name: userName,
            handle: userHandle,
            avatar: userAvatar,
            isVerified: data.isVerified || data.user?.isVerified || false
          },
          content: data.description || data.content || data.text || '',
          mediaUrl: data.videoUrl || data.mediaUrl || data.url || '',
          likes: Array.isArray(data.likes) ? data.likes : [],
          commentsCount: 0, // Will be updated by real-time listener
          tags: Array.isArray(data.tags) ? data.tags : [],
          music: data.music || data.audioName || 'Original Audio'
        };
      });
      
      setVideos(fetchedVideos);
    });

    return () => unsubscribe();
  }, []);

  // Real-time comment count for current video
  useEffect(() => {
    if (!currentVideo || currentVideo.id.startsWith('local_')) return;

    const commentsRef = collection(db, 'posts', currentVideo.id, 'comments');
    const unsubscribe = onSnapshot(commentsRef, (snapshot) => {
      const actualCount = snapshot.size;
      
      // Update the video in the local state
      setVideos(prevVideos => 
        prevVideos.map(v => 
          v.id === currentVideo.id 
            ? { ...v, commentsCount: actualCount }
            : v
        )
      );
    });

    return () => unsubscribe();
  }, [currentVideo?.id]);

  // Load comments when modal opens
  useEffect(() => {
    if (!showComments || !currentVideo) return;

    setLoadingComments(true);
    const commentsRef = collection(db, 'posts', currentVideo.id, 'comments');
    const q = query(commentsRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedComments: Comment[] = snapshot.docs.map(doc => ({
        id: doc.id,
        text: doc.data().text,
        userId: doc.data().userId,
        username: doc.data().username,
        avatar: doc.data().avatar,
        timestamp: doc.data().timestamp
      }));
      setComments(fetchedComments);
      setLoadingComments(false);
    });

    return () => unsubscribe();
  }, [showComments, currentVideo?.id]);

  // Video controls
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (!isDragging) {
        setCurrentTime(video.currentTime);
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleEnded = () => {
      handleNextVideo();
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, [currentIndex, isDragging]);

  // Auto-play current video
  useEffect(() => {
    const video = videoRef.current;
    if (video && isPlaying) {
      video.play().catch(err => console.log('Autoplay prevented:', err));
    }
  }, [currentIndex, isPlaying]);

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distanceY = touchStart.y - touchEnd.y;
    const distanceX = touchStart.x - touchEnd.x;
    const isVerticalSwipe = Math.abs(distanceY) > Math.abs(distanceX);
    
    if (isVerticalSwipe && Math.abs(distanceY) > minSwipeDistance) {
      if (distanceY > 0) {
        // Swipe up - next video
        handleNextVideo();
      } else {
        // Swipe down - previous video
        handlePrevVideo();
      }
    }
  };

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleMuteToggle = () => {
    const video = videoRef.current;
    if (!video) return;
    
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const progressBar = progressBarRef.current;
    if (!video || !progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * video.duration;
    
    video.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(percentage * 100);
  };

  const handleProgressDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleProgressDrag(e);
  };

  const handleProgressDrag = (e: React.MouseEvent) => {
    if (!isDragging && e.type !== 'mousedown') return;
    
    const video = videoRef.current;
    const progressBar = progressBarRef.current;
    if (!video || !progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = clickX / rect.width;
    const newTime = percentage * video.duration;
    
    video.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(percentage * 100);
  };

  const handleProgressDragEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e: MouseEvent) => handleProgressDrag(e as any);
      const handleMouseUp = () => handleProgressDragEnd();
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  const handleNextVideo = () => {
    if (currentIndex < videos.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
      setCurrentTime(0);
      setShowComments(false);
    }
  };

  const handlePrevVideo = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
      setCurrentTime(0);
      setShowComments(false);
    }
  };

  const handleLike = async () => {
    if (!currentUser || !currentVideo) {
      console.log('Cannot like: missing user or video');
      return;
    }

    const postRef = doc(db, 'posts', currentVideo.id);
    const likesArray = Array.isArray(currentVideo.likes) ? currentVideo.likes : [];
    const isLiked = likesArray.includes(currentUser.uid);

    console.log('Like action:', {
      videoId: currentVideo.id,
      userId: currentUser.uid,
      currentLikes: likesArray,
      isLiked,
      action: isLiked ? 'unlike' : 'like'
    });

    try {
      if (isLiked) {
        await updateDoc(postRef, {
          likes: arrayRemove(currentUser.uid)
        });
        console.log('✅ Unliked successfully');
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(currentUser.uid)
        });
        console.log('✅ Liked successfully');
      }
    } catch (error) {
      console.error('❌ Error liking video:', error);
    }
  };

  const handleSubscribe = async () => {
    if (!currentUser || !currentVideo) return;

    const userRef = doc(db, 'users', currentUser.uid);
    const creatorRef = doc(db, 'users', currentVideo.userId);

    try {
      if (isSubscribed) {
        await updateDoc(userRef, {
          subscriptions: arrayRemove(currentVideo.userId)
        });
        await updateDoc(creatorRef, {
          subscribers: arrayRemove(currentUser.uid)
        });
        setIsSubscribed(false);
      } else {
        await updateDoc(userRef, {
          subscriptions: arrayUnion(currentVideo.userId)
        });
        await updateDoc(creatorRef, {
          subscribers: arrayUnion(currentUser.uid)
        });
        setIsSubscribed(true);
      }
    } catch (error) {
      console.error('Error subscribing:', error);
    }
  };

  const handleCommentSubmit = async () => {
    if (!currentUser || !currentVideo || !newComment.trim()) return;

    try {
      const commentsRef = collection(db, 'posts', currentVideo.id, 'comments');
      await addDoc(commentsRef, {
        text: newComment.trim(),
        userId: currentUser.uid,
        username: currentUser.displayName || 'User',
        avatar: currentUser.photoURL || 'https://ui-avatars.com/api/?name=User',
        timestamp: serverTimestamp()
      });

      setNewComment('');
      
      // The real-time listener will automatically update the count
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  // Show loading only if we haven't loaded any videos yet
  if (videos.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-[100]">
        <div className="text-white text-center">
          <i className="fa-solid fa-circle-notch fa-spin text-4xl mb-4"></i>
          <p>Loading videos...</p>
        </div>
      </div>
    );
  }

  // If we have videos but currentVideo is undefined (shouldn't happen), show error
  if (!currentVideo) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-[100]">
        <div className="text-white text-center">
          <i className="fa-solid fa-exclamation-triangle text-4xl mb-4 text-yellow-500"></i>
          <p>No videos available</p>
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2 bg-accent hover:bg-accent-hover text-white font-bold rounded-full transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black z-[100] overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-[110] flex items-center justify-between p-4">
        <button
          onClick={onToggleSidebar}
          className="w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 text-white/80 hover:text-white bg-black/20 backdrop-blur-md border border-white/10 hover:bg-white/10"
        >
          <i className="fa-solid fa-bars text-xl"></i>
        </button>

        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 text-white/80 hover:text-white bg-black/20 backdrop-blur-md border border-white/10 hover:bg-white/10"
        >
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>
      </div>

      {/* Main Content */}
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Video Container */}
        <div 
          className="relative w-full max-w-[500px] h-full bg-black"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <video
            ref={videoRef}
            src={currentVideo.mediaUrl}
            className="w-full h-full object-contain"
            loop={false}
            playsInline
            muted={isMuted}
            onClick={handlePlayPause}
          />

          {/* Video Overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Bottom Info - Lower position */}
            <div className="absolute bottom-0 left-0 right-0 p-3 pb-10 bg-gradient-to-t from-black/95 via-black/70 to-transparent pointer-events-auto">
              <div className="flex items-center gap-2 mb-1">
                <div className="relative">
                  <img
                    src={currentVideo.user.avatar}
                    alt={currentVideo.user.name}
                    className="w-10 h-10 rounded-full object-cover border-2 border-white"
                  />
                  {/* Subscribe Button on Avatar */}
                  {currentUser?.uid !== currentVideo.userId && (
                    <button
                      onClick={handleSubscribe}
                      className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                        isSubscribed 
                          ? 'bg-gray-500 text-white' 
                          : 'bg-accent text-white'
                      }`}
                    >
                      <i className={`fa-solid ${isSubscribed ? 'fa-check' : 'fa-plus'} text-[10px]`}></i>
                    </button>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm truncate">{currentVideo.user.name}</p>
                  <p className="text-white/70 text-[11px] truncate">{currentVideo.user.handle}</p>
                </div>
              </div>

              <p className="text-white text-xs mb-1 line-clamp-2 leading-tight">{currentVideo.content}</p>

              {currentVideo.music && (
                <div className="flex items-center gap-1.5 text-white/60 text-[11px]">
                  <i className="fa-solid fa-music text-[10px]"></i>
                  <span className="truncate">{currentVideo.music}</span>
                </div>
              )}
            </div>

            {/* Progress Bar with Scrubber - Very close to bottom */}
            <div className="absolute bottom-1 left-0 right-0 px-3 pointer-events-auto">
              <div className="flex items-center gap-2">
                <span className="text-white text-[9px] font-bold min-w-[32px]">{formatTime(currentTime)}</span>
                <div 
                  ref={progressBarRef}
                  className="flex-1 h-1 bg-white/20 rounded-full cursor-pointer relative group"
                  onClick={handleProgressBarClick}
                  onMouseDown={handleProgressDragStart}
                >
                  <div
                    className="h-full bg-white rounded-full transition-all duration-100 relative"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                </div>
                <span className="text-white text-[9px] font-bold min-w-[32px] text-right">{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Left Action Bar (next to video) - Centered vertically */}
        <div className="absolute left-[calc(50%+260px)] top-1/2 -translate-y-1/2 flex flex-col gap-6 items-center z-[105]">
          {/* Like */}
          <button
            onClick={handleLike}
            className="flex flex-col items-center gap-1"
          >
            <div className={`w-14 h-14 flex items-center justify-center rounded-full transition-all ${
              (Array.isArray(currentVideo.likes) && currentVideo.likes.includes(currentUser?.uid || ''))
                ? 'bg-red-500 text-white'
                : 'bg-white/10 backdrop-blur-sm text-white hover:bg-white/20'
            }`}>
              <i className={`fa-${
                (Array.isArray(currentVideo.likes) && currentVideo.likes.includes(currentUser?.uid || '')) 
                  ? 'solid' 
                  : 'regular'
              } fa-heart text-2xl`}></i>
            </div>
            <span className="text-white text-xs font-bold">
              {formatCount(Array.isArray(currentVideo.likes) ? currentVideo.likes.length : 0)}
            </span>
          </button>

          {/* Comment */}
          <button
            onClick={() => setShowComments(true)}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-14 h-14 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-all">
              <i className="fa-regular fa-comment text-2xl"></i>
            </div>
            <span className="text-white text-xs font-bold">{formatCount(currentVideo.commentsCount || 0)}</span>
          </button>

          {/* Mute Toggle */}
          <button
            onClick={handleMuteToggle}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-14 h-14 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-all">
              <i className={`fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-volume-high'} text-2xl`}></i>
            </div>
          </button>

          {/* Music Disc */}
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center animate-spin-slow">
            <img
              src={currentVideo.user.avatar}
              alt="Music"
              className="w-12 h-12 rounded-full object-cover"
            />
          </div>
        </div>

        {/* Right Navigation Buttons */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-[105]">
          <button
            onClick={handlePrevVideo}
            disabled={currentIndex === 0}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${
              currentIndex === 0
                ? 'bg-white/5 text-white/30 cursor-not-allowed'
                : 'bg-white/10 backdrop-blur-sm text-white hover:bg-white/20'
            }`}
          >
            <i className="fa-solid fa-chevron-up text-xl"></i>
          </button>

          <button
            onClick={handleNextVideo}
            disabled={currentIndex === videos.length - 1}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${
              currentIndex === videos.length - 1
                ? 'bg-white/5 text-white/30 cursor-not-allowed'
                : 'bg-white/10 backdrop-blur-sm text-white hover:bg-white/20'
            }`}
          >
            <i className="fa-solid fa-chevron-down text-xl"></i>
          </button>
        </div>
      </div>

      {/* Comments Modal */}
      {showComments && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="w-full max-w-2xl h-[70vh] bg-[#0A0A0A] rounded-t-3xl border-t border-white/10 flex flex-col animate-[slideUp_0.3s_ease-out]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-white font-bold text-lg">Comments ({currentVideo.commentsCount || 0})</h3>
              <button
                onClick={() => setShowComments(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-all"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingComments ? (
                <div className="flex items-center justify-center py-8">
                  <i className="fa-solid fa-circle-notch fa-spin text-2xl text-white/50"></i>
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <i className="fa-regular fa-comment text-4xl mb-3 opacity-20"></i>
                  <p>No comments yet. Be the first!</p>
                </div>
              ) : (
                comments.map(comment => (
                  <div key={comment.id} className="flex gap-3">
                    <img
                      src={comment.avatar}
                      alt={comment.username}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="flex-1">
                      <p className="text-white font-semibold text-sm">{comment.username}</p>
                      <p className="text-gray-300 text-sm">{comment.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Comment Input */}
            <div className="p-4 border-t border-white/10">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit()}
                  placeholder="Add a comment..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-accent transition-colors"
                />
                <button
                  onClick={handleCommentSubmit}
                  disabled={!newComment.trim()}
                  className="px-6 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-full transition-all"
                >
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedView;
