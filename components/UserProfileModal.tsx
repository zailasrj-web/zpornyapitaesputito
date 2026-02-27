import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { doc, setDoc, serverTimestamp, updateDoc, getDoc, collection, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';

interface UserProfileModalProps {
  user: {
    uid: string;
    displayName: string;
    photoURL: string;
    email?: string;
  };
  currentUser: User;
  isAdmin: boolean;
  onClose: () => void;
  onStartChat: () => void;
  onReport: () => void;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  currentUser,
  isAdmin,
  onClose,
  onStartChat,
  onReport
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'mute' | 'ban' | 'isolate' | null>(null);
  const [muteReason, setMuteReason] = useState('');
  const [muteDuration, setMuteDuration] = useState('1h');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isChatBanned, setIsChatBanned] = useState(false);
  const [isIsolated, setIsIsolated] = useState(false);

  // Modal States
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertModalConfig, setAlertModalConfig] = useState<{
    title: string;
    message: string;
    type?: 'success' | 'error' | 'info';
  } | null>(null);

  // Helper function for alert modal
  const showAlert = (config: {
    title: string;
    message: string;
    type?: 'success' | 'error' | 'info';
  }) => {
    setAlertModalConfig(config);
    setShowAlertModal(true);
  };

  // Check if user is banned or isolated
  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setIsChatBanned(userData.chatBanned === true);
          setIsIsolated(userData.chatIsolated === true);
        }
      } catch (error) {
        console.error('Error checking user status:', error);
      }
    };
    
    checkUserStatus();
  }, [user.uid]);

  const handleMuteUser = async () => {
    if (!muteReason.trim()) {
      showAlert({
        title: 'Razón Requerida',
        message: 'Por favor proporciona una razón para silenciar al usuario.',
        type: 'error'
      });
      return;
    }

    setIsProcessing(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const now = new Date();
      let expiresAt = new Date();

      switch (muteDuration) {
        case '1h':
          expiresAt.setHours(now.getHours() + 1);
          break;
        case '24h':
          expiresAt.setHours(now.getHours() + 24);
          break;
        case '7d':
          expiresAt.setDate(now.getDate() + 7);
          break;
        case 'permanent':
          expiresAt.setFullYear(now.getFullYear() + 100);
          break;
      }

      await updateDoc(userRef, {
        chatMuted: true,
        muteReason: muteReason,
        muteExpiresAt: expiresAt,
        mutedBy: currentUser.email,
        mutedAt: serverTimestamp()
      });

      showAlert({
        title: 'Usuario Silenciado',
        message: `Usuario silenciado exitosamente hasta ${expiresAt.toLocaleString()}`,
        type: 'success'
      });
      setShowConfirmModal(false);
      onClose();
    } catch (error) {
      console.error('Error muting user:', error);
      showAlert({
        title: 'Error',
        message: 'No se pudo silenciar al usuario. Intenta de nuevo.',
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBanFromChat = async () => {
    if (!muteReason.trim()) {
      showAlert({
        title: 'Razón Requerida',
        message: 'Por favor proporciona una razón para banear al usuario.',
        type: 'error'
      });
      return;
    }

    setIsProcessing(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        chatBanned: true,
        chatBanReason: muteReason,
        chatBannedBy: currentUser.email,
        chatBannedAt: serverTimestamp()
      });

      showAlert({
        title: 'Usuario Baneado',
        message: 'Usuario baneado del chat exitosamente.',
        type: 'success'
      });
      setIsChatBanned(true);
      setShowConfirmModal(false);
      onClose();
    } catch (error) {
      console.error('Error banning user:', error);
      showAlert({
        title: 'Error',
        message: 'No se pudo banear al usuario. Intenta de nuevo.',
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnbanFromChat = async () => {
    setIsProcessing(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        chatBanned: false,
        chatBanReason: null,
        chatBannedBy: null,
        chatBannedAt: null,
        chatUnbannedAt: serverTimestamp(),
        chatUnbannedBy: currentUser.email,
        // Add flag to redirect user to community chat
        redirectToCommunity: true
      });

      showAlert({
        title: 'Usuario Desbaneado',
        message: 'El usuario ha sido desbaneado y será redirigido al chat comunitario.',
        type: 'success'
      });
      setIsChatBanned(false);
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Error unbanning user:', error);
      showAlert({
        title: 'Error',
        message: 'No se pudo desbanear al usuario. Intenta de nuevo.',
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleIsolateUser = async () => {
    if (!muteReason.trim()) {
      showAlert({
        title: 'Razón Requerida',
        message: 'Por favor proporciona una razón para aislar al usuario.',
        type: 'error'
      });
      return;
    }

    setIsProcessing(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        chatIsolated: true,
        isolationReason: muteReason,
        isolatedBy: currentUser.uid,
        isolatedByEmail: currentUser.email,
        isolatedAt: serverTimestamp()
      });

      // Create isolated chat room
      const isolatedChatRef = doc(db, 'isolatedChats', `isolated_${user.uid}`);
      await setDoc(isolatedChatRef, {
        userId: user.uid,
        userName: user.displayName,
        userEmail: user.email,
        userPhotoURL: user.photoURL,
        adminId: currentUser.uid,
        adminName: currentUser.displayName,
        adminEmail: currentUser.email,
        createdAt: serverTimestamp(),
        active: true,
        reason: muteReason
      });

      showAlert({
        title: 'Usuario Aislado',
        message: 'Usuario aislado exitosamente. Abriendo chat aislado...',
        type: 'success'
      });
      setShowConfirmModal(false);
      onClose();
      
      // Trigger callback to open isolated chat in parent component
      if (onStartChat) {
        onStartChat();
      }
    } catch (error) {
      console.error('Error isolating user:', error);
      showAlert({
        title: 'Error',
        message: 'No se pudo aislar al usuario. Intenta de nuevo.',
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveIsolation = async () => {
    setIsProcessing(true);
    try {
      const chatId = `isolated_${user.uid}`;
      
      // Delete all messages in the isolated chat
      const messagesRef = collection(db, 'isolatedChats', chatId, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      
      const batch = writeBatch(db);
      messagesSnapshot.forEach((msgDoc) => {
        batch.delete(doc(db, 'isolatedChats', chatId, 'messages', msgDoc.id));
      });
      await batch.commit();
      
      // Delete the isolated chat document
      await deleteDoc(doc(db, 'isolatedChats', chatId));
      
      // Remove isolation from user
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        chatIsolated: false,
        isolationReason: null,
        isolatedBy: null,
        isolatedAt: null
      });

      showAlert({
        title: 'Aislamiento Removido',
        message: 'El aislamiento del usuario ha sido removido exitosamente. El historial del chat ha sido eliminado.',
        type: 'success'
      });
      onClose();
    } catch (error) {
      console.error('Error removing isolation:', error);
      showAlert({
        title: 'Error',
        message: 'No se pudo remover el aislamiento. Intenta de nuevo.',
        type: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmActionHandler = () => {
    switch (confirmAction) {
      case 'mute':
        handleMuteUser();
        break;
      case 'ban':
        handleBanFromChat();
        break;
      case 'isolate':
        handleIsolateUser();
        break;
    }
  };

  return (
    <>
      {/* Main Profile Modal */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
        <div className="relative bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-2xl p-6 max-w-md w-full border border-white/10 shadow-2xl animate-[slideUp_0.3s_ease-out]">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>

          {/* User Avatar */}
          <div className="flex flex-col items-center mb-6">
            <img
              src={user.photoURL}
              alt={user.displayName}
              className="w-24 h-24 rounded-full object-cover border-4 border-accent/30 mb-3"
            />
            <h3 className="text-2xl font-bold text-white">{user.displayName}</h3>
            {user.email && (
              <p className="text-sm text-gray-400">{user.email}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Start Private Chat */}
            <button
              onClick={onStartChat}
              className="w-full px-4 py-3 bg-gradient-to-r from-accent to-accent-hover text-white font-bold rounded-xl transition-all hover:shadow-lg hover:shadow-accent/20 flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-message"></i>
              Start Private Chat
            </button>

            {/* Report User */}
            <button
              onClick={onReport}
              className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/10 hover:border-white/20 flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-flag"></i>
              Report User
            </button>

            {/* Admin Actions */}
            {isAdmin && (
              <>
                <div className="border-t border-white/10 my-4 pt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-bold">Admin Actions</p>
                  
                  {/* Mute User */}
                  <button
                    onClick={() => {
                      setConfirmAction('mute');
                      setShowConfirmModal(true);
                    }}
                    className="w-full px-4 py-3 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 font-bold rounded-xl transition-all border border-yellow-600/30 hover:border-yellow-600/50 flex items-center justify-center gap-2 mb-2"
                  >
                    <i className="fa-solid fa-volume-xmark"></i>
                    Mute User
                  </button>

                  {/* Ban/Unban from Chat */}
                  {isChatBanned ? (
                    <button
                      onClick={handleUnbanFromChat}
                      disabled={isProcessing}
                      className="w-full px-4 py-3 bg-green-600/20 hover:bg-green-600/30 text-green-400 font-bold rounded-xl transition-all border border-green-600/30 hover:border-green-600/50 flex items-center justify-center gap-2 mb-2 disabled:opacity-50"
                    >
                      <i className="fa-solid fa-check-circle"></i>
                      {isProcessing ? 'Processing...' : 'Unban from Chat'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setConfirmAction('ban');
                        setShowConfirmModal(true);
                      }}
                      className="w-full px-4 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-bold rounded-xl transition-all border border-red-600/30 hover:border-red-600/50 flex items-center justify-center gap-2 mb-2"
                    >
                      <i className="fa-solid fa-ban"></i>
                      Ban from Chat
                    </button>
                  )}

                  {/* Isolate/Remove Isolation User */}
                  {isIsolated ? (
                    <button
                      onClick={handleRemoveIsolation}
                      disabled={isProcessing}
                      className="w-full px-4 py-3 bg-green-600/20 hover:bg-green-600/30 text-green-400 font-bold rounded-xl transition-all border border-green-600/30 hover:border-green-600/50 flex items-center justify-center gap-2 mb-2 disabled:opacity-50"
                    >
                      <i className="fa-solid fa-unlock"></i>
                      {isProcessing ? 'Processing...' : 'Remove Isolation'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setConfirmAction('isolate');
                        setShowConfirmModal(true);
                      }}
                      className="w-full px-4 py-3 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 font-bold rounded-xl transition-all border border-purple-600/30 hover:border-purple-600/50 flex items-center justify-center gap-2 mb-2"
                    >
                      <i className="fa-solid fa-user-lock"></i>
                      Isolate User (Admin-Only Chat)
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Alert Modal */}
      {showAlertModal && alertModalConfig && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowAlertModal(false)}></div>
          <div className="relative bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-2xl p-6 max-w-md w-full border border-white/10 shadow-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                alertModalConfig.type === 'success' ? 'bg-green-500/20 text-green-400' :
                alertModalConfig.type === 'error' ? 'bg-red-500/20 text-red-400' :
                'bg-blue-500/20 text-blue-400'
              }`}>
                <i className={`fa-solid ${
                  alertModalConfig.type === 'success' ? 'fa-check-circle' :
                  alertModalConfig.type === 'error' ? 'fa-exclamation-circle' :
                  'fa-info-circle'
                } text-2xl`}></i>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2">{alertModalConfig.title}</h3>
                <p className="text-gray-300 text-sm">{alertModalConfig.message}</p>
              </div>
            </div>
            <button
              onClick={() => setShowAlertModal(false)}
              className="w-full px-4 py-3 bg-gradient-to-r from-accent to-accent-hover text-white font-bold rounded-xl transition-all hover:shadow-lg"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm"></div>
          <div className="relative bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-2xl p-6 max-w-md w-full border border-white/10 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">
              {confirmAction === 'mute' && 'Mute User'}
              {confirmAction === 'ban' && 'Ban from Chat'}
              {confirmAction === 'isolate' && 'Isolate User'}
            </h3>

            {/* Reason Input */}
            <textarea
              value={muteReason}
              onChange={(e) => setMuteReason(e.target.value)}
              placeholder="Reason for action..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 mb-4 resize-none"
              rows={3}
            />

            {/* Duration (only for mute) */}
            {confirmAction === 'mute' && (
              <select
                value={muteDuration}
                onChange={(e) => setMuteDuration(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white mb-4"
              >
                <option value="1h">1 Hour</option>
                <option value="24h">24 Hours</option>
                <option value="7d">7 Days</option>
                <option value="permanent">Permanent</option>
              </select>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isProcessing}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmActionHandler}
                disabled={isProcessing}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UserProfileModal;
