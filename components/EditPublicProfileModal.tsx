import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface EditPublicProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

interface SocialLink {
  platform: string;
  url: string;
  icon: string;
}

const EditPublicProfileModal: React.FC<EditPublicProfileModalProps> = ({ isOpen, onClose, user }) => {
  const [activeTab, setActiveTab] = useState<'videos' | 'favorites' | 'socials' | 'friends'>('videos');
  const [isLoading, setIsLoading] = useState(false);
  
  // Social Links
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [newPlatform, setNewPlatform] = useState('');
  const [newUrl, setNewUrl] = useState('');
  
  // Friend Requests
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && user) {
      loadProfileData();
      loadFriendRequests();
    }
  }, [isOpen, user]);

  const loadProfileData = async () => {
    if (!user) return;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setSocialLinks(data.socialLinks || []);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadFriendRequests = async () => {
    if (!user) return;
    
    try {
      console.log('🔍 Loading friend requests...');
      
      // Load pending friend requests
      const requestsQuery = query(
        collection(db, 'friendRequests'),
        where('toUserId', '==', user.uid),
        where('status', '==', 'pending')
      );
      const requestsSnapshot = await getDocs(requestsQuery);
      
      const requests = await Promise.all(
        requestsSnapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const fromUserDoc = await getDoc(doc(db, 'users', data.fromUserId));
          return {
            id: docSnap.id,
            ...data,
            fromUser: fromUserDoc.data()
          };
        })
      );
      
      setFriendRequests(requests);
      
      // Load current friends
      const friendsQuery = query(
        collection(db, 'friends'),
        where('userId', '==', user.uid)
      );
      const friendsSnapshot = await getDocs(friendsQuery);
      
      const friendsList = await Promise.all(
        friendsSnapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const friendDoc = await getDoc(doc(db, 'users', data.friendId));
          return {
            id: docSnap.id,
            friendId: data.friendId,
            ...friendDoc.data()
          };
        })
      );
      
      setFriends(friendsList);
      console.log('✅ Friend data loaded successfully');
    } catch (error: any) {
      console.error('❌ Error loading friend requests:', error);
      
      // Extract and display Firebase index creation link
      if (error.code === 'failed-precondition' || error.message?.includes('index')) {
        console.log('');
        console.log('🔥 FIREBASE INDEX REQUIRED');
        console.log('');
        
        // Try to extract the link from the error message
        const linkMatch = error.message?.match(/(https:\/\/console\.firebase\.google\.com[^\s]+)/);
        if (linkMatch) {
          console.log('👉 Click here to create the index automatically:');
          console.log(linkMatch[1]);
        } else {
          console.log('Create the required indexes in Firebase Console');
          console.log('Go to: Firebase Console > Firestore > Indexes');
        }
        console.log('');
      }
    }
  };

  const handleAddSocialLink = async () => {
    if (!user || !newPlatform || !newUrl) return;
    
    const platformIcons: { [key: string]: string } = {
      twitter: 'fa-brands fa-twitter',
      instagram: 'fa-brands fa-instagram',
      tiktok: 'fa-brands fa-tiktok',
      youtube: 'fa-brands fa-youtube',
      onlyfans: 'fa-solid fa-fire',
      website: 'fa-solid fa-globe'
    };
    
    const newLink: SocialLink = {
      platform: newPlatform,
      url: newUrl,
      icon: platformIcons[newPlatform.toLowerCase()] || 'fa-solid fa-link'
    };
    
    const updatedLinks = [...socialLinks, newLink];
    setSocialLinks(updatedLinks);
    
    try {
      await setDoc(doc(db, 'users', user.uid), {
        socialLinks: updatedLinks
      }, { merge: true });
      
      setNewPlatform('');
      setNewUrl('');
    } catch (error) {
      console.error('Error adding social link:', error);
    }
  };

  const handleRemoveSocialLink = async (index: number) => {
    if (!user) return;
    
    const updatedLinks = socialLinks.filter((_, i) => i !== index);
    setSocialLinks(updatedLinks);
    
    try {
      await setDoc(doc(db, 'users', user.uid), {
        socialLinks: updatedLinks
      }, { merge: true });
    } catch (error) {
      console.error('Error removing social link:', error);
    }
  };

  const handleAcceptFriendRequest = async (requestId: string, fromUserId: string) => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      // Update request status
      await updateDoc(doc(db, 'friendRequests', requestId), {
        status: 'accepted',
        acceptedAt: new Date()
      });
      
      // Add to friends collection (both ways)
      await setDoc(doc(collection(db, 'friends')), {
        userId: user.uid,
        friendId: fromUserId,
        createdAt: new Date()
      });
      
      await setDoc(doc(collection(db, 'friends')), {
        userId: fromUserId,
        friendId: user.uid,
        createdAt: new Date()
      });
      
      // Reload data
      await loadFriendRequests();
    } catch (error) {
      console.error('Error accepting friend request:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectFriendRequest = async (requestId: string) => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      await deleteDoc(doc(db, 'friendRequests', requestId));
      await loadFriendRequests();
    } catch (error) {
      console.error('Error rejecting friend request:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 font-sans">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-[700px] bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#0F0F0F]">
          <div>
            <h2 className="text-lg font-bold text-white">Edit Public Profile</h2>
            <p className="text-xs text-gray-500 mt-0.5">Manage your public presence</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 bg-[#0F0F0F] overflow-x-auto">
          <button 
            onClick={() => setActiveTab('videos')}
            className={`px-4 py-3 text-xs font-bold transition-colors relative whitespace-nowrap ${activeTab === 'videos' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <i className="fa-solid fa-video mr-2"></i> My Videos
            {activeTab === 'videos' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-accent"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('favorites')}
            className={`px-4 py-3 text-xs font-bold transition-colors relative whitespace-nowrap ${activeTab === 'favorites' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <i className="fa-solid fa-heart mr-2"></i> Favorites
            {activeTab === 'favorites' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-accent"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('socials')}
            className={`px-4 py-3 text-xs font-bold transition-colors relative whitespace-nowrap ${activeTab === 'socials' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <i className="fa-solid fa-share-nodes mr-2"></i> Social Links
            {activeTab === 'socials' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-accent"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('friends')}
            className={`px-4 py-3 text-xs font-bold transition-colors relative whitespace-nowrap ${activeTab === 'friends' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <i className="fa-solid fa-user-group mr-2"></i> Friends
            {friendRequests.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{friendRequests.length}</span>
            )}
            {activeTab === 'friends' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-accent"></div>}
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          
          {/* Videos Tab */}
          {activeTab === 'videos' && (
            <div className="space-y-4">
              <div className="text-center py-12">
                <i className="fa-solid fa-video text-4xl text-gray-700 mb-4"></i>
                <p className="text-gray-500 text-sm">Video organization coming soon</p>
                <p className="text-gray-600 text-xs mt-2">You'll be able to organize and showcase your uploaded videos</p>
              </div>
            </div>
          )}

          {/* Favorites Tab */}
          {activeTab === 'favorites' && (
            <div className="space-y-4">
              <div className="text-center py-12">
                <i className="fa-solid fa-heart text-4xl text-gray-700 mb-4"></i>
                <p className="text-gray-500 text-sm">Favorites management coming soon</p>
                <p className="text-gray-600 text-xs mt-2">You'll be able to organize your favorite content</p>
              </div>
            </div>
          )}

          {/* Social Links Tab */}
          {activeTab === 'socials' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white mb-3">Your Social Links</h3>
                {socialLinks.length === 0 ? (
                  <div className="text-center py-8 bg-[#151515] rounded-xl border border-white/5">
                    <i className="fa-solid fa-link text-3xl text-gray-700 mb-3"></i>
                    <p className="text-gray-500 text-sm">No social links added yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {socialLinks.map((link, index) => (
                      <div key={index} className="bg-[#151515] border border-white/10 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <i className={`${link.icon} text-accent text-lg`}></i>
                          <div>
                            <p className="text-sm font-bold text-white capitalize">{link.platform}</p>
                            <p className="text-xs text-gray-500 truncate max-w-[300px]">{link.url}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleRemoveSocialLink(index)}
                          className="text-red-500 hover:text-red-400 transition-colors"
                        >
                          <i className="fa-solid fa-trash text-sm"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-white/5 pt-6">
                <h3 className="text-sm font-bold text-white mb-3">Add New Link</h3>
                <div className="space-y-3">
                  <select
                    value={newPlatform}
                    onChange={(e) => setNewPlatform(e.target.value)}
                    className="w-full bg-[#151515] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-accent focus:outline-none"
                  >
                    <option value="">Select Platform</option>
                    <option value="twitter">Twitter</option>
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="youtube">YouTube</option>
                    <option value="onlyfans">OnlyFans</option>
                    <option value="website">Website</option>
                  </select>
                  
                  <input
                    type="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-[#151515] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-accent focus:outline-none"
                  />
                  
                  <button
                    onClick={handleAddSocialLink}
                    disabled={!newPlatform || !newUrl}
                    className="w-full bg-accent hover:bg-purple-600 text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="fa-solid fa-plus mr-2"></i> Add Link
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Friends Tab */}
          {activeTab === 'friends' && (
            <div className="space-y-6">
              {/* Friend Requests */}
              {friendRequests.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-user-plus text-accent"></i>
                    Friend Requests ({friendRequests.length})
                  </h3>
                  <div className="space-y-2">
                    {friendRequests.map((request) => (
                      <div key={request.id} className="bg-[#151515] border border-accent/30 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <img
                              src={request.fromUser?.photoURL || `https://ui-avatars.com/api/?name=${request.fromUser?.displayName}`}
                              alt={request.fromUser?.displayName}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                            <div>
                              <p className="text-sm font-bold text-white">{request.fromUser?.displayName}</p>
                              <p className="text-xs text-gray-500">@{request.fromUser?.username}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAcceptFriendRequest(request.id, request.fromUserId)}
                              disabled={isLoading}
                              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                            >
                              <i className="fa-solid fa-check"></i>
                            </button>
                            <button
                              onClick={() => handleRejectFriendRequest(request.id)}
                              disabled={isLoading}
                              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                            >
                              <i className="fa-solid fa-xmark"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Current Friends */}
              <div>
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-user-group text-accent"></i>
                  Friends ({friends.length})
                </h3>
                {friends.length === 0 ? (
                  <div className="text-center py-8 bg-[#151515] rounded-xl border border-white/5">
                    <i className="fa-solid fa-user-group text-3xl text-gray-700 mb-3"></i>
                    <p className="text-gray-500 text-sm">No friends yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {friends.map((friend) => (
                      <div key={friend.id} className="bg-[#151515] border border-white/10 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <img
                            src={friend.photoURL || `https://ui-avatars.com/api/?name=${friend.displayName}`}
                            alt={friend.displayName}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{friend.displayName}</p>
                            <p className="text-[10px] text-gray-500 truncate">@{friend.username}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditPublicProfileModal;
