import React, { useState } from 'react';
import { Character } from '../types';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { notifyFollowersNewVideo } from '../utils/notificationService';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (video: Character) => void;
}

const CATEGORIES = [
  "General", "Group Chats", "MILF", "Teen", "Asian", "Latina", "Blonde", 
  "Busty", "Submissive", "Dominant", "BDSM", "Romantic", "Athletic"
];

// Configuration for Cloudinary
const CLOUD_NAME = 'dbfza2zyk';
const UPLOAD_PRESET = 'poorn_default'; 

const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onUpload }) => {
  const [destination, setDestination] = useState<'explore' | 'feed'>('explore');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState<string>('');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Only accept video files
      if (!selectedFile.type.startsWith('video/')) {
        alert('❌ Solo se aceptan videos.\n\nFormatos permitidos: .mp4, .mov, .avi, .wmv, .mkv');
        e.target.value = ''; // Clear input
        return;
      }
      
      // Validate video formats
      const allowedVideoFormats = ['.mp4', '.mov', '.avi', '.wmv', '.mkv'];
      const fileExtension = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'));
      
      if (!allowedVideoFormats.includes(fileExtension)) {
        alert(`❌ Formato de video no permitido.\n\nSolo se aceptan: ${allowedVideoFormats.join(', ')}\n\nTu archivo: ${fileExtension}`);
        e.target.value = ''; // Clear input
        return;
      }
      
      // Validate video duration (maximum 25 minutes)
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = function() {
        window.URL.revokeObjectURL(video.src);
        const duration = video.duration; // Duration in seconds
        const durationMinutes = Math.floor(duration / 60);
        const durationSeconds = Math.floor(duration % 60);
        
        // Format duration as MM:SS
        const formattedDuration = `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`;
        
        if (duration > 1500) { // 1500 seconds = 25 minutes
          alert(`❌ El video excede la duración máxima permitida de 25 minutos.\n\nDuración actual: ${formattedDuration} (${durationMinutes} minutos)\nDuración máxima: 25:00 minutos\n\nPor favor, recorta el video antes de subirlo.`);
          e.target.value = ''; // Clear input
          setVideoDuration('');
          return;
        }
        
        // Video is valid
        setFile(selectedFile);
        setTitle(selectedFile.name.split('.')[0].replace(/[-_]/g, ' '));
        setVideoDuration(formattedDuration);
      };
      
      video.onerror = function() {
        alert('❌ Error al leer el video. Por favor intenta con otro archivo.');
        e.target.value = ''; // Clear input
        setVideoDuration('');
      };
      
      video.src = URL.createObjectURL(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    const user = auth.currentUser;
    // For Explore, we generally want users to be logged in too to track ownership
    if (!user) {
        alert("You must be logged in to upload.");
        return;
    }

    setIsLoading(true);
    setUploadProgress(0);

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', UPLOAD_PRESET);
        
        // Determine resource type based on file
        const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
        
        console.log('🚀 Uploading to Cloudinary...');
        console.log('Cloud Name:', CLOUD_NAME);
        console.log('Upload Preset:', UPLOAD_PRESET);
        console.log('Resource Type:', resourceType);
        
        // Use fetch with progress simulation
        const uploadPromise = fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
            method: 'POST',
            body: formData,
        });

        // Simulate progress (since fetch doesn't support upload progress easily)
        const progressInterval = setInterval(() => {
            setUploadProgress(prev => {
                if (prev >= 90) return prev;
                return prev + 10;
            });
        }, 500);

        const response = await uploadPromise;
        clearInterval(progressInterval);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Cloudinary error:', errorText);
            throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        setUploadProgress(100);
        console.log('✅ Upload successful:', data);

        // --- UNIFIED UPLOAD LOGIC ---
        // We save to 'posts' collection for both Explore and Feed.
        
        const contentText = destination === 'explore' ? title : description;
        const finalTitle = title || "Untitled";
        
        // Ensure format: No spaces in handle/name
        const rawName = user.displayName || "Anonymous";
        const cleanName = rawName.replace(/\s+/g, '_');
        const cleanHandle = user.email ? `@${user.email.split('@')[0].replace(/\s+/g, '_')}` : "@user";

        const postData = {
            userId: user.uid,
            user: {
                name: cleanName,
                handle: cleanHandle,
                avatar: user.photoURL || `https://ui-avatars.com/api/?name=${cleanName}`,
                isVerified: false
            },
            title: finalTitle, // Video title
            content: contentText, // Used as Description for Feed, Title context for Explore
            description: description || '', // Video description
            mediaUrl: data.secure_url,
            mediaType: resourceType,
            timestamp: serverTimestamp(),
            likes: [],
            views: 0,
            commentsCount: 0,
            tags: [category.toLowerCase()],
            music: "Original Audio",
            viewPreference: destination // To help filter if needed later
        };

        let docId = "local_" + Date.now();
        
        try {
            const docRef = await addDoc(collection(db, "posts"), postData);
            docId = docRef.id;
            
            // Create or update user document in "users" collection
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                
                if (!userDocSnap.exists()) {
                    // Create new user document
                    await setDoc(userDocRef, {
                        displayName: user.displayName || cleanName,
                        username: cleanName.toLowerCase().replace(/\s+/g, '_'),
                        name: user.displayName || cleanName,
                        handle: cleanName.toLowerCase().replace(/\s+/g, '_'),
                        email: user.email,
                        photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${cleanName}`,
                        avatar: user.photoURL || `https://ui-avatars.com/api/?name=${cleanName}`,
                        coverPhotoURL: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1000&auto=format&fit=crop',
                        bio: '',
                        isVerified: false,
                        createdAt: serverTimestamp(),
                        lastActive: serverTimestamp()
                    });
                    console.log('✅ User document created for:', user.uid);
                } else {
                    // Update last active
                    await updateDoc(userDocRef, {
                        lastActive: serverTimestamp()
                    });
                }
            } catch (userDocError) {
                console.warn('Could not create/update user document:', userDocError);
            }
            
            // Notify followers about new video (only for videos, not images)
            if (resourceType === 'video') {
                await notifyFollowersNewVideo(
                    user.uid,
                    cleanName,
                    user.photoURL || `https://ui-avatars.com/api/?name=${cleanName}`,
                    docRef.id,
                    data.secure_url.replace(/\.[^/.]+$/, ".jpg")
                );
            }
        } catch (dbError: any) {
            console.warn("Firestore write failed (likely permissions or adblock). Proceeding with local update.", dbError);
            if (dbError.message && dbError.message.includes('BLOCKED')) {
                alert("Upload successful locally, but Database connection was blocked by your browser extensions (e.g. AdBlock). Disable them for full functionality.");
            }
        }

        // Map to Character type for immediate local UI feedback
        const newCharacter = {
            id: docId,
            name: finalTitle,
            description: description || undefined,
            duration: resourceType === 'video' ? "VID" : "IMG",
            image: resourceType === 'video' ? (data.secure_url.replace(/\.[^/.]+$/, ".jpg")) : data.secure_url,
            videoUrl: data.secure_url,
            likes: '0',
            views: '0',
            category: category
        };

        onUpload(newCharacter); 

        // Cleanup and Close
        setFile(null);
        setTitle('');
        setDescription('');
        setUploadProgress(0);
        setVideoDuration('');
        onClose();

    } catch (error: any) {
        console.error("Upload error:", error);
        alert(`Error: ${error.message}`);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-sans">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl animate-[fadeIn_0.3s_ease-out] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
            <h3 className="text-lg font-bold text-white">Create New Post</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                <i className="fa-solid fa-xmark text-lg"></i>
            </button>
        </div>

        <div className="p-6 space-y-5">
            
            {/* Destination Toggle */}
            <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
                <button 
                    onClick={() => setDestination('explore')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                        destination === 'explore' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-white'
                    }`}
                >
                    <i className="fa-regular fa-compass"></i> Explore (Grid)
                </button>
                <button 
                    onClick={() => setDestination('feed')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                        destination === 'feed' ? 'bg-accent text-white shadow-sm' : 'text-gray-500 hover:text-white'
                    }`}
                >
                    <i className="fa-solid fa-play"></i> Feed (Vertical)
                </button>
            </div>

            {/* File Input */}
            <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-accent/50 transition-colors bg-white/5 relative group">
                <input 
                    type="file" 
                    accept=".mp4,.mov,.avi,.wmv,.mkv,video/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={isLoading}
                />
                
                {file ? (
                   <div className="flex flex-col items-center gap-2">
                       <i className="fa-regular fa-file-video text-3xl text-accent"></i>
                       <p className="text-sm text-white font-medium truncate max-w-[200px]">{file.name}</p>
                       {videoDuration && (
                           <div className="flex items-center gap-2 text-xs">
                               <span className="px-2 py-1 rounded-md bg-accent/20 text-accent border border-accent/30 font-bold">
                                   <i className="fa-solid fa-clock mr-1"></i>
                                   {videoDuration}
                               </span>
                               <span className="text-gray-400">
                                   ({Math.floor(parseInt(videoDuration.split(':')[0]))} min)
                               </span>
                           </div>
                       )}
                       <p className="text-xs text-green-400">✓ Ready to upload to {destination === 'explore' ? 'Explore' : 'Feed'}</p>
                   </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-400 group-hover:text-white transition-colors">
                        <i className="fa-solid fa-cloud-arrow-up text-3xl mb-2"></i>
                        <p className="text-sm font-medium">Click to upload Video</p>
                        <p className="text-xs text-gray-600">
                            MP4, MOV, AVI, WMV, MKV (Máximo 25 minutos)
                        </p>
                        <p className="text-xs text-gray-600">
                            {destination === 'feed' ? 'Formato 9:16 recomendado' : 'Formato 16:9 recomendado'}
                        </p>
                    </div>
                )}
            </div>

            {/* Inputs */}
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-semibold text-gray-400 block mb-1.5">
                        {destination === 'explore' ? 'Title' : 'Title'}
                    </label>
                    <input 
                        type="text" 
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={destination === 'explore' ? 'My awesome video' : 'Video title'}
                        className="w-full bg-[#151515] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-accent focus:outline-none transition-colors"
                    />
                </div>

                <div>
                    <label className="text-xs font-semibold text-gray-400 block mb-1.5">
                        Description (Optional)
                    </label>
                    <textarea 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Add a description, tags, or any additional info... #tags"
                        className="w-full bg-[#151515] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-accent focus:outline-none transition-colors h-24 resize-none"
                    />
                </div>

                <div>
                    <label className="text-xs font-semibold text-gray-400 block mb-1.5">Category</label>
                    <div className="relative">
                        <select 
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full bg-[#151515] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-accent focus:outline-none appearance-none cursor-pointer"
                        >
                            {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                        <i className="fa-solid fa-chevron-down absolute right-4 top-3 text-xs text-gray-500 pointer-events-none"></i>
                    </div>
                </div>
            </div>

            {/* Upload Button */}
            <button 
                onClick={handleUpload}
                disabled={!file || isLoading}
                className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2 mt-4 overflow-hidden relative"
            >
                {isLoading ? (
                    <div className="relative z-10 flex items-center gap-2">
                        <i className="fa-solid fa-circle-notch fa-spin"></i>
                        <span>Uploading {uploadProgress}%</span>
                    </div>
                ) : (
                    <div className="relative z-10 flex items-center gap-2">
                        <i className="fa-solid fa-upload"></i>
                        <span>Post to {destination === 'explore' ? 'Explore' : 'Feed'}</span>
                    </div>
                )}
                
                {isLoading && (
                    <div 
                        className="absolute left-0 top-0 bottom-0 bg-purple-600 transition-all duration-200 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                    />
                )}
            </button>

        </div>
      </div>
    </div>
  );
};

export default UploadModal;