import React from 'react';

interface SocialLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    displayName: string;
    username: string;
    photoURL: string;
  };
}

const SocialLinksModal: React.FC<SocialLinksModalProps> = ({ isOpen, onClose, user }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] font-sans">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#050505]/95 backdrop-blur-sm transition-opacity duration-300" onClick={onClose} />
      
      {/* Scrollable Container for small screens */}
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
            
            <div className="relative w-full max-w-sm flex flex-col items-center animate-[fadeIn_0.3s_ease-out] py-8">
                
                {/* Logo - Zpoorn Socials */}
                <div className="mb-8 md:mb-16 flex items-center justify-center">
                    <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-accent to-pink-400 bg-clip-text text-transparent tracking-tight">Zpoorn Socials</span>
                </div>

                {/* Profile Image */}
                <div className="relative mb-6">
                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-full p-[3px] bg-accent">
                        <img 
                            src={user.photoURL} 
                            alt={user.displayName} 
                            className="w-full h-full rounded-full object-cover border-4 border-[#050505]"
                        />
                    </div>
                </div>

                {/* Name & Handle */}
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight text-center">{user.displayName}</h2>
                <p className="text-accent text-sm mb-10 md:mb-16">@{user.username}</p>

                {/* Social Icons */}
                <div className="flex items-center gap-4 md:gap-6">
                    {/* X (Twitter) */}
                    <a href="#" className="w-14 h-14 md:w-16 md:h-16 rounded-full border border-white/10 bg-[#121212] flex items-center justify-center hover:bg-white/5 hover:border-white/30 transition-all group shadow-lg shadow-black/50">
                        <i className="fa-brands fa-x-twitter text-xl md:text-2xl text-white group-hover:scale-110 transition-transform"></i>
                    </a>
                    
                    {/* Instagram (Gradient Icon) */}
                    <a href="#" className="w-14 h-14 md:w-16 md:h-16 rounded-full border border-white/10 bg-[#121212] flex items-center justify-center hover:bg-white/5 hover:border-white/30 transition-all group shadow-lg shadow-black/50">
                        <div className="relative flex items-center justify-center group-hover:scale-110 transition-transform">
                            {/* SVG Gradient Definition */}
                            <svg width="0" height="0">
                            <linearGradient id="insta-gradient" x1="100%" y1="100%" x2="0%" y2="0%">
                                <stop stopColor="#f09433" offset="0%" />
                                <stop stopColor="#e6683c" offset="25%" />
                                <stop stopColor="#dc2743" offset="50%" />
                                <stop stopColor="#cc2366" offset="75%" />
                                <stop stopColor="#bc1888" offset="100%" />
                            </linearGradient>
                            </svg>
                            <i className="fa-brands fa-instagram text-2xl md:text-3xl" style={{ fill: "url(#insta-gradient)" }}></i>
                            {/* Fallback for browsers not supporting fill on i tag correctly (rare but possible with font awesome sometimes) */}
                            <i className="fa-brands fa-instagram text-2xl md:text-3xl absolute inset-0 text-transparent bg-clip-text bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 opacity-0 group-hover:opacity-100"></i>
                        </div>
                    </a>

                    {/* TikTok */}
                    <a href="#" className="w-14 h-14 md:w-16 md:h-16 rounded-full border border-white/10 bg-[#121212] flex items-center justify-center hover:bg-white/5 hover:border-white/30 transition-all group shadow-lg shadow-black/50">
                        <i className="fa-brands fa-tiktok text-xl md:text-2xl text-white group-hover:scale-110 transition-transform"></i>
                    </a>
                </div>
                
                <button onClick={onClose} className="mt-12 md:mt-20 text-gray-600 hover:text-white text-xs uppercase tracking-widest font-bold transition-colors py-4">
                    Close
                </button>

            </div>
        </div>
      </div>
    </div>
  );
};

export default SocialLinksModal;