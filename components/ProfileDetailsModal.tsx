import React, { useState, useEffect, useRef } from 'react';
import { User, updateProfile, updateEmail, updatePassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

// Cloudinary Config
const CLOUD_NAME = 'dbfza2zyk';
const UPLOAD_PRESET = 'poorn_default';

interface ProfileDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

const ProfileDetailsModal: React.FC<ProfileDetailsModalProps> = ({ isOpen, onClose, user }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form States
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [coverPhotoURL, setCoverPhotoURL] = useState('');
  
  // File Upload States
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  
  // Security States
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Load user data when modal opens
  useEffect(() => {
    if (isOpen && user) {
        setDisplayName(user.displayName || '');
        setEmail(user.email || '');
        const defaultHandle = user.email ? user.email.split('@')[0] : 'user';
        setUsername(defaultHandle); 
        
        // Reset previews
        setAvatarPreview(null);
        setCoverPreview(null);
        setAvatarFile(null);
        setCoverFile(null);
        
        // Fetch extended profile data
        const fetchProfile = async () => {
            try {
                const docRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.username) setUsername(data.username);
                    if (data.bio) setBio(data.bio);
                    if (data.coverPhotoURL) setCoverPhotoURL(data.coverPhotoURL);
                    if (data.is2FAEnabled) setIs2FAEnabled(data.is2FAEnabled);
                }
            } catch (e) {
                console.log("No extended profile found, using defaults.");
            }
        };
        fetchProfile();
    }
    setSuccessMsg('');
    setErrorMsg('');
    setNewPassword('');
    setConfirmPassword('');
  }, [isOpen, user]);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '');
      setUsername(val);
  };

  // --- Image Handling ---

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setAvatarFile(file);
          setAvatarPreview(URL.createObjectURL(file));
      }
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setCoverFile(file);
          setCoverPreview(URL.createObjectURL(file));
      }
  };

  const uploadImage = async (file: File): Promise<string> => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', UPLOAD_PRESET);
      
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
          method: 'POST',
          body: formData
      });
      
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.secure_url;
  };

  // --- Save Logic ---

  const handleSaveProfile = async () => {
      if (!user) return;
      setIsLoading(true);
      setErrorMsg('');
      setSuccessMsg('');

      try {
          let finalPhotoURL = user.photoURL;
          let finalCoverURL = coverPhotoURL;

          // 1. Upload Avatar if changed
          if (avatarFile) {
              finalPhotoURL = await uploadImage(avatarFile);
              await updateProfile(user, { photoURL: finalPhotoURL });
          }

          // 2. Upload Cover if changed
          if (coverFile) {
              finalCoverURL = await uploadImage(coverFile);
              setCoverPhotoURL(finalCoverURL); // Update local state
          }

          // 3. Update Display Name if changed
          if (displayName !== user.displayName) {
              await updateProfile(user, { displayName: displayName });
          }

          // 4. Update Firestore
          await setDoc(doc(db, "users", user.uid), {
              username: username,
              displayName: displayName,
              bio: bio,
              photoURL: finalPhotoURL, // Ensure Firestore is in sync with Auth
              coverPhotoURL: finalCoverURL,
              updatedAt: new Date()
          }, { merge: true });

          setSuccessMsg('Profile updated successfully!');
          
          // Clear file selections after successful save
          setAvatarFile(null);
          setCoverFile(null);

      } catch (error: any) {
          console.error(error);
          setErrorMsg(error.message || "Failed to save profile.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleSaveSecurity = async () => {
      if (!user) return;
      setIsLoading(true);
      setErrorMsg('');
      setSuccessMsg('');

      try {
          if (email !== user.email) {
              await updateEmail(user, email);
          }

          if (newPassword) {
              if (newPassword !== confirmPassword) throw new Error("Passwords do not match");
              if (newPassword.length < 6) throw new Error("Password must be at least 6 characters");
              await updatePassword(user, newPassword);
          }

          await setDoc(doc(db, "users", user.uid), {
              is2FAEnabled: is2FAEnabled
          }, { merge: true });

          setSuccessMsg('Security settings updated!');
          setNewPassword('');
          setConfirmPassword('');
      } catch (error: any) {
          if (error.code === 'auth/requires-recent-login') {
              setErrorMsg('Please log out and log back in to change sensitive details.');
          } else {
              setErrorMsg(error.message);
          }
      } finally {
          setIsLoading(false);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 font-sans">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity duration-300" onClick={onClose} />

      <div className="relative w-full max-w-[600px] bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl animate-[fadeIn_0.2s_ease-out] overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#0F0F0F]">
            <h2 className="text-lg font-bold text-white">Edit Profile</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                <i className="fa-solid fa-xmark text-lg"></i>
            </button>
        </div>

        <div className="flex border-b border-white/5 bg-[#0F0F0F]">
            <button 
                onClick={() => setActiveTab('profile')}
                className={`flex-1 py-3 text-sm font-bold transition-colors relative ${activeTab === 'profile' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
                <i className="fa-regular fa-id-card mr-2"></i> Public Profile
                {activeTab === 'profile' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-accent"></div>}
            </button>
            <button 
                onClick={() => setActiveTab('security')}
                className={`flex-1 py-3 text-sm font-bold transition-colors relative ${activeTab === 'security' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
                <i className="fa-solid fa-shield-halved mr-2"></i> Security
                {activeTab === 'security' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-accent"></div>}
            </button>
        </div>

        {(successMsg || errorMsg) && (
            <div className={`px-6 py-3 text-xs font-bold text-center ${successMsg ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {successMsg || errorMsg}
            </div>
        )}

        <div className="p-0 overflow-y-auto custom-scrollbar flex-1">
            {activeTab === 'profile' && (
                <div>
                    {/* Hidden Inputs */}
                    <input 
                        type="file" 
                        ref={avatarInputRef} 
                        onChange={handleAvatarSelect} 
                        accept="image/*" 
                        className="hidden" 
                    />
                    <input 
                        type="file" 
                        ref={coverInputRef} 
                        onChange={handleCoverSelect} 
                        accept="image/*" 
                        className="hidden" 
                    />

                    {/* Visual Banner Editor */}
                    <div className="relative w-full h-40 bg-gray-800 group">
                        <img 
                            src={coverPreview || coverPhotoURL || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1000&auto=format&fit=crop'} 
                            alt="Cover" 
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity"
                        />
                         <div className="absolute inset-0 flex items-center justify-center">
                            <label 
                                onClick={() => coverInputRef.current?.click()}
                                className="cursor-pointer bg-black/50 hover:bg-black/70 text-white px-4 py-2 rounded-full text-xs font-bold border border-white/20 transition-all flex items-center gap-2"
                            >
                                <i className="fa-solid fa-camera"></i> Change Cover
                            </label>
                        </div>
                    </div>

                    <div className="px-6 pb-6 -mt-10 relative">
                        {/* Avatar Overlap */}
                        <div className="flex items-end mb-6">
                            <div 
                                onClick={() => avatarInputRef.current?.click()}
                                className="relative w-24 h-24 rounded-full border-4 border-[#0A0A0A] bg-black group cursor-pointer overflow-hidden"
                            >
                                <img 
                                    src={avatarPreview || user?.photoURL || `https://ui-avatars.com/api/?name=${displayName}`} 
                                    alt="Avatar" 
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <i className="fa-solid fa-camera text-white"></i>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                             <div>
                                <label className="text-xs font-bold text-gray-400 mb-1.5 block">Banner Image URL (Optional fallback)</label>
                                <input 
                                    type="text" 
                                    value={coverPhotoURL}
                                    onChange={(e) => setCoverPhotoURL(e.target.value)}
                                    className="w-full bg-[#151515] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-accent focus:outline-none transition-colors"
                                    placeholder="https://..."
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-400 mb-1.5 block">Display Name</label>
                                <input 
                                    type="text" 
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="w-full bg-[#151515] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-accent focus:outline-none transition-colors"
                                    placeholder="e.g. Klara Star 🌟"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-400 mb-1.5 block">Username</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-2.5 text-gray-500 text-sm">@</span>
                                    <input 
                                        type="text" 
                                        value={username}
                                        onChange={handleUsernameChange}
                                        className="w-full bg-[#151515] border border-white/10 rounded-lg pl-8 pr-4 py-2.5 text-white text-sm focus:border-accent focus:outline-none transition-colors"
                                        placeholder="username"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-400 mb-1.5 block">Bio</label>
                                <textarea 
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    className="w-full bg-[#151515] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-accent focus:outline-none transition-colors resize-none h-20"
                                    placeholder="Tell the world about your creations..."
                                />
                            </div>

                            <button 
                                onClick={handleSaveProfile}
                                disabled={isLoading}
                                className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 mt-2"
                            >
                                {isLoading ? (
                                    <>
                                        <i className="fa-solid fa-circle-notch fa-spin"></i> Saving...
                                    </>
                                ) : (
                                    'Save Profile Changes'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'security' && (
                <div className="p-6 space-y-6">
                    <div className="bg-[#151515] border border-white/5 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <i className="fa-regular fa-envelope text-gray-400"></i>
                            <h3 className="text-sm font-bold text-white">Email Address</h3>
                        </div>
                        <input 
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-accent focus:outline-none transition-colors"
                        />
                    </div>

                    <div className="bg-[#151515] border border-white/5 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <i className="fa-solid fa-key text-gray-400"></i>
                            <h3 className="text-sm font-bold text-white">Change Password</h3>
                        </div>
                        <div className="space-y-3">
                            <input 
                                type="password" 
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="New Password"
                                className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-accent focus:outline-none transition-colors"
                            />
                            <input 
                                type="password" 
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm New Password"
                                className="w-full bg-black border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-accent focus:outline-none transition-colors"
                            />
                        </div>
                    </div>

                    <button 
                        onClick={handleSaveSecurity}
                        disabled={isLoading}
                        className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-900/20"
                    >
                        {isLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Update Security Settings'}
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ProfileDetailsModal;