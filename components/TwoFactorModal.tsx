import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { sendVerificationEmail } from '../utils/emailService';

interface TwoFactorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TwoFactorModal: React.FC<TwoFactorModalProps> = ({ isOpen, onClose }) => {
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [pendingAction, setPendingAction] = useState<'enable' | 'disable' | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  
  const user = auth.currentUser;

  // Load current 2FA status
  useEffect(() => {
    if (isOpen && user) {
      loadTwoFactorStatus();
    }
  }, [isOpen, user]);

  // Resend cooldown timer
  useEffect(() => {
    let interval: any;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const loadTwoFactorStatus = async () => {
    if (!user) return;
    
    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        setIs2FAEnabled(userSnap.data().twoFactorEnabled === true);
      }
    } catch (error) {
      console.error("Error loading 2FA status:", error);
    }
  };

  const generate2FACode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const send2FACode = async (userEmail: string, code: string) => {
    // Store in Firestore temporarily (expires in 5 minutes)
    const codeRef = doc(db, "2fa_codes", userEmail);
    await setDoc(codeRef, {
      code: code,
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    });
    
    // Send email using Resend API (100% FREE)
    const emailSent = await sendVerificationEmail({
      to: userEmail,
      subject: '🔐 Tu código de verificación poorn',
      code: code
    });
    
    return emailSent;
  };

  const verify2FACode = async (userEmail: string, inputCode: string) => {
    const codeRef = doc(db, "2fa_codes", userEmail);
    const codeSnap = await getDoc(codeRef);
    
    if (!codeSnap.exists()) {
      return false;
    }
    
    const data = codeSnap.data();
    const expiresAt = data.expiresAt.toDate();
    
    if (new Date() > expiresAt) {
      return false; // Code expired
    }
    
    return data.code === inputCode;
  };

