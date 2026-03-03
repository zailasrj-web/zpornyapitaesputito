import React, { useState } from 'react';
import { User, deleteUser } from 'firebase/auth';
import { doc, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({ isOpen, onClose, user }) => {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    if (confirmText.toLowerCase() !== 'estoy seguro') {
      setError('Por favor escribe "estoy seguro" para confirmar');
      return;
    }

    setIsDeleting(true);
    setError('');

    try {
      // Delete user data from Firestore
      const batch = writeBatch(db);

      // Delete user document
      batch.delete(doc(db, 'users', user.uid));

      // Delete user's private chats
      const chatsQuery = query(
        collection(db, 'privateChats'),
        where('participants', 'array-contains', user.uid)
      );
      const chatsSnapshot = await getDocs(chatsQuery);
      chatsSnapshot.forEach((chatDoc) => {
        batch.delete(chatDoc.ref);
      });

      // Delete friend requests
      const requestsQuery = query(
        collection(db, 'friendRequests'),
        where('fromUserId', '==', user.uid)
      );
      const requestsSnapshot = await getDocs(requestsQuery);
      requestsSnapshot.forEach((reqDoc) => {
        batch.delete(reqDoc.ref);
      });

      const receivedRequestsQuery = query(
        collection(db, 'friendRequests'),
        where('toUserId', '==', user.uid)
      );
      const receivedRequestsSnapshot = await getDocs(receivedRequestsQuery);
      receivedRequestsSnapshot.forEach((reqDoc) => {
        batch.delete(reqDoc.ref);
      });

      // Delete friendships
      const friendsQuery = query(
        collection(db, 'friends'),
        where('userId', '==', user.uid)
      );
      const friendsSnapshot = await getDocs(friendsQuery);
      friendsSnapshot.forEach((friendDoc) => {
        batch.delete(friendDoc.ref);
      });

      // Commit all deletions
      await batch.commit();

      // Delete Firebase Auth account
      await deleteUser(user);

      // User will be automatically logged out
    } catch (error: any) {
      console.error('Error deleting account:', error);
      
      if (error.code === 'auth/requires-recent-login') {
        setError('Por seguridad, debes cerrar sesión y volver a iniciar sesión antes de eliminar tu cuenta.');
      } else {
        setError('Error al eliminar la cuenta. Por favor intenta de nuevo.');
      }
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setConfirmText('');
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 font-sans">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={handleClose} />

      <div className="relative w-full max-w-[500px] bg-[#0A0A0A] border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-red-500/20 bg-red-950/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <i className="fa-solid fa-triangle-exclamation text-red-500 text-xl"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-red-500">Eliminar Cuenta</h2>
              <p className="text-xs text-gray-500 mt-0.5">Esta acción es permanente</p>
            </div>
          </div>
          {!isDeleting && (
            <button onClick={handleClose} className="text-gray-500 hover:text-white transition-colors">
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <i className="fa-solid fa-exclamation-circle text-red-400 text-lg mt-0.5"></i>
              <div>
                <p className="text-sm font-bold text-red-400 mb-2">¡Advertencia!</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Al eliminar tu cuenta se borrarán permanentemente:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs text-gray-400 ml-2">
                  <li>Tu perfil y toda tu información personal</li>
                  <li>Todos tus mensajes y chats privados</li>
                  <li>Tus amigos y solicitudes de amistad</li>
                  <li>Tu historial de visualización y favoritos</li>
                  <li>Tu suscripción y beneficios</li>
                </ul>
                <p className="text-xs text-red-400 font-bold mt-3">
                  Esta acción NO se puede deshacer.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-white mb-2 block">
              Para confirmar, escribe: <span className="text-red-400">estoy seguro</span>
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value);
                setError('');
              }}
              placeholder="estoy seguro"
              disabled={isDeleting}
              className="w-full bg-[#151515] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-red-500 focus:outline-none transition-colors disabled:opacity-50"
            />
            {error && (
              <p className="text-xs text-red-400 mt-2 flex items-center gap-2">
                <i className="fa-solid fa-exclamation-circle"></i>
                {error}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={isDeleting}
              className="flex-1 bg-[#151515] hover:bg-[#202020] text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting || confirmText.toLowerCase() !== 'estoy seguro'}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  Eliminando...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-trash"></i>
                  Eliminar Cuenta
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteAccountModal;
