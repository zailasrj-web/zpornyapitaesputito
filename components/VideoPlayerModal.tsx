import React, { useState, useRef, useEffect } from 'react';
import { Character } from '../types';
import { db, auth } from '../firebase';
import AdBanner from './AdBanner';
import PublicProfileModal from './PublicProfileModal';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  getDoc,
  increment
} from 'firebase/firestore';

interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: Character | null;
  allVideos?: Character[];
  onToggleFavorite?: (videoId: string) => void;
  currentUserId?: string;
  onNavigateToProfile?: () => void;
  onToggleSidebar?: () => void;
}

interface Comment {
  id: string;
  text: string;
  userId: string;
  username: string;
  avatar: string;
  timestamp: any;
}

const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ isOpen, onClose, video, allVideos = [], onToggleFavorite, currentUserId, onNavigateToProfile, onToggleSidebar }) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(true);
  const [videoQuality, setVideoQuality] = useState<'HD' | 'SD'>('HD');
  const [filterType, setFilterType] = useState<'All' | 'Recommended' | 'Recently uploaded' | 'Watched'>('All');
  
  // Real Interaction State
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  
  // Real Comments State
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [subscribersCount, setSubscribersCount] = useState(0);
  
  // Profile Modal State
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (isOpen && video) {
        // Reset basic state
        setIsPlaying(true);
        setProgress(0);
        setIsSubscribed(false);
        setIsLiked(false);
        setIsDisliked(false);
        setCommentText('');
        
        // Autoplay logic
        if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(e => console.log("Autoplay prevented", e));
        }

        // --- FETCH REAL COMMENTS ---
        if (!video.id.startsWith('local_')) {
            setLoadingComments(true);
            const q = query(collection(db, "posts", video.id, "comments"), orderBy("timestamp", "desc"));
            const unsubscribeComments = onSnapshot(q, (snapshot) => {
                const fetched: Comment[] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Comment));
                setComments(fetched);
                setLoadingComments(false);
            });

            return () => unsubscribeComments();
        } else {
            setComments([]);
        }
    }
  }, [isOpen, video]);

  // --- FETCH SUBSCRIPTION STATUS ---
  useEffect(() => {
      if (isOpen && video && video.authorId) {
          const authorRef = doc(db, "users", video.authorId);
          
          // Use getDoc for initial load (faster than onSnapshot)
          getDoc(authorRef).then((docSnap) => {
              if (docSnap.exists()) {
                  const data = docSnap.data();
                  const followers = data.followers || [];
                  
                  if (Array.isArray(followers)) {
                      setSubscribersCount(followers.length);
                      if (currentUser) {
                          setIsSubscribed(followers.includes(currentUser.uid));
                      }
                  } else {
                      setSubscribersCount(0);
                  }
              } else {
                  setSubscribersCount(0);
              }
          }).catch(() => {
              setSubscribersCount(0);
          });
          
          // Then listen for real-time updates
          const unsubscribeAuthor = onSnapshot(authorRef, (docSnap) => {
              if (docSnap.exists()) {
                  const data = docSnap.data();
                  const followers = data.followers || [];
                  
                  if (Array.isArray(followers)) {
                      setSubscribersCount(followers.length);
                      if (currentUser) {
                          setIsSubscribed(followers.includes(currentUser.uid));
                      }
                  }
              }
          });
          
          return () => unsubscribeAuthor();
      } else {
          setSubscribersCount(0);
          setIsSubscribed(false);
      }
  }, [isOpen, video, currentUser]);

  // --- CHECK IF VIDEO IS IN FAVORITES ---
  useEffect(() => {
      if (isOpen && video && currentUserId && !video.id.startsWith('local_')) {
          const favoriteRef = doc(db, "users", currentUserId, "favorites", video.id);
          
          const unsubscribeFavorite = onSnapshot(favoriteRef, (docSnap) => {
              setIsFavorited(docSnap.exists());
          });
          
          return () => unsubscribeFavorite();
      } else {
          setIsFavorited(false);
      }
  }, [isOpen, video, currentUserId]);

  // --- SYNC LIKES IN REAL-TIME ---
  useEffect(() => {
      if (isOpen && video && !video.id.startsWith('local_')) {
          const videoRef = doc(db, "posts", video.id);
          
          const unsubscribeLikes = onSnapshot(videoRef, (docSnap) => {
              if (docSnap.exists()) {
                  const data = docSnap.data();
                  const likesArray = data.likes || [];
                  setLikesCount(likesArray.length);
                  
                  // Check if current user has liked
                  if (currentUser) {
                      setIsLiked(likesArray.includes(currentUser.uid));
                  }
              }
          });
          
          return () => unsubscribeLikes();
      } else {
          setLikesCount(0);
          setIsLiked(false);
      }
  }, [isOpen, video, currentUser]);

  // Spacebar to Toggle Play
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.code === 'Space') {
        // Prevent toggling if user is typing in comment input
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
            return;
        }
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Block body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      setProgress((current / total) * 100);
      setDuration(total);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = (val / 100) * videoRef.current.duration;
      setProgress(val);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const toggleMute = () => {
      if (videoRef.current) {
          videoRef.current.muted = !isMuted;
          setIsMuted(!isMuted);
          if (isMuted) setVolume(1);
          else setVolume(0);
      }
  };

  const toggleFullscreen = () => {
      if (videoRef.current) {
          if (document.fullscreenElement) {
              document.exitFullscreen();
          } else {
              videoRef.current.requestFullscreen();
          }
      }
  };

  // --- ACTIONS ---

  const handleSubscribe = async () => {
      if (!currentUser) return alert("Please login to subscribe");
      if (!video?.authorId) return;

      const authorRef = doc(db, "users", video.authorId);
      try {
          if (isSubscribed) {
              await updateDoc(authorRef, { followers: arrayRemove(currentUser.uid) });
          } else {
              await updateDoc(authorRef, { followers: arrayUnion(currentUser.uid) });
          }
      } catch (e) {
          console.error("Subscription error", e);
      }
  };

  const handlePostComment = async () => {
      if (!currentUser) return alert("Please login to comment");
      if (!video?.id || !commentText.trim()) return;

      try {
          await addDoc(collection(db, "posts", video.id, "comments"), {
              text: commentText,
              userId: currentUser.uid,
              username: currentUser.displayName || "User",
              avatar: currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.email}`,
              timestamp: serverTimestamp()
          });
          
          // Increment comment count in the post document
          const postRef = doc(db, "posts", video.id);
          await updateDoc(postRef, {
              commentCount: increment(1)
          });
          
          setCommentText('');
      } catch (e) {
          console.error("Comment error", e);
      }
  };

  const handleLike = async () => {
      if (!currentUser) {
          alert("Please login to like videos");
          return;
      }
      if (!video?.id || video.id.startsWith('local_')) return;

      const videoRef = doc(db, "posts", video.id);
      
      try {
          if (isLiked) {
              // Remove like
              await updateDoc(videoRef, {
                  likes: arrayRemove(currentUser.uid)
              });
          } else {
              // Add like
              await updateDoc(videoRef, {
                  likes: arrayUnion(currentUser.uid)
              });
          }
      } catch (error) {
          console.error("Error toggling like:", error);
      }
  };

  if (!isOpen || !video) return null;

  const authorName = video.authorName || "poorn Creator";
  const authorAvatar = video.authorAvatar || `https://ui-avatars.com/api/?name=${authorName}`;
  const views = video.views ? `${video.views} views` : "1.2K views";
  const date = "Oct 24, 2024"; // Mock date

  return (
    <div className="fixed inset-0 z-40 bg-[#0F0F0F] overflow-y-auto font-sans text-white">
      {/* --- HEADER (YouTube Style) --- */}
      <div className="sticky top-0 z-50 bg-[#0F0F0F]/95 backdrop-blur-sm flex justify-between items-center px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-4">
              <button 
                  onClick={(e) => {
                      e.stopPropagation();
                      if (onToggleSidebar) {
                          onToggleSidebar();
                      }
                  }} 
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                  <i className="fa-solid fa-bars text-xl text-white"></i>
              </button>
              <div className="flex items-center gap-2 cursor-pointer" onClick={onClose}>
                  <img 
                      alt="Zpoorn Logo" 
                      className="w-8 h-8 object-contain" 
                      src="https://res.cloudinary.com/dbfza2zyk/image/upload/v1768852307/ZZPO_lmy5e2.png"
                  />
                  <span className="font-bold text-lg tracking-tight text-white hidden sm:block">poorn</span>
              </div>
          </div>

          <div className="flex-1 max-w-2xl mx-4 hidden md:flex">
              <div className="flex w-full">
                  <input 
                    type="text" 
                    placeholder="Search" 
                    className="w-full bg-[#121212] border border-[#303030] rounded-l-full px-4 py-2 focus:outline-none focus:border-blue-500 placeholder-gray-500 text-sm"
                  />
                  <button className="bg-[#222222] border border-l-0 border-[#303030] px-5 py-2 rounded-r-full hover:bg-[#303030] transition-colors">
                      <i className="fa-solid fa-magnifying-glass text-gray-400"></i>
                  </button>
              </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              <div className="flex items-center gap-2 md:gap-3 animate-[fadeIn_0.3s_ease-out]">
                  <div 
                      className="flex items-center gap-2 pl-1 pr-3 py-1 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors cursor-pointer group select-none relative"
                      onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                          if (onNavigateToProfile) {
                              setTimeout(() => onNavigateToProfile(), 100);
                          }
                      }}
                  >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent to-purple-400 p-[1px] relative">
                          <img 
                              alt="Profile" 
                              className="w-full h-full rounded-full object-cover" 
                              src={currentUser?.photoURL || "https://ui-avatars.com/api/?name=User"}
                          />
                          <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-black transform translate-y-1/4 translate-x-1/4"></span>
                      </div>
                      <div className="flex flex-col justify-center">
                          <span className="text-xs md:text-sm font-semibold text-white max-w-[100px] md:max-w-[150px] truncate leading-none">
                              {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User'}
                          </span>
                      </div>
                  </div>
                  <button 
                      onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
                              onClose();
                              setTimeout(() => {
                                  const logoutBtn = document.querySelector('[data-action="logout"]') as HTMLElement;
                                  if (logoutBtn) logoutBtn.click();
                              }, 100);
                          }
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/50 transition-all" 
                      title="Logout"
                  >
                      <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
                  </button>
              </div>
          </div>
      </div>

      {/* --- MAIN CONTENT GRID --- */}
      <div className="max-w-[1700px] mx-auto p-0 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN: PLAYER & INFO */}
          <div className="lg:col-span-2 space-y-4">
              
              {/* VIDEO PLAYER CONTAINER */}
              <div className="relative w-full aspect-video bg-black group shadow-2xl">
                  <video 
                      ref={videoRef}
                      src={video.videoUrl} 
                      className="w-full h-full object-contain"
                      onTimeUpdate={handleTimeUpdate}
                      onClick={togglePlay}
                      muted={isMuted}
                      playsInline
                  />
                  
                  {/* Custom Controls Overlay - Video.js Style */}
                  <div 
                    className="absolute inset-0 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-black/90 via-transparent to-transparent"
                  >
                      {/* Clickable area for play/pause (everything except controls) */}
                      <div 
                        className="absolute inset-0 cursor-pointer"
                        onClick={togglePlay}
                        style={{ bottom: '60px' }}
                      />
                      
                      {/* Controls Bottom Bar - No propagation needed */}
                      <div className="w-full bg-black/40 backdrop-blur-sm relative z-10">
                          
                          {/* Progress Bar - Integrated at top of control bar */}
                          <div className="relative px-2 pt-2 pb-1 cursor-pointer group/progress">
                              <div className="relative h-1 bg-white/20 rounded-full overflow-visible">
                                  {/* Loaded Progress */}
                                  <div className="absolute inset-0 bg-white/30 rounded-full" style={{ width: '100%' }}></div>
                                  
                                  {/* Play Progress */}
                                  <div 
                                      className="absolute inset-y-0 left-0 bg-[#9333EA] rounded-full transition-all"
                                      style={{ width: `${progress}%` }}
                                  ></div>
                                  
                                  {/* Progress Thumb - Centered on bar */}
                                  <div 
                                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#9333EA] rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity pointer-events-none shadow-lg"
                                      style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
                                  ></div>
                                  
                                  {/* Hover Input */}
                                  <input 
                                      type="range" 
                                      min="0" 
                                      max="100" 
                                      value={progress} 
                                      onChange={handleSeek}
                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                      style={{ top: '-4px', height: '16px' }}
                                  />
                              </div>
                          </div>

                          {/* Controls Row */}
                          <div className="flex items-center justify-between px-3 py-2.5 gap-2">
                              {/* Left Controls */}
                              <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                                  {/* Play/Pause */}
                                  <button 
                                      onClick={togglePlay} 
                                      className="text-white hover:text-gray-300 transition-colors flex-shrink-0" 
                                      title={isPlaying ? 'Pause' : 'Play'}
                                  >
                                      <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-lg`}></i>
                                  </button>

                                  {/* Volume Panel */}
                                  <div className="flex items-center gap-1.5 group/vol flex-shrink-0">
                                      <button 
                                          onClick={toggleMute} 
                                          className="text-white hover:text-gray-300 transition-colors" 
                                          title={isMuted ? 'Unmute' : 'Mute'}
                                      >
                                          <i className={`fa-solid ${isMuted || volume === 0 ? 'fa-volume-xmark' : volume < 0.5 ? 'fa-volume-low' : 'fa-volume-high'} text-base`}></i>
                                      </button>
                                      <div className="w-0 overflow-hidden group-hover/vol:w-16 md:group-hover/vol:w-20 transition-all duration-200">
                                          <div className="relative h-1 bg-white/30 rounded-full w-16 md:w-20">
                                              <div 
                                                  className="absolute inset-y-0 left-0 bg-white rounded-full"
                                                  style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                                              ></div>
                                              <input 
                                                  type="range" 
                                                  min="0" max="1" step="0.01" 
                                                  value={isMuted ? 0 : volume} 
                                                  onChange={(e) => {
                                                      const vol = parseFloat(e.target.value);
                                                      setVolume(vol);
                                                      setIsMuted(vol === 0);
                                                      if(videoRef.current) videoRef.current.volume = vol;
                                                  }}
                                                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                                                  title="Volume Level"
                                              />
                                          </div>
                                      </div>
                                  </div>

                                  {/* Current Time */}
                                  <div className="text-[11px] md:text-xs text-white font-medium whitespace-nowrap flex-shrink-0">
                                      {formatTime(videoRef.current?.currentTime || 0)}
                                  </div>

                                  {/* Time Divider */}
                                  <div className="text-[11px] md:text-xs text-white/50 flex-shrink-0">/</div>

                                  {/* Duration */}
                                  <div className="text-[11px] md:text-xs text-white font-medium whitespace-nowrap flex-shrink-0">
                                      {formatTime(duration)}
                                  </div>

                                  {/* Progress Bar (Mobile Alternative - Hidden on Desktop) */}
                                  <div className="flex-1 min-w-0 md:hidden"></div>
                              </div>

                              {/* Right Controls */}
                              <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                                  {/* Remaining Time */}
                                  <div className="text-[11px] md:text-xs text-white/80 font-medium whitespace-nowrap hidden lg:block">
                                      -{formatTime(duration - (videoRef.current?.currentTime || 0))}
                                  </div>

                                  {/* Quality Selector (HD/SD) */}
                                  <button 
                                      className="text-white hover:text-gray-300 transition-colors hidden sm:flex items-center gap-1 px-2 py-1 bg-white/10 rounded hover:bg-white/20" 
                                      title={`Switch to ${videoQuality === 'HD' ? 'SD' : 'HD'}`}
                                      onClick={async () => {
                                          if (!videoRef.current) return;
                                          
                                          // Save current state
                                          const currentTime = videoRef.current.currentTime;
                                          const wasPlaying = !videoRef.current.paused;
                                          
                                          // Change quality
                                          const newQuality = videoQuality === 'HD' ? 'SD' : 'HD';
                                          setVideoQuality(newQuality);
                                          
                                          // In a real implementation with different quality sources:
                                          // const newSrc = newQuality === 'HD' ? hdSource : sdSource;
                                          // videoRef.current.src = newSrc;
                                          
                                          // Wait for video to be ready and restore playback
                                          if (wasPlaying) {
                                              try {
                                                  await new Promise(resolve => setTimeout(resolve, 100));
                                                  videoRef.current.currentTime = currentTime;
                                                  await videoRef.current.play();
                                                  setIsPlaying(true);
                                              } catch (e) {
                                                  console.log("Quality change playback:", e);
                                              }
                                          } else {
                                              videoRef.current.currentTime = currentTime;
                                          }
                                          
                                          console.log(`Quality changed to ${newQuality} at ${currentTime.toFixed(1)}s`);
                                      }}
                                  >
                                      <span className="text-[10px] font-bold">{videoQuality}</span>
                                  </button>

                                  {/* Picture-in-Picture */}
                                  <button 
                                      className="text-white hover:text-gray-300 transition-colors hidden md:block" 
                                      title="Picture-in-Picture"
                                      onClick={() => {
                                          if (document.pictureInPictureEnabled && videoRef.current) {
                                              if (document.pictureInPictureElement) {
                                                  document.exitPictureInPicture();
                                              } else {
                                                  videoRef.current.requestPictureInPicture();
                                              }
                                          }
                                      }}
                                  >
                                      <i className="fa-solid fa-tv text-base"></i>
                                  </button>

                                  {/* Fullscreen */}
                                  <button 
                                      onClick={toggleFullscreen} 
                                      className="text-white hover:text-gray-300 transition-colors" 
                                      title="Fullscreen"
                                  >
                                      <i className="fa-solid fa-expand text-base"></i>
                                  </button>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Ad Banner Below Video Info */}
              <div className="px-4 md:px-0">
                <div className="w-full flex justify-center py-4 bg-[#151515] border border-white/10 rounded-lg">
                  <AdBanner 
                    zoneId="YOUR_VIDEO_BANNER_ZONE_ID" 
                    format="banner" 
                    width={728} 
                    height={90}
                  />
                </div>
              </div>
              <div className="px-4 md:px-0">
                  <h1 className="text-xl md:text-2xl font-bold text-white mb-2 line-clamp-2">{video.name}</h1>
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                      {/* Channel Info */}
                      <div className="flex items-center gap-4">
                          <img 
                              src={authorAvatar} 
                              className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity" 
                              alt="Channel"
                              onClick={() => video.authorId && setViewingProfileId(video.authorId)}
                          />
                          <div>
                              <h3 
                                  className="text-sm font-bold text-white flex items-center gap-1 cursor-pointer hover:text-gray-300"
                                  onClick={() => video.authorId && setViewingProfileId(video.authorId)}
                              >
                                  {authorName} <i className="fa-solid fa-circle-check text-gray-400 text-xs"></i>
                              </h3>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                              <button 
                                  onClick={handleSubscribe}
                                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                                      isSubscribed 
                                      ? 'bg-[#272727] text-gray-300 hover:bg-[#3F3F3F]' 
                                      : 'bg-[#9333EA] hover:bg-[#7C3AED] text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]'
                                  }`}
                              >
                                  {isSubscribed ? 'SUBSCRIBED' : 'SUBSCRIBE'}
                              </button>
                              <span className="text-xs font-medium text-gray-300">
                                  {subscribersCount > 0 ? subscribersCount.toLocaleString() : '0'}
                              </span>
                          </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                          <div className="flex bg-[#272727] rounded-full overflow-hidden">
                              <button 
                                  onClick={handleLike}
                                  className={`flex items-center gap-2 px-4 py-2 hover:bg-[#3F3F3F] transition-colors border-r border-[#3F3F3F] ${isLiked ? 'text-blue-400' : 'text-white'}`}
                              >
                                  <i className={`fa-regular fa-thumbs-up ${isLiked ? 'font-bold' : ''}`}></i> 
                                  <span className="text-sm font-bold">{likesCount}</span>
                              </button>
                              <button 
                                  onClick={() => setIsDisliked(!isDisliked)}
                                  className={`px-4 py-2 hover:bg-[#3F3F3F] transition-colors ${isDisliked ? 'text-white' : 'text-white'}`}
                              >
                                  <i className={`fa-regular fa-thumbs-down ${isDisliked ? 'font-bold' : ''}`}></i>
                              </button>
                          </div>

                          <button className="flex items-center gap-2 bg-[#272727] hover:bg-[#3F3F3F] text-white px-4 py-2 rounded-full text-sm font-bold transition-colors">
                              <i className="fa-solid fa-share"></i> Share
                          </button>
                          
                          <button 
                              onClick={() => {
                                  if (!currentUser) {
                                      alert('Please login to save favorites');
                                      return;
                                  }
                                  if (video && onToggleFavorite) {
                                      onToggleFavorite(video.id);
                                  }
                              }}
                              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                                  isFavorited 
                                      ? 'bg-accent hover:bg-accent-hover text-white' 
                                      : 'bg-[#272727] hover:bg-[#3F3F3F] text-white'
                              }`}
                          >
                              <i className={`${isFavorited ? 'fa-solid' : 'fa-regular'} fa-heart`}></i> 
                              {isFavorited ? 'Saved' : 'Save'}
                          </button>

                          <button className="bg-[#272727] hover:bg-[#3F3F3F] text-white w-9 h-9 rounded-full flex items-center justify-center transition-colors">
                              <i className="fa-solid fa-ellipsis"></i>
                          </button>
                      </div>
                  </div>

                  {/* Description Box */}
                  <div className="mt-4 bg-[#272727] rounded-xl p-3 text-sm hover:bg-[#3F3F3F] transition-colors cursor-pointer group">
                      <p className="font-bold mb-1 text-white">{views} • {date}</p>
                      {video?.description ? (
                          <p className="text-white whitespace-pre-wrap leading-relaxed line-clamp-3 group-hover:line-clamp-none">
                              {video.description}
                          </p>
                      ) : (
                          <p className="text-gray-500 italic text-sm">
                              No description provided
                          </p>
                      )}
                  </div>

                  {/* Comments Section (REAL) */}
                  <div className="mt-6 hidden md:block">
                      <div className="flex items-center gap-8 mb-6">
                          <h3 className="text-xl font-bold">{comments.length} Comments</h3>
                          <button className="flex items-center gap-2 text-sm font-bold text-gray-300"><i className="fa-solid fa-arrow-down-short-wide"></i> Sort by</button>
                      </div>
                      
                      {/* Comment Input */}
                      <div className="flex gap-4 mb-8">
                          <img src={currentUser?.photoURL || "https://ui-avatars.com/api/?name=Me"} className="w-10 h-10 rounded-full object-cover" />
                          <div className="flex-1">
                              <input 
                                type="text" 
                                placeholder="Add a comment..." 
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                                className="w-full bg-transparent border-b border-white/20 text-white text-sm pb-1 focus:outline-none focus:border-white transition-colors" 
                              />
                              <div className="flex justify-end mt-2">
                                <button 
                                    onClick={handlePostComment}
                                    disabled={!commentText.trim()}
                                    className="px-3 py-1.5 bg-[#272727] hover:bg-[#3F3F3F] text-white text-xs font-bold rounded-full transition-colors disabled:opacity-50"
                                >
                                    Comment
                                </button>
                              </div>
                          </div>
                      </div>

                      {/* Comments List */}
                      {loadingComments ? (
                          <div className="text-center text-gray-500 py-4"><i className="fa-solid fa-circle-notch fa-spin"></i> Loading comments...</div>
                      ) : comments.length === 0 ? (
                          <div className="text-gray-500 text-sm py-4">No comments yet.</div>
                      ) : (
                          comments.map(comment => (
                              <div key={comment.id} className="flex gap-4 mb-6">
                                  <img src={comment.avatar || `https://ui-avatars.com/api/?name=${comment.username}`} className="w-10 h-10 rounded-full object-cover" />
                                  <div>
                                      <div className="flex items-center gap-2 mb-1">
                                          <span className="text-xs font-bold text-white">@{comment.username}</span>
                                          <span className="text-xs text-gray-400">
                                              {/* Simple timestamp format */}
                                              {comment.timestamp ? 'Recent' : 'Just now'}
                                          </span>
                                      </div>
                                      <p className="text-sm text-white mb-2">{comment.text}</p>
                                      <div className="flex items-center gap-4">
                                          <button className="text-gray-400 hover:text-white flex items-center gap-2 text-xs"><i className="fa-regular fa-thumbs-up"></i></button>
                                          <button className="text-gray-400 hover:text-white"><i className="fa-regular fa-thumbs-down text-xs"></i></button>
                                          <button className="text-gray-400 hover:text-white text-xs font-bold">Reply</button>
                                      </div>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>

          {/* RIGHT COLUMN: RECOMMENDATIONS */}
          <div className="hidden lg:block space-y-3">
              {/* Category Pills */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {[
                    { key: 'All', label: 'All' },
                    { key: 'Recommended', label: 'Recommended' },
                    { key: 'Recently uploaded', label: 'Recently uploaded' },
                    { key: 'Watched', label: 'Watched' }
                  ].map(cat => (
                      <button 
                          key={cat.key} 
                          onClick={() => setFilterType(cat.key as any)}
                          className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              filterType === cat.key 
                                  ? 'bg-white text-black' 
                                  : 'bg-[#272727] text-white hover:bg-[#3F3F3F]'
                          }`}
                      >
                          {cat.label}
                      </button>
                  ))}
              </div>

              {/* Video List */}
              {(() => {
                  let filteredVideos = allVideos.filter(v => v.id !== video?.id); // Exclude current video
                  
                  if (filterType === 'Recommended' && video) {
                      // Filter by same category or similar tags
                      filteredVideos = filteredVideos.filter(v => 
                          v.category === video.category
                      ).slice(0, 10);
                  } else if (filterType === 'Recently uploaded') {
                      // Sort by most recent (assuming newer IDs are more recent)
                      filteredVideos = [...filteredVideos].reverse().slice(0, 10);
                  } else if (filterType === 'Watched') {
                      // For now, show empty or random selection
                      // TODO: Implement watch history tracking
                      filteredVideos = filteredVideos.slice(0, 5);
                  } else {
                      // All - show all videos
                      filteredVideos = filteredVideos.slice(0, 10);
                  }
                  
                  return filteredVideos.length > 0 ? (
                      filteredVideos.map((v, i) => (
                          <div 
                              key={v.id} 
                              className="flex gap-2 cursor-pointer group"
                              onClick={() => {
                                  onClose();
                                  setTimeout(() => {
                                      // This will trigger the parent to open the new video
                                      window.dispatchEvent(new CustomEvent('openVideo', { detail: v }));
                                  }, 100);
                              }}
                          >
                              <div className="relative w-40 h-24 flex-shrink-0 bg-gray-800 rounded-lg overflow-hidden">
                                  <img src={v.image} className="w-full h-full object-cover" alt={v.name} />
                                  <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-bold px-1 rounded">
                                      {v.duration || '10:00'}
                                  </span>
                              </div>
                              <div className="flex flex-col gap-1">
                                  <h4 className="text-sm font-bold text-white line-clamp-2 leading-tight group-hover:text-gray-300">
                                      {v.name}
                                  </h4>
                                  <div className="text-xs text-gray-400">
                                      <p>{v.authorName || v.creator || 'poorn Creator'}</p>
                                      <p>{v.views} views • {v.category}</p>
                                  </div>
                              </div>
                          </div>
                      ))
                  ) : (
                      <div className="text-center py-8 text-gray-500 text-sm">
                          {filterType === 'Watched' ? 'No watch history yet' : 'No videos found'}
                      </div>
                  )
              })()}
          </div>

      </div>
      
      {/* Public Profile Modal */}
      {viewingProfileId && (
        <PublicProfileModal
          isOpen={!!viewingProfileId}
          onClose={() => setViewingProfileId(null)}
          userId={viewingProfileId}
          onMessage={() => {
            // Close profile modal and video modal, then navigate to chat
            setViewingProfileId(null);
            onClose();
            // Dispatch event to navigate to chat with this user
            window.dispatchEvent(new CustomEvent('openChat', { 
              detail: { 
                userId: viewingProfileId,
                userName: video.authorName || 'User'
              } 
            }));
          }}
        />
      )}
    </div>
  );
};

export default VideoPlayerModal;