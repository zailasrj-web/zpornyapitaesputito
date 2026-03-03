import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface PublicProfileViewProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  userId?: string; // If viewing another user's profile
}

interface SocialLink {
  platform: string;
  url: string;
  icon: string;
}

const PublicProfileView: React.FC<PublicProfileViewProps> = ({ isOpen, onClose, user, userId }) => {
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'videos' | 'favorites' | 'about'>('about');
  const [friendsCount, setFriendsCount] = useState(0);
  
  const isOwnProfile = !userId || userId === user?.uid;

  useEffect(() => {
    if (isOpen) {
      loadProfileData();
    }
  }, [isOpen, userId, user]);

  const loadProfileData = async () => {
    if (!user && !userId) return;
    
    setIsLoading(true);
    try {
      const targetUserId = userId || user?.uid;
      if (!targetUserId) return;

      const userDoc = await getDoc(doc(db, 'users', targetUserId));
      if (userDoc.exists()) {
        setProfileData(userDoc.data());
        
        // Load friends count
        const friendsQuery = query(
          collection(db, 'friends'),
          where('userId', '==', targetUserId)
        );
        const friendsSnapshot = await getDocs(friendsQuery);
        setFriendsCount(friendsSnapshot.size);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 font-sans">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-[800px] bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
        >
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>

        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <i className="fa-solid fa-spinner fa-spin text-4xl text-accent"></i>
          </div>
        ) : (
          <>
            {/* Cover Photo */}
            <div className="relative w-full h-48 bg-gradient-to-br from-purple-900/30 to-pink-900/30">
              <img 
                src={profileData?.coverPhotoURL || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1000&auto=format&fit=crop'} 
                alt="Cover" 
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] to-transparent"></div>
            </div>

            {/* Profile Info */}
            <div className="px-6 -mt-16 relative">
              <div className="flex items-end justify-between mb-4">
                <div className="flex items-end gap-4">
                  {/* Avatar */}
                  <div className="w-32 h-32 rounded-full border-4 border-[#0A0A0A] bg-black overflow-hidden">
                    <img 
                      src={profileData?.photoURL || `https://ui-avatars.com/api/?name=${profileData?.displayName}&size=128`} 
                      alt={profileData?.displayName} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  {/* Name & Username */}
                  <div className="mb-2">
                    <h2 className="text-2xl font-bold text-white">{profileData?.displayName || 'Anonymous'}</h2>
                    <p className="text-sm text-gray-500">@{profileData?.username || 'user'}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex gap-6 mb-2">
                  <div className="text-center">
                    <p className="text-xl font-bold text-white">0</p>
                    <p className="text-xs text-gray-500">Videos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-white">{friendsCount}</p>
                    <p className="text-xs text-gray-500">Friends</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-white">0</p>
                    <p className="text-xs text-gray-500">Favorites</p>
                  </div>
                </div>
              </div>

              {/* Bio */}
              {profileData?.bio && (
                <div className="mb-6">
                  <p className="text-sm text-gray-300 leading-relaxed">{profileData.bio}</p>
                </div>
              )}

              {/* Social Links */}
              {profileData?.socialLinks && profileData.socialLinks.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Social Links</h3>
                  <div className="flex flex-wrap gap-2">
                    {profileData.socialLinks.map((link: SocialLink, index: number) => (
                      <a
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-[#151515] hover:bg-[#202020] border border-white/10 rounded-lg px-4 py-2 flex items-center gap-2 transition-colors group"
                      >
                        <i className={`${link.icon} text-accent group-hover:text-white transition-colors`}></i>
                        <span className="text-sm text-gray-300 group-hover:text-white capitalize transition-colors">{link.platform}</span>
                        <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-gray-600 group-hover:text-gray-400"></i>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Subscription Badge */}
              {profileData?.subscription && profileData.subscription !== 'Free' && (
                <div className="mb-6">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                    profileData.subscription === 'Premium' 
                      ? 'bg-gradient-to-r from-accent to-purple-600' 
                      : 'bg-gradient-to-r from-yellow-500 to-yellow-600'
                  }`}>
                    <i className={`fa-solid ${profileData.subscription === 'Premium' ? 'fa-gem' : 'fa-crown'} text-white`}></i>
                    <span className="text-sm font-bold text-white">{profileData.subscription} Member</span>
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="border-t border-b border-white/5 bg-[#0F0F0F] px-6">
              <div className="flex gap-6">
                <button 
                  onClick={() => setActiveTab('about')}
                  className={`py-4 text-sm font-bold transition-colors relative ${activeTab === 'about' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  About
                  {activeTab === 'about' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-accent"></div>}
                </button>
                <button 
                  onClick={() => setActiveTab('videos')}
                  className={`py-4 text-sm font-bold transition-colors relative ${activeTab === 'videos' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Videos
                  {activeTab === 'videos' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-accent"></div>}
                </button>
                <button 
                  onClick={() => setActiveTab('favorites')}
                  className={`py-4 text-sm font-bold transition-colors relative ${activeTab === 'favorites' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Favorites
                  {activeTab === 'favorites' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-accent"></div>}
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              {activeTab === 'about' && (
                <div className="space-y-6">
                  {profileData?.bio ? (
                    <div>
                      <h3 className="text-sm font-bold text-white mb-2">Bio</h3>
                      <p className="text-sm text-gray-400 leading-relaxed">{profileData.bio}</p>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <i className="fa-solid fa-user text-4xl text-gray-700 mb-4"></i>
                      <p className="text-gray-500 text-sm">No bio added yet</p>
                    </div>
                  )}

                  {profileData?.socialLinks && profileData.socialLinks.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-white mb-3">Connect</h3>
                      <div className="space-y-2">
                        {profileData.socialLinks.map((link: SocialLink, index: number) => (
                          <a
                            key={index}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block bg-[#151515] hover:bg-[#202020] border border-white/10 rounded-lg p-4 transition-colors group"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <i className={`${link.icon} text-accent text-lg`}></i>
                                <div>
                                  <p className="text-sm font-bold text-white capitalize">{link.platform}</p>
                                  <p className="text-xs text-gray-500 truncate max-w-[400px]">{link.url}</p>
                                </div>
                              </div>
                              <i className="fa-solid fa-arrow-up-right-from-square text-gray-600 group-hover:text-gray-400"></i>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'videos' && (
                <div className="text-center py-12">
                  <i className="fa-solid fa-video text-4xl text-gray-700 mb-4"></i>
                  <p className="text-gray-500 text-sm">No videos yet</p>
                </div>
              )}

              {activeTab === 'favorites' && (
                <div className="text-center py-12">
                  <i className="fa-solid fa-heart text-4xl text-gray-700 mb-4"></i>
                  <p className="text-gray-500 text-sm">No favorites yet</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PublicProfileView;
