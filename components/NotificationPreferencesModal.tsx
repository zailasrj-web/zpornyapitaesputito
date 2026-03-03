import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ToggleRow: React.FC<{
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  isLast?: boolean;
}> = ({ label, description, checked, onChange, isLast }) => (
  <div className={`flex items-center justify-between py-4 ${!isLast ? 'border-b border-white/5' : ''}`}>
    <div className="pr-4">
      <h4 className="text-sm font-medium text-white">{label}</h4>
      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
    </div>
    <button
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-[#F43F5E]' : 'bg-gray-700' // Using Rose-500 for the pink color in image
      }`}
    >
      <span
        className={`${
          checked ? 'translate-x-4.5' : 'translate-x-0.5'
        } inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 shadow-sm`}
        style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </button>
  </div>
);

const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({ isOpen, onClose }) => {
  const currentUser = auth.currentUser;
  
  // State for toggles
  const [settings, setSettings] = useState({
    accountUpdates: true,
    newFollowers: true,
    characterLikes: true,
    coinDonations: true,
    followedUserCharacters: true,
    communityPackPurchases: true,
  });
  
  const [isSaving, setIsSaving] = useState(false);

  // Load preferences from Firebase when modal opens
  useEffect(() => {
    if (isOpen && currentUser) {
      loadPreferences();
    }
  }, [isOpen, currentUser]);

  const loadPreferences = async () => {
    if (!currentUser) return;
    
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.notificationPreferences) {
          setSettings(prev => ({
            ...prev,
            ...data.notificationPreferences
          }));
        }
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    }
  };

  const savePreferences = async () => {
    if (!currentUser) return;
    
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, {
        notificationPreferences: settings,
        updatedAt: new Date()
      }, { merge: true });
      
      console.log('✅ Notification preferences saved');
    } catch (error) {
      console.error('Error saving notification preferences:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggle = (key: keyof typeof settings) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: !prev[key] };
      // Auto-save after toggle
      setTimeout(() => {
        if (currentUser) {
          const userRef = doc(db, 'users', currentUser.uid);
          setDoc(userRef, {
            notificationPreferences: newSettings,
            updatedAt: new Date()
          }, { merge: true }).catch(console.error);
        }
      }, 100);
      return newSettings;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 font-sans">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-[500px] bg-[#050505] border border-white/10 rounded-xl shadow-2xl animate-[fadeIn_0.2s_ease-out] flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-2">
           <h2 className="text-lg font-bold text-white">Notification Preferences</h2>
           <button 
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 pt-2 space-y-6 scrollbar-hide">
          
          {/* Section: Email */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Email</h3>
            <div className="bg-[#151515] border border-white/5 rounded-xl px-4">
              <ToggleRow 
                label="Account Updates" 
                description="Important account updates and new features"
                checked={settings.accountUpdates}
                onChange={() => toggle('accountUpdates')}
                isLast={true}
              />
            </div>
          </div>

          {/* Section: In-App */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">In-App</h3>
            
            {/* Sub-section: Social */}
            <div className="mt-3">
                <span className="text-xs text-gray-400 pl-1 mb-2 block">Social</span>
                <div className="bg-[#151515] border border-white/5 rounded-xl px-4">
                  <ToggleRow 
                    label="New Followers" 
                    description="Notify when someone follows you"
                    checked={settings.newFollowers}
                    onChange={() => toggle('newFollowers')}
                  />
                  <ToggleRow 
                    label="Character Likes" 
                    description="Notify when someone likes your character"
                    checked={settings.characterLikes}
                    onChange={() => toggle('characterLikes')}
                  />
                  <ToggleRow 
                    label="Coin Donations" 
                    description="Notify when someone donates you coins"
                    checked={settings.coinDonations}
                    onChange={() => toggle('coinDonations')}
                  />
                  <ToggleRow 
                    label="Followed User Characters" 
                    description="Notify when someone you follow releases a character"
                    checked={settings.followedUserCharacters}
                    onChange={() => toggle('followedUserCharacters')}
                  />
                  <ToggleRow 
                    label="Community Pack Purchases" 
                    description="Notify when someone purchases your community pack"
                    checked={settings.communityPackPurchases}
                    onChange={() => toggle('communityPackPurchases')}
                    isLast={true}
                  />
                </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default NotificationPreferencesModal;