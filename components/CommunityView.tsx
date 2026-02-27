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
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  getDocs,
  increment
} from 'firebase/firestore';

// Cloudinary Configuration
const CLOUD_NAME = 'dbfza2zyk';
const UPLOAD_PRESET = 'poorn_default'; 

interface Comment {
    id: string;
    text: string;
    userId: string;
    username: string;
    avatar: string;
    timestamp: any;
}

interface Post {
  id: string;
  userId: string;
  user: {
    name: string;
    handle: string;
    avatar: string;
    isVerified?: boolean;
  };
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  timestamp: any;
  likes: string[]; // Array of user UIDs
  commentsCount: number;
  tags: string[];
  isHidden?: boolean;
}

interface Creator {
  id: number;
  name: string;
  handle: string;
  avatar: string;
  followers: string;
}

const TRENDING_CREATORS: Creator[] = [
  { id: 1, name: "Klara S.", handle: "@klara_art", avatar: "https://i.pravatar.cc/150?u=klara", followers: "450K" },
  { id: 2, name: "DevX", handle: "@dev_x_model", avatar: "https://i.pravatar.cc/150?u=dev", followers: "210K" },
  { id: 3, name: "SynthWave", handle: "@synth_wave", avatar: "https://i.pravatar.cc/150?u=synth", followers: "180K" },
];

interface CommunityViewProps {
  isAdmin?: boolean;
  currentUser?: User | any;
}

