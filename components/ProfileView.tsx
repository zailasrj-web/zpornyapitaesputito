import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, increment, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import ProfileDetailsModal from './ProfileDetailsModal';
import NotificationPreferencesModal from './NotificationPreferencesModal';
import TwoFactorModal from './TwoFactorModal';
import PreferencesModal from './PreferencesModal';
import WatchHistoryModal from './WatchHistoryModal';
import FavoritesModal from './FavoritesModal';
import EditPublicProfileModal from './EditPublicProfileModal';
import PublicProfileView from './PublicProfileView';
import LegalModal from './LegalModal';
import DeleteAccountModal from './DeleteAccountModal';
import Toast from './Toast';
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
  const [isPublicProfileOpen, setIsPublicProfileOpen] = useState(false);
  const [isPublicProfileViewOpen, setIsPublicProfileViewOpen] = useState(false);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  
  // Referral System States
  const [referralLink, setReferralLink] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralCount, setReferralCount] = useState(0);
  const [referralInput, setReferralInput] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalIcon, setModalIcon] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  const user = auth.currentUser;
  
  const handleRequestSupport = async () => {
    if (!user) return;
    
    try {
      // Find an online admin or any admin
      const adminsQuery = query(
        collection(db, 'users'),
        where('role', '==', 'admin')
      );
      const adminsSnapshot = await getDocs(adminsQuery);
      
      if (adminsSnapshot.empty) {
        setToast({ message: 'No hay administradores disponibles en este momento', type: 'error' });
        return;
      }
      
      // Get first admin (you can add logic to check online status)
      const adminDoc = adminsSnapshot.docs[0];
      const adminId = adminDoc.id;
      
      // Create or get existing support chat
      const chatId = [user.uid, adminId].sort().join('_');
      const chatRef = doc(db, 'privateChats', chatId);
      
      await setDoc(chatRef, {
        participants: [user.uid, adminId],
        participantNames: {
          [user.uid]: user.displayName || 'User',
          [adminId]: adminDoc.data().displayName || 'Admin'
        },
        lastMessage: 'Solicitud de soporte',
        lastMessageTime: new Date(),
        isSupport: true,
        supportRequestedBy: user.uid,
        createdAt: new Date()
      }, { merge: true });
      
      // Send initial support message
      await addDoc(collection(db, 'privateChats', chatId, 'messages'), {
        text: '🆘 Solicitud de soporte iniciada',
        senderUid: 'system',
        displayName: 'Sistema',
        photoURL: '',
        createdAt: new Date(),
        type: 'system'
      });
      
      setToast({ message: 'Chat de soporte abierto. Ve a la sección Chat para continuar.', type: 'success' });
    } catch (error) {
      console.error('Error opening support chat:', error);
      setToast({ message: 'Error al abrir chat de soporte', type: 'error' });
    }
  };
  
  // Load referral data on mount
  useEffect(() => {
    if (user) {
      loadReferralData();
    }
  }, [user]);
  
  const loadReferralData = async () => {
    if (!user) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Load referral code if exists
        if (userData.referralCode) {
          setReferralCode(userData.referralCode);
          setReferralLink(`https://zpoorn.com/?ref=${userData.referralCode}`);
          
          // Count referrals - only if referralCode exists
          const referralsQuery = query(
            collection(db, 'users'),
            where('usedReferralCode', '==', userData.referralCode)
          );
          
          const referralsSnapshot = await getDocs(referralsQuery);
          const count = referralsSnapshot.size;
          setReferralCount(count);
          
          // Check and apply rewards
          await checkAndApplyRewards(count);
        } else {
          console.log('ℹ️ No referral code generated yet');
        }
      }
    } catch (error: any) {
      console.error('❌ Error loading referral data:', error);
      
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
          console.log('Create index manually in Firebase Console > Firestore > Indexes');
          console.log('Collection: users');
          console.log('Index: usedReferralCode');
        }
        console.log('');
      }
    }
  };
  
  const checkAndApplyRewards = async (count: number) => {
    if (!user) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      
      // VIP for 15 days (10 referrals)
      if (count >= 10 && !userData?.vipRewardClaimed) {
        const vipExpiryDate = new Date();
        vipExpiryDate.setDate(vipExpiryDate.getDate() + 15);
        
        await updateDoc(userRef, {
          subscription: 'VIP',
          vipExpiryDate: vipExpiryDate,
          vipRewardClaimed: true
        });
        
        setModalIcon('fa-crown');
        setModalMessage('🎉 ¡Felicidades! Has desbloqueado VIP por 15 días');
        setShowModal(true);
      }
      
      // Premium Permanent (100 referrals)
      if (count >= 100 && !userData?.premiumRewardClaimed) {
        await updateDoc(userRef, {
          subscription: 'Premium',
          premiumRewardClaimed: true,
          premiumPermanent: true
        });
        
        setModalIcon('fa-gem');
        setModalMessage('💎 ¡INCREÍBLE! Has desbloqueado Premium PERMANENTE');
        setShowModal(true);
      }
    } catch (error) {
      console.error('Error applying rewards:', error);
    }
  };
  
  const handleSignOut = () => {
    signOut(auth).catch((error) => console.error("Error signing out", error));
  };
  
  const generateReferralCode = () => {
    // Generate a unique 6-character code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };
  
  const handleGenerateReferralLink = async () => {
    if (!user) return;
    
    if (!referralCode) {
      const newCode = generateReferralCode();
      setReferralCode(newCode);
      const link = `https://zpoorn.com/?ref=${newCode}`;
      setReferralLink(link);
      
      // Save referral code to Firebase
      try {
        await setDoc(doc(db, 'users', user.uid), { 
          referralCode: newCode,
          referralCreatedAt: new Date()
        }, { merge: true });
        
        navigator.clipboard.writeText(link);
        setToast({ message: '¡Link generado y copiado al portapapeles!', type: 'success' });
      } catch (error: any) {
        console.error('❌ Error saving referral code:', error);
        setToast({ message: 'Error al generar el link', type: 'error' });
      }
    } else {
      // Copy existing link
      navigator.clipboard.writeText(referralLink);
      setToast({ message: '¡Link copiado al portapapeles!', type: 'success' });
    }
  };
  
  const handleApplyReferralCode = async () => {
    if (!user) return;
    
    if (!referralInput.trim()) {
      setToast({ message: 'Por favor ingresa un código de referido', type: 'error' });
      return;
    }
    
    // Extract code from URL or use as is
    let code = referralInput.trim().toUpperCase();
    if (code.includes('ref=')) {
      const match = code.match(/ref=([A-Z0-9]+)/);
      if (match) code = match[1];
    }
    
    // Check if code exists
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('referralCode', '==', code)
      );
      const usersSnapshot = await getDocs(usersQuery);
      
      if (usersSnapshot.empty) {
        setToast({ message: 'Código de referido inválido', type: 'error' });
        return;
      }
      
      // Check if user already used a referral code
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.data()?.usedReferralCode) {
        setToast({ message: 'Ya has usado un código de referido anteriormente', type: 'info' });
        return;
      }
      
      // Save referral code
      await updateDoc(userRef, { 
        usedReferralCode: code,
        referralAppliedAt: new Date()
      });
      
      // Increment referrer's count
      const referrerDoc = usersSnapshot.docs[0];
      await updateDoc(doc(db, 'users', referrerDoc.id), {
        referralCount: increment(1)
      });
      
      setToast({ message: '¡Código de referido aplicado exitosamente!', type: 'success' });
      setReferralInput('');
      
      // Reload data
      loadReferralData();
    } catch (error) {
      console.error('Error applying referral code:', error);
      setToast({ message: 'Error al aplicar el código', type: 'error' });
    }
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

            {/* View Public Profile */}
            <button 
              onClick={() => setIsPublicProfileViewOpen(true)}
              className="w-full group hover:bg-white/5 rounded-xl p-4 flex items-center justify-between transition-all"
            >
              <div className="text-left">
                <h3 className="text-base font-bold text-white">View Public Profile</h3>
                <p className="text-xs text-gray-500 mt-0.5">See how others see your profile</p>
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
                href="https://discord.gg/RaXBWkV8xv" 
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
                <button 
                  onClick={handleRequestSupport}
                  className="bg-[#151515] hover:bg-[#202020] border border-white/5 hover:border-white/10 rounded-xl py-3.5 flex items-center justify-center gap-2 transition-all"
                >
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
               ¡Invita a tus amigos y gana recompensas increíbles! 🎁
             </p>

             {/* Rewards Boxes */}
             <div className="space-y-3 mb-6">
               {/* VIP Reward */}
               <div className="bg-gradient-to-r from-yellow-900/20 to-transparent border-l-4 border-yellow-500 p-4 rounded-r-lg">
                  <div className="flex items-center gap-2 mb-1">
                     <i className="fa-solid fa-crown text-yellow-500"></i>
                     <span className="text-sm font-bold text-white">10 Referidos = VIP por 15 días 👑</span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Invita a <span className="text-white font-semibold">10 usuarios</span> a registrarse y obtén <span className="text-yellow-500 font-bold">VIP gratis por 15 días</span>
                  </p>
               </div>
               
               {/* Premium Reward */}
               <div className="bg-gradient-to-r from-purple-900/20 to-transparent border-l-4 border-accent p-4 rounded-r-lg">
                  <div className="flex items-center gap-2 mb-1">
                     <i className="fa-solid fa-gem text-accent"></i>
                     <span className="text-sm font-bold text-white">100 Referidos = Premium PERMANENTE 💎</span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Invita a <span className="text-white font-semibold">100 usuarios</span> a registrarse y obtén <span className="text-accent font-bold">Premium con todas sus funciones PARA SIEMPRE</span>
                  </p>
               </div>
             </div>

             {/* Generate Button */}
             <button 
               onClick={handleGenerateReferralLink}
               className="w-full bg-gradient-to-r from-accent to-purple-600 hover:from-purple-500 hover:to-accent text-white font-bold py-3 rounded-xl shadow-lg shadow-purple-900/40 transition-all flex items-center justify-center gap-2 mb-4"
             >
                <i className="fa-solid fa-arrows-rotate text-sm"></i>
                {referralLink ? 'Copiar Link de Referido' : 'Generar Link de Referido'}
             </button>
             
             {/* Referral Link Display */}
             {referralLink && (
               <div className="bg-[#151515] border border-accent/30 rounded-lg p-3 mb-4">
                 <p className="text-[10px] text-gray-500 mb-1">Tu link de referido:</p>
                 <code className="block text-xs text-accent break-all">{referralLink}</code>
               </div>
             )}
             
             {/* Unified Progress Bar */}
             <div className="mb-6">
               <div className="flex items-center justify-between mb-2">
                 <div className="flex items-center gap-2">
                   {referralCount < 10 ? (
                     <>
                       <i className="fa-solid fa-crown text-yellow-500"></i>
                       <span className="text-xs text-gray-400">Progreso hacia VIP</span>
                     </>
                   ) : referralCount >= 100 ? (
                     <>
                       <i className="fa-solid fa-gem text-accent"></i>
                       <span className="text-xs text-accent font-bold">VIP Habilitado</span>
                     </>
                   ) : (
                     <>
                       <i className="fa-solid fa-crown text-yellow-500"></i>
                       <span className="text-xs text-yellow-500 font-bold">Reclama tu VIP</span>
                     </>
                   )}
                 </div>
                 <span className="text-xs font-bold text-white">{referralCount}/100</span>
               </div>
               
               <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                 <div 
                   className={`h-full transition-all duration-500 rounded-full ${
                     referralCount >= 100 
                       ? 'bg-gradient-to-r from-accent to-purple-600' 
                       : referralCount >= 10 
                       ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' 
                       : 'bg-gradient-to-r from-gray-500 to-gray-600'
                   }`}
                   style={{ width: `${Math.min((referralCount / 100) * 100, 100)}%` }}
                 />
               </div>
               
               {referralCount >= 10 && referralCount < 100 && (
                 <div className="mt-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <i className="fa-solid fa-crown text-yellow-500"></i>
                     <span className="text-xs text-yellow-500 font-bold">¡VIP Desbloqueado por 15 días!</span>
                   </div>
                   <button className="text-[10px] bg-yellow-500 text-black px-3 py-1 rounded-md font-bold hover:bg-yellow-400 transition-colors">
                     Reclamar
                   </button>
                 </div>
               )}
               
               {referralCount >= 100 && (
                 <div className="mt-3 bg-accent/10 border border-accent/30 rounded-lg p-3 flex items-center gap-2">
                   <i className="fa-solid fa-gem text-accent"></i>
                   <span className="text-xs text-accent font-bold">¡Premium PERMANENTE Habilitado!</span>
                 </div>
               )}
               
               {referralCount < 100 && (
                 <div className="mt-3 bg-[#151515] border border-white/10 rounded-lg p-3 flex items-center justify-center gap-3">
                   <i className="fa-solid fa-gift text-gray-500 text-sm"></i>
                   <span className="text-xs text-gray-400 leading-relaxed">
                     Te faltan <span className="text-white font-bold">{100 - referralCount}</span> referidos para conseguir tu <span className="text-accent font-bold">PREMIUM PERMANENTE</span>
                   </span>
                 </div>
               )}
             </div>

             {/* OR Divider */}
             <div className="relative flex items-center justify-center mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <span className="relative bg-[#0A0A0A] px-3 text-[10px] text-gray-500 uppercase font-bold tracking-wider">o</span>
              </div>

             {/* Input Section */}
             <p className="text-xs text-white/80 mb-2 font-medium">¿Tienes un código de referido? Ingrésalo aquí:</p>
             <div className="flex gap-2">
                <div className="relative flex-1">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <i className="fa-solid fa-link text-gray-600 text-xs"></i>
                   </div>
                   <input 
                     type="text"
                     value={referralInput}
                     onChange={(e) => setReferralInput(e.target.value)}
                     placeholder="https://poorn.ai/?ref=ABC123 o solo el código"
                     className="w-full bg-[#151515] border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-accent/50 transition-colors"
                   />
                </div>
                <button 
                  onClick={handleApplyReferralCode}
                  className="bg-[#2a2a2a] hover:bg-accent hover:text-white border border-white/10 text-gray-300 text-xs font-bold px-5 rounded-lg transition-colors"
                >
                  Aplicar
                </button>
             </div>
             <p className="text-[10px] text-gray-600 mt-2 italic">
               El código de referido se guardará y se aplicará cuando te registres
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
            
            <button 
              onClick={() => setIsLegalOpen(true)}
              className="w-full bg-[#151515] hover:bg-[#202020] border border-white/5 rounded-lg py-3 text-xs font-bold text-gray-300 hover:text-white transition-colors"
            >
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
            
            <button 
              onClick={() => setIsDeleteAccountOpen(true)}
              className="w-full bg-red-900/20 hover:bg-red-900/40 border border-red-500/20 rounded-lg py-3 text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
            >
              Delete Account
            </button>
         </div>

      </div>

      {/* --- Modals --- */}
      <ProfileDetailsModal 
        isOpen={isDetailsOpen} 
        onClose={() => setIsDetailsOpen(false)} 
        user={user}
        onOpenPublicProfile={() => {
          setIsDetailsOpen(false);
          setIsPublicProfileOpen(true);
        }}
      />

      <EditPublicProfileModal
        isOpen={isPublicProfileOpen}
        onClose={() => setIsPublicProfileOpen(false)}
        user={user}
      />

      <PublicProfileView
        isOpen={isPublicProfileViewOpen}
        onClose={() => setIsPublicProfileViewOpen(false)}
        user={user}
      />

      <LegalModal
        isOpen={isLegalOpen}
        onClose={() => setIsLegalOpen(false)}
      />

      <DeleteAccountModal
        isOpen={isDeleteAccountOpen}
        onClose={() => setIsDeleteAccountOpen(false)}
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

      {/* Toast Notifications */}
      {toast && (
        <Toast 
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Referral Reward Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-[#0A0A0A] border border-accent/30 rounded-2xl p-6 max-w-sm w-full animate-[fadeIn_0.2s_ease-out] shadow-2xl shadow-accent/20">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mb-4">
                <i className={`fa-solid ${modalIcon} text-3xl text-accent`}></i>
              </div>
              <p className="text-white text-base font-medium mb-6">{modalMessage}</p>
              <button 
                onClick={() => setShowModal(false)}
                className="w-full bg-accent hover:bg-purple-600 text-white font-bold py-3 rounded-xl transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProfileView;