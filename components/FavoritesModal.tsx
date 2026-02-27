import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { Character } from '../types';

interface FavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onVideoClick: (video: Character) => void;
}

interface FavoriteItem {
  id: string;
  videoId: string;
  videoName: string;
  videoImage: string;
  videoUrl?: string;
  savedAt: any;
}

const FavoritesModal: React.FC<FavoritesModalProps> = ({ 
  isOpen, 
  onClose, 
  currentUser,
  onVideoClick 
}) => {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !currentUser?.uid) return;

    setLoading(true);
    const favoritesRef = collection(db, "users", currentUser.uid, "favorites");
    const q = query(favoritesRef, orderBy("savedAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const favoritesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FavoriteItem[];
      
      setFavorites(favoritesData);
      setLoading(false);
    }, (error) => {
      console.error("Error loading favorites:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, currentUser?.uid]);

  const handleClearFavorites = async () => {
    if (!currentUser?.uid) return;
    
    if (confirm('Are you sure you want to remove all favorites?')) {
      try {
        const deletePromises = favorites.map(item => 
          deleteDoc(doc(db, "users", currentUser.uid, "favorites", item.id))
        );
        await Promise.all(deletePromises);
      } catch (error) {
        console.error("Error clearing favorites:", error);
      }
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!currentUser?.uid) return;
    
    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "favorites", itemId));
    } catch (error) {
      console.error("Error removing favorite:", error);
    }
  };

  const handleVideoClickInternal = (item: FavoriteItem) => {
    const video: Character = {
      id: item.videoId,
      name: item.videoName,
      image: item.videoImage,
      videoUrl: item.videoUrl,
      duration: 'VID',
      likes: '0',
      views: '0'
    };
    onVideoClick(video);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl animate-[slideUp_0.3s_ease-out]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <i className="fa-solid fa-heart text-accent"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Favorites</h2>
              <p className="text-xs text-gray-500">
                {favorites.length} {favorites.length === 1 ? 'video' : 'videos'} saved
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <i className="fa-solid fa-xmark text-gray-400"></i>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-400 text-sm">Loading favorites...</p>
            </div>
          ) : favorites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <i className="fa-solid fa-heart text-4xl text-gray-600"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No favorites yet</h3>
              <p className="text-gray-400 text-sm max-w-xs">
                Save your favorite videos to watch them later
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {favorites.map((item) => (
                <div
                  key={item.id}
                  className="group bg-[#151515] hover:bg-[#1a1a1a] border border-white/5 hover:border-white/10 rounded-xl overflow-hidden transition-all cursor-pointer"
                  onClick={() => handleVideoClickInternal(item)}
                >
                  {/* Thumbnail */}
                  <div className="relative w-full aspect-video bg-black/50">
                    <img
                      src={item.videoImage}
                      alt={item.videoName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <i className="fa-solid fa-play text-white text-3xl opacity-80 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                    
                    {/* Remove Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveItem(item.id);
                      }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-red-500/80 backdrop-blur-sm flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                    >
                      <i className="fa-solid fa-heart-crack text-sm text-white"></i>
                    </button>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <h4 className="text-sm font-bold text-white mb-1 truncate group-hover:text-accent transition-colors">
                      {item.videoName}
                    </h4>
                    <p className="text-xs text-gray-500">
                      <i className="fa-solid fa-bookmark mr-1"></i>
                      Saved {item.savedAt?.toDate ? new Date(item.savedAt.toDate()).toLocaleDateString() : 'recently'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {favorites.length > 0 && (
          <div className="p-6 border-t border-white/10 flex justify-between items-center">
            <button
              onClick={handleClearFavorites}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-bold rounded-lg transition-colors border border-red-500/20"
            >
              <i className="fa-solid fa-trash mr-2"></i>
              Clear All Favorites
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-bold rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritesModal;