const CommunityView: React.FC<CommunityViewProps> = ({ isAdmin = false, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'events'>('feed');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create Post State
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostMedia, setNewPostMedia] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Comments State
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  
  // Menu State
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const closeMenu = () => setActiveMenuPostId(null);

  // --- 1. FETCH POSTS (Realtime) ---
  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts: Post[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Post));
      setPosts(fetchedPosts);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- 2. FETCH COMMENTS ---
  useEffect(() => {
      if (activeCommentPostId) {
          setLoadingComments(true);
          const q = query(collection(db, "posts", activeCommentPostId, "comments"), orderBy("timestamp", "asc"));
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
  }, [activeCommentPostId]);


  // --- 3. CREATE POST LOGIC ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setNewPostMedia(file);
          setMediaPreview(URL.createObjectURL(file));
      }
  };

  const uploadMedia = async (file: File): Promise<{ url: string, type: 'image' | 'video' }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    // Let Cloudinary detect if it's video or image
    const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
    
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
        method: 'POST',
        body: formData
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return { url: data.secure_url, type: resourceType };
  };

  const handleCreatePost = async () => {
      if (!currentUser) return alert("Please login to post.");
      if (!newPostContent.trim() && !newPostMedia) return;

      setIsUploading(true);
      try {
          let mediaData = null;
          if (newPostMedia) {
              mediaData = await uploadMedia(newPostMedia);
          }

          // Extract tags (simple implementation)
          const tags = newPostContent.match(/#[\w]+/g)?.map(t => t.substring(1)) || [];
          
          // Enforce clean username/handle
          const rawName = currentUser.displayName || "Anonymous";
          const cleanName = rawName.replace(/\s+/g, '_');
          const cleanHandle = currentUser.email ? `@${currentUser.email.split('@')[0].replace(/\s+/g, '_')}` : "@user";


          await addDoc(collection(db, "posts"), {
              userId: currentUser.uid,
              user: {
                  name: cleanName,
                  handle: cleanHandle,
                  avatar: currentUser.photoURL || `https://ui-avatars.com/api/?name=${cleanName}`,
                  isVerified: false
              },
              content: newPostContent,
              mediaUrl: mediaData?.url || null,
              mediaType: mediaData?.type || null,
              timestamp: serverTimestamp(),
              likes: [],
              commentsCount: 0,
              tags: tags,
              isHidden: false,
              source: 'community' // Mark as community post - won't appear in Feed/Explore
          });

          // Reset Form
          setNewPostContent('');
          setNewPostMedia(null);
          setMediaPreview(null);
          if (fileInputRef.current) fileInputRef.current.value = '';

      } catch (error) {
          console.error("Error creating post:", error);
          alert("Failed to create post. Try again.");
      } finally {
          setIsUploading(false);
      }
  };

  // --- 4. INTERACTIONS (Like, Comment, Admin) ---

  const handleLike = async (post: Post) => {
      if (!currentUser) return;
      const postRef = doc(db, "posts", post.id);
      const isLiked = post.likes.includes(currentUser.uid);

      if (isLiked) {
          await updateDoc(postRef, { likes: arrayRemove(currentUser.uid) });
      } else {
          await updateDoc(postRef, { likes: arrayUnion(currentUser.uid) });
      }
  };

  const handleSendComment = async () => {
      if (!currentUser || !activeCommentPostId || !newCommentText.trim()) return;
      
      const rawName = currentUser.displayName || "User";
      const cleanName = rawName.replace(/\s+/g, '_');

      try {
          // Add comment to subcollection
          await addDoc(collection(db, "posts", activeCommentPostId, "comments"), {
              text: newCommentText,
              userId: currentUser.uid,
              username: cleanName,
              avatar: currentUser.photoURL || "",
              timestamp: serverTimestamp()
          });

          // Update comment count on main post
          const postRef = doc(db, "posts", activeCommentPostId);
          await updateDoc(postRef, { 
              commentCount: increment(1) 
          });
          
          setNewCommentText("");
      } catch (error) {
          console.error("Error commenting:", error);
      }
  };

  // --- 5. ADMIN ACTIONS ---

  const handleDelete = async (postId: string) => {
    if (confirm("Are you sure you want to delete this post? This cannot be undone.")) {
        try {
            await deleteDoc(doc(db, "posts", postId));
        } catch (e) {
            console.error("Error deleting:", e);
        }
    }
    closeMenu();
  };

  const handleHide = async (postId: string, currentStatus?: boolean) => {
    try {
        await updateDoc(doc(db, "posts", postId), {
            isHidden: !currentStatus
        });
    } catch (e) {
        console.error("Error hiding:", e);
    }
    closeMenu();
  };

  const handleCopyLink = (postId: string) => {
    const link = `https://poorn.ai/post/${postId}`;
    navigator.clipboard.writeText(link).then(() => {
        alert("Link copied to clipboard!"); 
    });
    closeMenu();
  };

  const handleReport = async (postId: string) => {
    if (!currentUser) {
      alert("You must be logged in to report content.");
      closeMenu();
      return;
    }

    const reason = prompt("Please provide a reason for reporting this content:");
    if (!reason || reason.trim() === '') {
      closeMenu();
      return;
    }

    try {
      // Find the post to get details
      const post = posts.find(p => p.id === postId);
      
      await addDoc(collection(db, "reports"), {
        type: 'Community Post',
        content: post?.content || 'Content unavailable',
        postId: postId,
        reason: reason.trim(),
        reporter: currentUser.email || currentUser.uid,
        reporterId: currentUser.uid,
        reportedUser: post?.user?.name || 'Unknown',
        reportedUserId: post?.userId,
        reportedUserEmail: post?.user?.handle || 'Unknown',
        status: 'Pending',
        createdAt: serverTimestamp()
      });
      
      alert("Report submitted successfully. Our team will review it.");
    } catch (error) {
      console.error("Error submitting report:", error);
      alert("Failed to submit report. Please try again.");
    }
    
    closeMenu();
  };

  const startEditing = (post: Post) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
    closeMenu();
  };

  const saveEdit = async () => {
    if (editingPostId) {
        try {
            await updateDoc(doc(db, "posts", editingPostId), {
                content: editContent
            });
            setEditingPostId(null);
            setEditContent("");
        } catch (e) {
            console.error("Error updating:", e);
        }
    }
  };

  // Helper for timestamps
  const formatTime = (timestamp: any) => {
      if (!timestamp) return 'Just now';
      const date = timestamp.toDate();
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      
      if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds/60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds/3600)}h ago`;
      return `${Math.floor(diffInSeconds/86400)}d ago`;
  };

  return (
    <div className="max-w-7xl mx-auto pt-2 pb-20 animate-[fadeIn_0.3s_ease-out] font-sans relative">
      
      {/* --- OPTIONS MODAL OVERLAY --- */}
      {activeMenuPostId !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeMenu} />
             <div className="relative w-full max-w-sm bg-[#1a1a1a] rounded-2xl overflow-hidden shadow-2xl border border-white/5 animate-[scaleIn_0.1s_ease-out]">
                 <button onClick={() => handleReport(activeMenuPostId)} className="w-full py-4 text-center text-red-500 font-bold border-b border-white/10 hover:bg-white/5 transition-colors">Report</button>
                 <div className="flex flex-col">
                    <button onClick={() => closeMenu()} className="w-full py-4 text-center text-white border-b border-white/10 hover:bg-white/5 transition-colors">Not interested</button>
                    <button onClick={() => handleCopyLink(activeMenuPostId)} className="w-full py-4 text-center text-white border-b border-white/10 hover:bg-white/5 transition-colors">Copy link</button>
                    <button onClick={() => closeMenu()} className="w-full py-4 text-center text-white border-b border-white/10 hover:bg-white/5 transition-colors">About this account</button>
                    
                    {isAdmin && (
                        <>
                           <div className="bg-white/5 px-2 py-1 text-[10px] text-gray-500 font-bold text-center uppercase tracking-widest">Admin Controls</div>
                           <button onClick={() => {
                               const post = posts.find(p => p.id === activeMenuPostId);
                               if (post) startEditing(post);
                           }} className="w-full py-3 text-center text-accent font-medium border-b border-white/10 hover:bg-white/5 transition-colors">
                                <i className="fa-solid fa-pen-to-square mr-2"></i> Edit Post
                           </button>
                           
                           <button onClick={() => handleHide(activeMenuPostId, posts.find(p => p.id === activeMenuPostId)?.isHidden)} className="w-full py-3 text-center text-yellow-400 font-medium border-b border-white/10 hover:bg-white/5 transition-colors">
                                <i className={`fa-regular ${posts.find(p => p.id === activeMenuPostId)?.isHidden ? 'fa-eye' : 'fa-eye-slash'} mr-2`}></i> 
                                {posts.find(p => p.id === activeMenuPostId)?.isHidden ? 'Unhide Post' : 'Hide Post'}
                           </button>

                           <button onClick={() => handleDelete(activeMenuPostId)} className="w-full py-3 text-center text-red-400 font-medium border-b border-white/10 hover:bg-white/5 transition-colors">
                                <i className="fa-regular fa-trash-can mr-2"></i> Delete Post
                           </button>
                        </>
                    )}
                 </div>
                 <button onClick={closeMenu} className="w-full py-4 text-center text-gray-400 font-medium hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
             </div>
        </div>
      )}


      {/* Hero Header */}
      <div className="relative rounded-3xl overflow-hidden mb-8 border border-white/10 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-900 to-purple-900 opacity-60"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30"></div>
        <div className="relative p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-2 tracking-tight">
                    Community <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Hub</span>
                </h1>
                <p className="text-gray-200 text-sm md:text-base max-w-xl leading-relaxed">
                    Connect with thousands of creators, share your prompts, discuss techniques, and participate in weekly challenges.
                </p>
            </div>
            <div className="flex gap-3">
                <a 
                    href="https://discord.gg/r3wDycJ3" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold py-3 px-6 rounded-xl hover:bg-white/20 transition-colors flex items-center justify-center"
                >
                    <i className="fa-brands fa-discord mr-2"></i> Join Discord
                </a>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* --- Left Column: Main Feed --- */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* CREATE POST WIDGET */}
            {currentUser && (
                <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-5 shadow-lg">
                    <div className="flex gap-3 mb-4">
                        <img src={currentUser.photoURL || "https://ui-avatars.com/api/?name=User"} className="w-10 h-10 rounded-full object-cover" />
                        <div className="flex-1">
                            <textarea 
                                value={newPostContent}
                                onChange={(e) => setNewPostContent(e.target.value)}
                                placeholder="What's on your mind? Share prompts, videos, or ideas..." 
                                className="w-full bg-transparent border-none text-white text-sm focus:ring-0 placeholder-gray-500 resize-none h-20"
                            />
                            {mediaPreview && (
                                <div className="mt-2 relative w-fit max-w-full">
                                    {newPostMedia?.type.startsWith('video/') ? (
                                        <video src={mediaPreview} controls className="max-h-60 rounded-lg border border-white/10" />
                                    ) : (
                                        <img src={mediaPreview} className="max-h-60 rounded-lg border border-white/10" />
                                    )}
                                    <button 
                                        onClick={() => {
                                            setNewPostMedia(null);
                                            setMediaPreview(null);
                                            if(fileInputRef.current) fileInputRef.current.value = '';
                                        }}
                                        className="absolute -top-2 -right-2 bg-black/80 text-white rounded-full w-6 h-6 flex items-center justify-center border border-white/20 hover:text-red-400"
                                    >
                                        <i className="fa-solid fa-xmark text-xs"></i>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-white/5">
                        <div className="flex gap-2">
                             <input 
                                type="file" 
                                ref={fileInputRef}
                                accept="image/*,video/*" 
                                onChange={handleFileChange} 
                                className="hidden"
                                id="media-upload"
                             />
                             <label htmlFor="media-upload" className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-accent cursor-pointer px-3 py-2 hover:bg-white/5 rounded-lg transition-colors">
                                 <i className="fa-regular fa-image text-sm"></i> Media
                             </label>
                             <button className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-accent cursor-pointer px-3 py-2 hover:bg-white/5 rounded-lg transition-colors">
                                 <i className="fa-solid fa-wand-magic-sparkles text-sm"></i> Generate
                             </button>
                        </div>
                        <button 
                            onClick={handleCreatePost}
                            disabled={isUploading || (!newPostContent.trim() && !newPostMedia)}
                            className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-bold px-6 py-2 rounded-lg transition-all shadow-lg shadow-purple-900/20"
                        >
                            {isUploading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : "Post"}
                        </button>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-6 border-b border-white/10 pb-1 mb-2">
                <button 
                    onClick={() => setActiveTab('feed')}
                    className={`pb-3 text-sm font-bold transition-colors relative ${activeTab === 'feed' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Discussion Feed
                    {activeTab === 'feed' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-accent rounded-t-full"></div>}
                </button>
                <button 
                    onClick={() => setActiveTab('events')}
                    className={`pb-3 text-sm font-bold transition-colors relative ${activeTab === 'events' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Events & Challenges
                    {activeTab === 'events' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-accent rounded-t-full"></div>}
                </button>
            </div>

            {/* Posts */}
            {loading && <div className="text-center py-10 text-gray-500"><i className="fa-solid fa-circle-notch fa-spin text-2xl"></i></div>}
            
            {!loading && posts.length === 0 && <div className="text-center py-10 text-gray-500">No posts yet. Be the first!</div>}

            {posts.map(post => {
                const isAuthor = currentUser?.uid === post.userId;
                const canView = !post.isHidden || isAdmin || isAuthor;

                if (!canView) return null;

                const isLiked = currentUser && post.likes?.includes(currentUser.uid);

                return (
                    <div key={post.id} className={`bg-[#0A0A0A] border rounded-2xl p-5 hover:border-white/20 transition-colors relative ${post.isHidden ? 'border-red-500/30' : 'border-white/10'}`}>
                        
                        {/* Hidden Warning Label */}
                        {post.isHidden && (
                            <div className="absolute top-0 left-0 right-0 bg-red-500/10 border-b border-red-500/20 text-red-400 text-[10px] font-bold px-5 py-1 uppercase tracking-widest flex items-center gap-2 rounded-t-2xl">
                                <i className="fa-solid fa-eye-slash"></i> Hidden Post (Visible only to Admin/Author)
                            </div>
                        )}

                        {/* Post Header */}
                        <div className={`flex justify-between items-start mb-4 ${post.isHidden ? 'mt-6' : ''}`}>
                            <div className="flex items-center gap-3">
                                <img src={post.user.avatar} alt={post.user.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-black" />
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <h3 className="text-sm font-bold text-white hover:underline cursor-pointer">{post.user.name}</h3>
                                        {post.user.isVerified && <i className="fa-solid fa-circle-check text-accent text-xs"></i>}
                                    </div>
                                    <span className="text-xs text-gray-500">{post.user.handle} · {formatTime(post.timestamp)}</span>
                                </div>
                            </div>
                            
                            {/* Kebab Menu Button */}
                            <button 
                                onClick={() => setActiveMenuPostId(post.id)}
                                className="text-gray-500 hover:text-white p-2 rounded-full hover:bg-white/5 transition-colors"
                            >
                                <i className="fa-solid fa-ellipsis"></i>
                            </button>
                        </div>

                        {/* Content (View or Edit Mode) */}
                        {editingPostId === post.id ? (
                            <div className="mb-4">
                                <textarea 
                                    className="w-full bg-black/50 border border-white/20 rounded-xl p-3 text-white text-sm focus:border-accent focus:outline-none min-h-[100px]"
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                />
                                <div className="flex gap-2 mt-2 justify-end">
                                    <button onClick={() => setEditingPostId(null)} className="text-xs font-bold text-gray-400 px-3 py-2 hover:text-white">Cancel</button>
                                    <button onClick={saveEdit} className="text-xs font-bold bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover">Save</button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-gray-200 text-sm leading-relaxed mb-4 whitespace-pre-wrap">
                                {post.content}
                            </p>
                        )}

                        {post.mediaUrl && (
                            <div className="rounded-xl overflow-hidden mb-4 border border-white/5 bg-black">
                                {post.mediaType === 'video' ? (
                                    <video src={post.mediaUrl} controls className="w-full h-auto max-h-[500px]" />
                                ) : (
                                    <img src={post.mediaUrl} alt="Post content" className="w-full h-auto object-cover max-h-[500px]" />
                                )}
                            </div>
                        )}

                        {/* Tags */}
                        {post.tags && post.tags.length > 0 && (
                            <div className="flex gap-2 mb-4 flex-wrap">
                                {post.tags.map((tag, idx) => (
                                    <span key={idx} className="text-[10px] font-medium text-accent bg-accent/10 px-2 py-1 rounded-md">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-between border-t border-white/5 pt-3">
                            <div className="flex gap-6">
                                <button 
                                    onClick={() => handleLike(post)}
                                    className={`flex items-center gap-2 transition-colors text-xs font-medium group ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
                                >
                                    <i className={`${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart text-sm group-hover:scale-110 transition-transform`}></i>
                                    {post.likes?.length || 0}
                                </button>
                                <button 
                                    onClick={() => setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)}
                                    className={`flex items-center gap-2 transition-colors text-xs font-medium group ${activeCommentPostId === post.id ? 'text-blue-400' : 'text-gray-400 hover:text-blue-400'}`}
                                >
                                    <i className="fa-regular fa-comment text-sm group-hover:scale-110 transition-transform"></i>
                                    {/* Placeholder comment count as we are not real-time syncing it on doc yet */}
                                    Comments
                                </button>
                                <button className="flex items-center gap-2 text-gray-400 hover:text-green-400 transition-colors text-xs font-medium group">
                                    <i className="fa-solid fa-share nodes text-sm group-hover:scale-110 transition-transform"></i>
                                    Share
                                </button>
                            </div>
                            <button className="text-gray-500 hover:text-white">
                                <i className="fa-regular fa-bookmark"></i>
                            </button>
                        </div>

                        {/* COMMENTS SECTION */}
                        {activeCommentPostId === post.id && (
                            <div className="mt-4 pt-4 border-t border-white/5 animate-[fadeIn_0.2s_ease-out]">
                                {/* Comment Input */}
                                <div className="flex gap-3 mb-4">
                                    <img src={currentUser?.photoURL || "https://ui-avatars.com/api/?name=User"} className="w-8 h-8 rounded-full" />
                                    <div className="flex-1 flex gap-2">
                                        <input 
                                            type="text" 
                                            value={newCommentText}
                                            onChange={(e) => setNewCommentText(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                                            placeholder="Write a comment..." 
                                            className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                                        />
                                        <button onClick={handleSendComment} className="text-accent hover:text-white transition-colors">
                                            <i className="fa-solid fa-paper-plane"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Comments List */}
                                <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                    {loadingComments ? (
                                        <div className="text-center text-xs text-gray-500">Loading comments...</div>
                                    ) : comments.length === 0 ? (
                                        <div className="text-center text-xs text-gray-500 py-2">No comments yet.</div>
                                    ) : (
                                        comments.map(comment => (
                                            <div key={comment.id} className="flex gap-3">
                                                <img src={comment.avatar} className="w-8 h-8 rounded-full object-cover" />
                                                <div className="flex-1">
                                                    <div className="bg-[#151515] rounded-xl px-3 py-2 border border-white/5 w-fit max-w-full">
                                                        <span className="text-xs font-bold text-white mr-2">{comment.username}</span>
                                                        <span className="text-xs text-gray-300">{comment.text}</span>
                                                    </div>
                                                    <div className="flex gap-3 mt-1 ml-1">
                                                        <span className="text-[10px] text-gray-500">{formatTime(comment.timestamp)}</span>
                                                        <button className="text-[10px] text-gray-500 hover:text-white">Like</button>
                                                        <button className="text-[10px] text-gray-500 hover:text-white">Reply</button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>

        {/* --- Right Column: Sidebar Stats & Creators --- */}
        <div className="hidden lg:flex flex-col gap-6">
            
            {/* Weekly Challenge Card */}
            <div className="bg-gradient-to-br from-[#1a1a1a] to-black border border-accent/30 rounded-2xl p-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                    <i className="fa-solid fa-trophy text-6xl text-accent"></i>
                </div>
                <h3 className="text-xs font-bold text-accent uppercase tracking-wider mb-1">Weekly Challenge</h3>
                <h2 className="text-xl font-bold text-white mb-2">Neon Nights 🌃</h2>
                <p className="text-xs text-gray-400 mb-4 z-10 relative">Create a video featuring urban nightlife with neon aesthetics.</p>
                <div className="flex items-center gap-2 mb-4">
                    <div className="bg-white/10 px-3 py-1 rounded-lg text-xs text-white font-mono border border-white/5">
                        Prize: <span className="text-yellow-400 font-bold">500 Coins</span>
                    </div>
                </div>
                <button className="w-full bg-accent hover:bg-accent-hover text-white text-xs font-bold py-2.5 rounded-lg transition-colors shadow-lg shadow-purple-900/20">
                    Join Challenge
                </button>
            </div>

            {/* Trending Creators */}
            <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-fire text-orange-500"></i> Trending Creators
                </h3>
                <div className="space-y-4">
                    {TRENDING_CREATORS.map(creator => (
                        <div key={creator.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <img src={creator.avatar} alt={creator.name} className="w-9 h-9 rounded-full object-cover" />
                                <div>
                                    <h4 className="text-xs font-bold text-white">{creator.name}</h4>
                                    <p className="text-[10px] text-gray-500">{creator.followers} followers</p>
                                </div>
                            </div>
                            <button className="bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg border border-white/10 transition-colors">
                                Follow
                            </button>
                        </div>
                    ))}
                </div>
                <button className="w-full mt-4 text-xs text-gray-500 hover:text-white transition-colors">
                    View All Creators
                </button>
            </div>

            {/* Popular Topics */}
             <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-4">Popular Topics</h3>
                <div className="flex flex-wrap gap-2">
                    {['#StableDiffusion', '#Tutorial', '#Showcase', '#NSFW', '#Anime', '#Realism', '#Video2Video'].map(tag => (
                        <span key={tag} className="text-[10px] text-gray-400 bg-white/5 hover:bg-white/10 border border-white/5 px-2 py-1 rounded-md cursor-pointer transition-colors">
                            {tag}
                        </span>
                    ))}
                </div>
             </div>

        </div>

      </div>
    </div>
  );
};

export default CommunityView;