import React, { useState } from 'react';
import type { User } from 'firebase/auth';

interface HeaderProps {
  user?: User | null | any; // Allow any for mock user extension
  onLoginClick?: () => void;
  onJoinClick?: () => void;
  onMenuClick?: () => void;
  onLogout?: () => void;
  onProfileClick?: () => void;
  isSidebarOpen?: boolean;
  currentView?: string; // Add currentView prop
  onLogoClick?: () => void; // Add logo click handler
}

const Header: React.FC<HeaderProps> = ({ user, onLoginClick, onJoinClick, onMenuClick, onLogout, onProfileClick, isSidebarOpen, currentView, onLogoClick }) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Get username or part of email or fallback
  // Enforce no spaces in display name to match platform consistency
  const rawDisplayName = user?.displayName || user?.email?.split('@')[0] || 'User';
  const displayName = rawDisplayName.replace(/\s+/g, '_'); // Visually replace spaces with underscores

  // Get photo or generate avatar
  const photoURL = user?.photoURL || `https://ui-avatars.com/api/?name=${displayName}&background=a855f7&color=fff`;

  // Check if it's a mock user
  const isGuest = user?.isMock === true;

  return (
    <header className="flex justify-between items-center py-3 px-4 md:py-4 md:px-10 sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-white/5 md:border-none">
      
      {/* Menu Button - Now opens sidebar */}
      <button 
        onClick={onMenuClick}
        className="w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 text-white/80 hover:text-white bg-black/20 backdrop-blur-md border border-white/10 hover:bg-white/10 flex-shrink-0"
      >
        <i className="fa-solid fa-bars text-xl"></i>
      </button>

      {/* Logo (Centered on desktop, left-aligned on mobile) - Hidden in feed view */}
      {currentView !== 'feed' && (
        <button 
          onClick={onLogoClick}
          className="flex items-center gap-0.5 md:absolute md:left-1/2 md:transform md:-translate-x-1/2 flex-1 md:flex-none justify-center md:justify-start ml-3 md:ml-0 hover:opacity-80 transition-opacity cursor-pointer"
        >
             <img 
               src="https://res.cloudinary.com/dbfza2zyk/image/upload/v1768852307/ZZPO_lmy5e2.png" 
               alt="poorn Logo" 
               className="w-7 h-7 object-contain"
             />
             <span className="text-[22px] font-extrabold tracking-tighter text-white">
                poorn
             </span>
        </button>
      )}

      {/* Right Section: Actions */}
      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        {user ? (
          <div className="flex items-center gap-2 md:gap-3 animate-[fadeIn_0.3s_ease-out]">
            
            {/* User Profile Pill */}
            <div 
              onClick={onProfileClick}
              className="flex items-center gap-2 pl-1 pr-3 py-1 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors cursor-pointer group select-none relative"
            >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent to-purple-400 p-[1px] relative">
                   <img
                     src={photoURL}
                     alt="Profile"
                     className="w-full h-full rounded-full object-cover"
                   />
                   {/* Online Dot */}
                   <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-black transform translate-y-1/4 translate-x-1/4"></span>
                </div>
                <div className="flex flex-col justify-center">
                    <span className="text-xs md:text-sm font-semibold text-white max-w-[100px] md:max-w-[150px] truncate leading-none">
                    {displayName}
                    </span>
                    {isGuest && <span className="text-[9px] text-gray-400 font-medium leading-none mt-0.5">Guest Mode</span>}
                </div>
            </div>
            
            {/* Logout Button (Triggers Modal) */}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/50 transition-all"
              title="Logout"
            >
              <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
            </button>
          </div>
        ) : (
          <>
            <button 
              onClick={onLoginClick}
              className="px-4 py-2 rounded-lg border border-gray-700/50 text-white text-xs md:text-sm font-semibold hover:border-gray-500 hover:bg-white/5 transition-all"
            >
              Login
            </button>
            <button 
              onClick={onJoinClick}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs md:text-sm font-semibold transition-colors shadow-lg shadow-purple-900/30"
            >
              Join Free
            </button>
          </>
        )}
      </div>

      {/* LOGOUT CONFIRMATION MODAL - CENTERED PERFECTLY */}
      {showLogoutConfirm && (
         <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 font-sans">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-[fadeIn_0.2s_ease-out]"
              onClick={() => setShowLogoutConfirm(false)}
            />
            {/* Modal */}
            <div className="relative bg-[#151515] border border-white/10 rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center animate-[scaleIn_0.1s_ease-out] z-10 mx-auto my-auto">
               <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 text-red-500 border border-red-500/20">
                  <i className="fa-solid fa-arrow-right-from-bracket text-lg"></i>
               </div>
               <h3 className="text-lg font-bold text-white mb-2">Sign Out?</h3>
               <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                 Are you sure you want to log out of your account?
               </p>
               
               <div className="flex gap-3">
                  <button 
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-sm transition-colors border border-white/5"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                        onLogout?.();
                        setShowLogoutConfirm(false);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors shadow-lg shadow-red-900/20"
                  >
                    Sign Out
                  </button>
               </div>
            </div>
         </div>
      )}
    </header>
  );
};

export default Header;