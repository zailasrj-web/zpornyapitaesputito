import React, { useState } from 'react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import ProfileDetailsModal from './ProfileDetailsModal';
import NotificationPreferencesModal from './NotificationPreferencesModal';
import TwoFactorModal from './TwoFactorModal';
import PreferencesModal from './PreferencesModal';
import WatchHistoryModal from './WatchHistoryModal';
import FavoritesModal from './FavoritesModal';
import { Character } from '../types';

interface ProfileViewProps {
  currentUser: any;
  onVideoClick: (video: Character) => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ currentUser, onVideoClick }) => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [is2FAOpen, setIs2FAOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const user = auth.currentUser;
  
  const handleSignOut = () => {
    signOut(auth).catch((error) => console.error("Error signing out", error));
  };

  return (
    <div className="max-w-3xl mx-auto pt-4 pb-20 animate-[fadeIn_0.3s_ease-out] font-sans">
      
      {/* Ad Banner at the top */}
      <div className="mb-6 flex justify-center">
        <div 
          className="vJTtuVUr" 
          data-uid="vJTtuVUr" 
          style={{ height: '250px', width: '300px', cursor: 'pointer', position: 'relative' }}
        >
          <img 
            width="100%" 
            style={{ maxWidth: '300px' }}
            height="auto" 
            src="https://s3t3d2y1.afcdn.net/library/937170/672ff83978268b429a9eb6ec3affbf2c296ff5f1.gif"
            alt="Ad"
          />
        </div>
      </div>
      
      {/* --- Account Section --- */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-1">Account</h2>
        <p className="text-gray-400 text-sm mb-4">Manage your profile and notification settings</p>
        
        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden p-2">
          <div className="space-y-1">
            {/* Profile */}
            <button 
              onClick={() => setIsDetailsOpen(true)}
              className="w-full group hover:bg-white/5 rounded-xl p-4 flex items-center justify-between transition-all"
            >
              <div className="text-left">
                <h3 className="text-base font-bold text-white">Profile</h3>
                <p className="text-xs text-gray-500 mt-0.5">Public profile, private info, and personas</p>
              </div>
              <i className="fa-solid fa-chevron-right text-gray-600 group-hover:text-white transition-colors text-sm"></i>
            </button>

            {/* Notifications */}
            <button 
              onClick={() => setIsNotificationsOpen(true)}
              className="w-full group hover:bg-white/5 rounded-xl p-4 flex items-center justify-between transition-all"
            >
              <div className="text-left">
                <h3 className="text-base font-bold text-white">Notifications</h3>
                <p className="text-xs text-gray-500 mt-0.5">Configure your notification preferences</p>
              </div>
              <i className="fa-solid fa-chevron-right text-gray-600 group-hover:text-white transition-colors text-sm"></i>
            </button>

            {/* Preferences */}
            <button 
              onClick={() => setIsPreferencesOpen(true)}
              className="w-full group hover:bg-white/5 rounded-xl p-4 flex items-center justify-between transition-all"
            >
              <div className="text-left">
                <h3 className="text-base font-bold text-white">Preferences</h3>
                <p className="text-xs text-gray-500 mt-0.5">Video looping, watch history, favorites, and more</p>
              </div>
              <i className="fa-solid fa-chevron-right text-gray-600 group-hover:text-white transition-colors text-sm"></i>
            </button>

            {/* 2FA Security */}
            <button 
              onClick={() => setIs2FAOpen(true)}
              className="w-full group hover:bg-white/5 rounded-xl p-4 flex items-center justify-between transition-all"
            >
              <div className="text-left">
                <h3 className="text-base font-bold text-white">Two-Factor Authentication</h3>
                <p className="text-xs text-gray-500 mt-0.5">Add an extra layer of security to your account</p>
              </div>
              <i className="fa-solid fa-chevron-right text-gray-600 group-hover:text-white transition-colors text-sm"></i>
            </button>
          </div>

          {/* Sign Out Button (Inside Card, aligned right) */}
          <div className="mt-2 pt-2 border-t border-white/5 px-4 pb-2 flex justify-end">
            <button 
              onClick={handleSignOut}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-sm font-bold rounded-lg transition-colors border border-red-500/20"
            >
              Sign Out
            </button>
          </div>
        </div>
      </section>

      {/* --- Support & Feedback Section --- */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-4">Support & Feedback</h2>
        
        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-5">
            {/* Discord Banner */}
            <a 
                href="https://discord.gg/r3wDycJ3" 
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-[#5865F2] hover:bg-[#4752c4] rounded-xl p-4 flex items-center justify-between group transition-all mb-6 shadow-lg shadow-indigo-500/20"
            >
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-2 rounded-lg">
                     <i className="fa-brands fa-discord text-2xl text-white"></i>
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-bold text-white">Join the Community</h3>
                    <p className="text-[11px] text-white/90">Get instant help from 10,000+ dreamers</p>
                  </div>
                </div>
                <i className="fa-solid fa-arrow-up-right-from-square text-white/70 group-hover:text-white"></i>
            </a>

            {/* OR Divider */}
            <div className="relative flex items-center justify-center mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <span className="relative bg-[#0A0A0A] px-3 text-[10px] text-gray-500 uppercase font-bold tracking-wider">or</span>
            </div>

            {/* Support Buttons Grid */}
            <div className="grid grid-cols-2 gap-4">
                <button className="bg-[#151515] hover:bg-[#202020] border border-white/5 hover:border-white/10 rounded-xl py-3.5 flex items-center justify-center gap-2 transition-all">
                  <i className="fa-regular fa-comment-dots text-gray-400"></i>
                  <span className="font-semibold text-sm text-gray-200">Request Help</span>
                </button>
                <button className="bg-[#151515] hover:bg-[#202020] border border-white/5 hover:border-white/10 rounded-xl py-3.5 flex items-center justify-center gap-2 transition-all">
                  <i className="fa-solid fa-book-open text-gray-400"></i>
                  <span className="font-semibold text-sm text-gray-200">FAQ</span>
                </button>
            </div>
        </div>
      </section>

      {/* --- Refer & Earn Section --- */}
      <section className="mb-8">
        <div className="relative bg-gradient-to-b from-purple-900/10 to-[#0A0A0A] border border-accent/20 rounded-2xl p-1 overflow-hidden">
          {/* Top highlight line */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent"></div>
          
          <div className="bg-[#0A0A0A]/50 backdrop-blur-sm p-5 rounded-xl">
             <div className="flex items-center gap-2.5 mb-2">
                <i className="fa-solid fa-user-group text-accent"></i>
                <h2 className="text-xl font-bold text-white">Refer & Earn</h2>
             </div>
             <p className="text-gray-400 text-xs mb-6 leading-relaxed">
               Share the dream! Both you and your friends get $12 worth of DreamCoins when they pay for a premium subscription 💸
             </p>

             {/* Highlight Box */}
             <div className="bg-gradient-to-r from-purple-900/20 to-transparent border-l-4 border-accent p-4 rounded-r-lg mb-6">
                <div className="flex items-center gap-2 mb-1">
                   <i className="fa-solid fa-coins text-accent"></i>
                   <span className="text-sm font-bold text-white">Refer & Earn $12 Worth of DreamCoins 🍬</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  When friends pay for a premium subscription using your link, <span className="text-white font-semibold">both of you</span> instantly get <span className="text-accent font-bold">$12 worth of DreamCoins (1,000) 🎟️</span>
                </p>
             </div>

             {/* Generate Button */}
             <button className="w-full bg-gradient-to-r from-accent to-purple-600 hover:from-purple-500 hover:to-accent text-white font-bold py-3 rounded-xl shadow-lg shadow-purple-900/40 transition-all flex items-center justify-center gap-2 mb-6">
                <i className="fa-solid fa-arrows-rotate text-sm"></i>
                Generate Your Referral Link
             </button>

             {/* OR Divider */}
             <div className="relative flex items-center justify-center mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <span className="relative bg-[#0A0A0A] px-3 text-[10px] text-gray-500 uppercase font-bold tracking-wider">or</span>
              </div>

             {/* Input Section */}
             <p className="text-xs text-white/80 mb-2 font-medium">Have a referral link? Paste it here:</p>
             <div className="flex gap-2">
                <div className="relative flex-1">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <i className="fa-solid fa-link text-gray-600 text-xs"></i>
                   </div>
                   <input 
                     type="text" 
                     placeholder="https://poorn.ai/?reward=referral&ref=... or just the code"
                     className="w-full bg-[#151515] border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-accent/50 transition-colors"
                   />
                </div>
                <button className="bg-[#2a2a2a] hover:bg-accent hover:text-white border border-white/10 text-gray-300 text-xs font-bold px-5 rounded-lg transition-colors">
                  Apply
                </button>
             </div>
             <p className="text-[10px] text-gray-600 mt-2 italic">
               Your friend's referral link will be saved for when you pay for a premium subscription
             </p>
          </div>
        </div>
      </section>

      {/* --- Legal & Danger Zone Grid --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         
         {/* Legal Card */}
         <div className="border border-white/10 rounded-2xl p-5 bg-[#0A0A0A]">
            <div className="flex items-center gap-2 mb-2">
               <i className="fa-solid fa-file-contract text-white text-lg"></i>
               <h3 className="text-lg font-bold text-white">Legal</h3>
            </div>
            <p className="text-gray-500 text-xs mb-6 min-h-[32px]">Terms and policies</p>
            
            <button className="w-full bg-[#151515] hover:bg-[#202020] border border-white/5 rounded-lg py-3 text-xs font-bold text-gray-300 hover:text-white transition-colors">
              View Terms & Privacy Policy
            </button>
         </div>

         {/* Danger Zone Card */}
         <div className="border border-red-900/30 rounded-2xl p-5 bg-red-950/5">
            <div className="flex items-center gap-2 mb-2">
               <i className="fa-solid fa-triangle-exclamation text-red-500 text-lg"></i>
               <h3 className="text-lg font-bold text-red-500">Danger Zone</h3>
            </div>
            <p className="text-gray-500 text-xs mb-6 min-h-[32px]">Irreversible account actions</p>
            
            <button className="w-full bg-red-900/20 hover:bg-red-900/40 border border-red-500/20 rounded-lg py-3 text-xs font-bold text-red-400 hover:text-red-300 transition-colors">
              Delete Account
            </button>
         </div>

      </div>

      {/* --- Modals --- */}
      <ProfileDetailsModal 
        isOpen={isDetailsOpen} 
        onClose={() => setIsDetailsOpen(false)} 
        user={user}
      />

      <NotificationPreferencesModal 
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      <TwoFactorModal 
        isOpen={is2FAOpen}
        onClose={() => setIs2FAOpen(false)}
      />

      <PreferencesModal 
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenFavorites={() => setIsFavoritesOpen(true)}
      />

      <WatchHistoryModal 
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        currentUser={currentUser}
        onVideoClick={onVideoClick}
      />

      <FavoritesModal 
        isOpen={isFavoritesOpen}
        onClose={() => setIsFavoritesOpen(false)}
        currentUser={currentUser}
        onVideoClick={onVideoClick}
      />

    </div>
  );
};

export default ProfileView;