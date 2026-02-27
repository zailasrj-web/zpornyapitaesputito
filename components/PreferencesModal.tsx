import React from 'react';

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenHistory: () => void;
  onOpenFavorites: () => void;
}

const PreferencesModal: React.FC<PreferencesModalProps> = ({ 
  isOpen, 
  onClose,
  onOpenHistory,
  onOpenFavorites
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-[slideUp_0.3s_ease-out]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <i className="fa-solid fa-sliders text-accent"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Preferences</h2>
              <p className="text-xs text-gray-500">Manage your viewing preferences</p>
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
          
          {/* Watch History */}
          <button 
            onClick={() => {
              onClose();
              onOpenHistory();
            }}
            className="w-full group hover:bg-white/5 rounded-xl p-4 flex items-center justify-between transition-all mb-2"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <i className="fa-solid fa-clock-rotate-left text-blue-400"></i>
              </div>
              <div className="text-left">
                <h3 className="text-base font-bold text-white">Watch History</h3>
                <p className="text-xs text-gray-500 mt-0.5">View and manage your watched videos</p>
              </div>
            </div>
            <i className="fa-solid fa-chevron-right text-gray-600 group-hover:text-white transition-colors text-sm"></i>
          </button>

          {/* Favorites */}
          <button 
            onClick={() => {
              onClose();
              onOpenFavorites();
            }}
            className="w-full group hover:bg-white/5 rounded-xl p-4 flex items-center justify-between transition-all mb-2"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <i className="fa-solid fa-heart text-accent"></i>
              </div>
              <div className="text-left">
                <h3 className="text-base font-bold text-white">Favorites</h3>
                <p className="text-xs text-gray-500 mt-0.5">Your saved and favorite videos</p>
              </div>
            </div>
            <i className="fa-solid fa-chevron-right text-gray-600 group-hover:text-white transition-colors text-sm"></i>
          </button>

          {/* Divider */}
          <div className="my-6 border-t border-white/10"></div>

          {/* Video Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white mb-3">Video Settings</h3>
            
            {/* Video Looping */}
            <div className="bg-[#151515] border border-white/5 rounded-xl px-4">
              <div className="flex items-center justify-between py-4">
                <div className="pr-4">
                  <h4 className="text-sm font-medium text-white">Video Looping</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Automatically replay videos when they end</p>
                </div>
                <button className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none bg-gray-700">
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 shadow-sm translate-x-0.5"></span>
                </button>
              </div>
            </div>

            {/* Autoplay */}
            <div className="bg-[#151515] border border-white/5 rounded-xl px-4">
              <div className="flex items-center justify-between py-4">
                <div className="pr-4">
                  <h4 className="text-sm font-medium text-white">Autoplay</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Automatically play videos when opened</p>
                </div>
                <button className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none bg-[#F43F5E]">
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 shadow-sm translate-x-4.5" style={{transform: 'translateX(18px)'}}></span>
                </button>
              </div>
            </div>

            {/* Quality */}
            <div className="bg-[#151515] border border-white/5 rounded-xl px-4">
              <div className="flex items-center justify-between py-4">
                <div className="pr-4">
                  <h4 className="text-sm font-medium text-white">Default Quality</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Preferred video quality</p>
                </div>
                <select className="bg-[#272727] text-white text-sm px-3 py-1.5 rounded-lg border border-white/10 focus:outline-none focus:border-accent">
                  <option>Auto</option>
                  <option>1080p</option>
                  <option>720p</option>
                  <option>480p</option>
                </select>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-bold rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreferencesModal;