  const handleToggle2FA = async () => {
    if (!user || !user.email) {
      setError('No se pudo obtener el email del usuario');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // Generate and send verification code
      const code = generate2FACode();
      setGeneratedCode(code);
      await send2FACode(user.email, code);
      
      // Set pending action
      setPendingAction(is2FAEnabled ? 'disable' : 'enable');
      setShowVerification(true);
      setSuccessMessage(`Código de verificación enviado a ${user.email}`);
    } catch (err: any) {
      setError('Error al enviar el código de verificación');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !user.email || !pendingAction) return;
    
    if (verificationCode.length !== 6) {
      setError('Por favor ingresa un código de 6 dígitos');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Verify the code
      const isValid = await verify2FACode(user.email, verificationCode);
      
      if (isValid) {
        // Update 2FA status in Firestore
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, {
          twoFactorEnabled: pendingAction === 'enable',
          twoFactorUpdatedAt: serverTimestamp()
        }, { merge: true });
        
        setIs2FAEnabled(pendingAction === 'enable');
        setSuccessMessage(
          pendingAction === 'enable' 
            ? '✅ Autenticación de 2 pasos activada correctamente' 
            : '✅ Autenticación de 2 pasos desactivada'
        );
        
        // Reset states
        setTimeout(() => {
          setShowVerification(false);
          setVerificationCode('');
          setPendingAction(null);
          setSuccessMessage('');
        }, 2000);
      } else {
        setError('❌ Código inválido o expirado');
      }
    } catch (err: any) {
      setError('Error al verificar el código');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!user || !user.email || resendCooldown > 0) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const code = generate2FACode();
      setGeneratedCode(code);
      await send2FACode(user.email, code);
      setSuccessMessage('Código reenviado!');
      setResendCooldown(60);
    } catch (err) {
      setError('Error al reenviar el código');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setShowVerification(false);
    setVerificationCode('');
    setPendingAction(null);
    setError('');
    setSuccessMessage('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-sans">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300" 
        onClick={handleClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-[480px] bg-[#0A0A0A] rounded-2xl overflow-hidden shadow-2xl animate-[fadeIn_0.3s_ease-out] border border-white/10">
        
        {/* Header */}
        <div className="relative bg-gradient-to-r from-purple-900/20 to-indigo-900/20 border-b border-white/10 p-6">
          <button 
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/10"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center border border-accent/40">
              <i className="fa-solid fa-shield-halved text-xl text-accent"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Autenticación de 2 Pasos</h2>
              <p className="text-xs text-gray-400">Protege tu cuenta con verificación adicional</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          
          {!showVerification ? (
            // Main Toggle View
            <div className="space-y-6">
              {/* Status Card */}
              <div className={`p-4 rounded-xl border ${is2FAEnabled ? 'bg-green-900/10 border-green-500/30' : 'bg-gray-800/30 border-white/10'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${is2FAEnabled ? 'bg-green-500/20' : 'bg-gray-700/50'}`}>
                      <i className={`fa-solid ${is2FAEnabled ? 'fa-check' : 'fa-lock'} ${is2FAEnabled ? 'text-green-400' : 'text-gray-400'}`}></i>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">
                        {is2FAEnabled ? 'Activado' : 'Desactivado'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {is2FAEnabled ? 'Tu cuenta está protegida' : 'Activa para mayor seguridad'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Toggle Switch */}
                  <button
                    onClick={handleToggle2FA}
                    disabled={isLoading}
                    className={`relative w-14 h-7 rounded-full transition-colors ${
                      is2FAEnabled ? 'bg-accent' : 'bg-gray-700'
                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                        is2FAEnabled ? 'translate-x-7' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Info Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white">¿Cómo funciona?</h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-accent">1</span>
                    </div>
                    <p className="text-xs text-gray-400">Inicia sesión con tu email y contraseña</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-accent">2</span>
                    </div>
                    <p className="text-xs text-gray-400">Recibes un código de 6 dígitos en tu email</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-accent">3</span>
                    </div>
                    <p className="text-xs text-gray-400">Ingresa el código para completar el acceso</p>
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-yellow-900/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
                <i className="fa-solid fa-triangle-exclamation text-yellow-500 text-sm mt-0.5"></i>
                <p className="text-xs text-yellow-200/80">
                  Asegúrate de tener acceso a tu email antes de activar esta función
                </p>
              </div>

              {successMessage && (
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 text-center">
                  <p className="text-sm text-green-400">{successMessage}</p>
                </div>
              )}

              {error && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-center">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
            </div>
          ) : (
            // Verification View
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-accent/40">
                  <i className="fa-solid fa-envelope text-2xl text-accent"></i>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Verifica tu identidad</h3>
                <p className="text-sm text-gray-400">
                  Ingresa el código de 6 dígitos enviado a<br/>
                  <span className="text-white font-semibold">{user?.email}</span>
                </p>
              </div>

              {successMessage && (
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 text-center">
                  <p className="text-xs text-green-400">{successMessage}</p>
                </div>
              )}

              <form onSubmit={handleVerifyCode} className="space-y-4">
                {error && (
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-center">
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}

                <div>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest placeholder-gray-600 focus:outline-none focus:border-accent transition-all"
                    required
                    autoFocus
                  />
                  <p className="text-[10px] text-gray-500 text-center mt-2">
                    Revisa tu bandeja de entrada y spam
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || verificationCode.length !== 6}
                  className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <i className="fa-solid fa-spinner fa-spin"></i>
                  ) : (
                    'Verificar Código'
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || isLoading}
                  className="w-full bg-white/5 hover:bg-white/10 text-white/70 font-bold py-3 rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <i className="fa-solid fa-spinner fa-spin"></i>
                  ) : resendCooldown > 0 ? (
                    `Reenviar Código (${resendCooldown}s)`
                  ) : (
                    'Reenviar Código'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowVerification(false);
                    setVerificationCode('');
                    setPendingAction(null);
                    setError('');
                  }}
                  className="w-full text-gray-400 hover:text-white text-sm transition-colors"
                >
                  Cancelar
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TwoFactorModal;
