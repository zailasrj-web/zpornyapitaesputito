import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { Character } from '../types';

interface WatchHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onVideoClick: (video: Character) => void;
}

interface HistoryItem {
  id: string;
  videoId: string;
  videoName: string;
  videoImage: string;
  videoUrl?: string;
  watchedAt: any;
}

const WatchHistoryModal: React.FC<WatchHistoryModalProps> = ({ 
  isOpen, 
  onClose, 
  currentUser,
  onVideoClick 
}) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !currentUser?.uid) return;

    setLoading(true);
    const historyRef = collection(db, "users", currentUser.uid, "watchHistory");
    const q = query(historyRef, orderBy("watchedAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const historyData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HistoryItem[];
      
      setHistory(historyData);
      setLoading(false);
    }, (error) => {
      console.error("Error loading watch history:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, currentUser?.uid]);

  const handleClearHistory = async () => {
    if (!currentUser?.uid) return;
    
    if (confirm('Are you sure you want to clear your entire watch history?')) {
      try {
        const deletePromises = history.map(item => 
          deleteDoc(doc(db, "users", currentUser.uid, "watchHistory", item.id))
        );
        await Promise.all(deletePromises);
      } catch (error) {
        console.error("Error clearing history:", error);
      }
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!currentUser?.uid) return;
    
    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "watchHistory", itemId));
    } catch (error) {
      console.error("Error removing history item:", error);
    }
  };

  const handleVideoClickInternal = (item: HistoryItem) => {
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
              <i className="fa-solid fa-clock-rotate-left text-accent"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Watch History</h2>
              <p className="text-xs text-gray-500">
                {history.length} {history.length === 1 ? 'video' : 'videos'} watched
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
              <p className="text-gray-400 text-sm">Loading history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <i className="fa-solid fa-clock-rotate-left text-4xl text-gray-600"></i>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No watch history</h3>
              <p className="text-gray-400 text-sm max-w-xs">
                Videos you watch will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="group bg-[#151515] hover:bg-[#1a1a1a] border border-white/5 hover:border-white/10 rounded-xl p-3 flex gap-4 transition-all cursor-pointer"
                  onClick={() => handleVideoClickInternal(item)}
                >
                  {/* Thumbnail */}
                  <div className="relative w-32 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-black/50">
                    <img
                      src={item.videoImage}
                      alt={item.videoName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <i className="fa-solid fa-play text-white text-xl opacity-80 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-white mb-1 truncate group-hover:text-accent transition-colors">
                      {item.videoName}
                    </h4>
                    <p className="text-xs text-gray-500">
                      <i className="fa-solid fa-clock mr-1"></i>
                      Watched {item.watchedAt?.toDate ? new Date(item.watchedAt.toDate()).toLocaleDateString() : 'recently'}
                    </p>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveItem(item.id);
                    }}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-red-500/20 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <i className="fa-solid fa-trash text-xs text-gray-400 hover:text-red-400"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div className="p-6 border-t border-white/10 flex justify-between items-center">
            <button
              onClick={handleClearHistory}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-bold rounded-lg transition-colors border border-red-500/20"
            >
              <i className="fa-solid fa-trash mr-2"></i>
              Clear All History
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

export default WatchHistoryModal;
