import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  OAuthProvider,
  TwitterAuthProvider,
  sendPasswordResetEmail,
  updateProfile,
  sendEmailVerification,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  updatePassword,
  ConfirmationResult,
  User,
  signOut
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import LegalDocs from './LegalDocs';
import { sendVerificationEmail } from '../utils/emailService';

// Extend window interface for recaptcha
declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onDemoLogin?: () => void;
}

type ViewState = 'menu' | 'email' | 'signup' | 'forgot-password' | 'phone-entry' | 'phone-verify' | 'complete-profile' | 'terms' | 'privacy' | 'verify-email' | '2fa-verify' | '2fa-setup';
type SocialProvider = 'google' | 'discord' | 'twitter';

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, title, onDemoLogin }) => {
  const [view, setView] = useState<ViewState>('menu');
  
  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  
  // Username Availability States
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  // Phone Auth States
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  
  // 2FA States
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [generated2FACode, setGenerated2FACode] = useState('');
  
  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode>(''); 
  const [successMessage, setSuccessMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  
  // Retry Logic State
  const [lastProvider, setLastProvider] = useState<SocialProvider | null>(null);

  // Reset view and state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setView('menu');
      resetForm();
    }
  }, [isOpen]);

  // Cleanup Recaptcha on unmount or close
  useEffect(() => {
    if (!isOpen && window.recaptchaVerifier) {
        try {
            window.recaptchaVerifier.clear();
            window.recaptchaVerifier = null;
        } catch(e) {
            console.error(e);
        }
    }
  }, [isOpen]);

  // Timer for resend button cooldown
  useEffect(() => {
    let interval: any;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // --- STRICT USERNAME VALIDATION LOGIC ---
  const validateUsernameFormat = (name: string): boolean => {
      // Instagram style: letters, numbers, periods, underscores. No spaces.
      const regex = /^[a-zA-Z0-9_.]+$/;
      return regex.test(name);
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Auto-remove spaces and enforce lowercase (optional, but cleaner)
      const val = e.target.value.replace(/\s/g, ''); 
      setUsername(val);
  };

  // Username Availability Checker (Debounced)
  useEffect(() => {
    const checkAvailability = async () => {
        if (username.length < 3) {
            setIsUsernameAvailable(null);
            return;
        }

        if (!validateUsernameFormat(username)) {
            setIsUsernameAvailable(false);
            return;
        }

        setIsCheckingUsername(true);
        setIsUsernameAvailable(null);

        // Simulation of an API call to database
        setTimeout(() => {
            const takenUsernames = ['admin', 'test', 'porn', 'root', 'user'];
            const isTaken = takenUsernames.includes(username.toLowerCase());
            
            setIsUsernameAvailable(!isTaken);
            setIsCheckingUsername(false);
        }, 800); 
    };

    const timeoutId = setTimeout(() => {
        if (view === 'signup' || view === 'complete-profile') {
            checkAvailability();
        }
    }, 500); 

    return () => clearTimeout(timeoutId);
  }, [username, view]);


  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setUsername('');
    setPhoneNumber('');
    setVerificationCode('');
    setConfirmationResult(null);
    setError('');
    setSuccessMessage('');
    setIsLoading(false);
    setLastProvider(null);
    setIsUsernameAvailable(null);
    setTwoFactorCode('');
    setPendingUser(null);
    setGenerated2FACode('');
  };

  const switchView = (newView: ViewState) => {
    setError('');
    setSuccessMessage('');
    setView(newView);
  };

  // --- 2FA HELPERS ---
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

  // --- HELPER: SAVE USER TO FIRESTORE ---
  const saveUserToFirestore = async (user: User, customUsername?: string) => {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    // Get user's IP address
    let userIP = 'unknown';
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      userIP = ipData.ip;
    } catch (error) {
      console.error("Error fetching IP:", error);
    }

    if (!userSnap.exists()) {
        // Generate a username from email if not provided
        let finalUsername = customUsername;
        if (!finalUsername) {
            finalUsername = user.email ? user.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') : `user_${user.uid.substring(0, 6)}`;
        }
        
        // Ensure lowercase for search consistency
        finalUsername = finalUsername.toLowerCase();

        // Use the actual photo from Firebase Auth (Google, etc.) if available
        // Only generate ui-avatars as last resort
        const displayNameForAvatar = user.displayName || finalUsername;
        let photoURL = user.photoURL; // Use actual photo from auth provider
        
        // Only generate avatar if there's truly no photo
        if (!photoURL || photoURL.trim() === '') {
            photoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayNameForAvatar)}&background=6366f1&color=fff&size=200&bold=true`;
        }

        await setDoc(userRef, {
            username: finalUsername,
            displayName: user.displayName || finalUsername,
            name: user.displayName || finalUsername,
            handle: finalUsername,
            email: user.email || '',
            photoURL: photoURL,
            avatar: photoURL,
            coverPhotoURL: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1000&auto=format&fit=crop',
            bio: '',
            isVerified: false,
            createdAt: serverTimestamp(),
            uid: user.uid,
            lastIP: userIP,
            lastLogin: serverTimestamp(),
            lastActive: serverTimestamp()
        });
    } else {
        // Update existing user to ensure email and IP are saved
        const existingData = userSnap.data();
        const updateData: any = {
            lastIP: userIP,
            lastLogin: serverTimestamp()
        };
        
        if (!existingData.email && user.email) {
            updateData.email = user.email;
        }
        
        // Update photoURL only if the user doesn't have one OR if Firebase Auth has a better one
        if (!existingData.photoURL || existingData.photoURL === '' || existingData.photoURL.includes('ui-avatars')) {
            // If Firebase Auth has a real photo (Google, etc.), use it
            if (user.photoURL && !user.photoURL.includes('ui-avatars')) {
                updateData.photoURL = user.photoURL;
                updateData.avatar = user.photoURL;
            } else if (!existingData.photoURL || existingData.photoURL === '') {
                // Only generate ui-avatars if there's truly no photo
                const displayNameForAvatar = existingData.displayName || existingData.username || 'User';
                updateData.photoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayNameForAvatar)}&background=6366f1&color=fff&size=200&bold=true`;
                updateData.avatar = updateData.photoURL;
            }
        }
        
        await setDoc(userRef, updateData, { merge: true });
    }
  };

  // --- Auth Handlers ---

  const handleSocialLogin = async (providerName: SocialProvider) => {
    setIsLoading(true);
    setError('');
    setLastProvider(providerName);
    
    let provider;
    switch (providerName) {
        case 'google':
            provider = new GoogleAuthProvider();
            break;
        case 'discord':
            provider = new OAuthProvider('discord.com');
            break;
        case 'twitter':
            provider = new TwitterAuthProvider();
            break;
    }

    if (!provider) return;

    try {
      const result = await signInWithPopup(auth, provider);
      // Ensure social login users are added to DB for search
      await saveUserToFirestore(result.user);
      onClose();
    } catch (err: any) {
      console.error("Login Error Details:", err);
      let errorContent: React.ReactNode = "Login failed.";
      setError(err.message || errorContent);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // Check if user has 2FA enabled
      const userRef = doc(db, "users", result.user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists() && userSnap.data().twoFactorEnabled) {
        // User has 2FA enabled, send code
        const code = generate2FACode();
        setGenerated2FACode(code);
        await send2FACode(result.user.email!, code);
        
        // Sign out temporarily
        await signOut(auth);
        
        // Store pending user
        setPendingUser(result.user);
        setView('2fa-verify');
        setSuccessMessage(`Código de verificación enviado a ${result.user.email}`);
      } else {
        // No 2FA, proceed normally
        await saveUserToFirestore(result.user);
        onClose();
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/user-not-found') {
        setError('No user found with this email.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password.');
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password || !username || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    // Strict Format Check
    if (!validateUsernameFormat(username)) {
        setError('Username can only contain letters, numbers, periods(.) and underscores(_). No spaces.');
        return;
    }

    if (isUsernameAvailable === false) {
      setError('Please choose a different username');
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // 1. Update Auth Profile
      await updateProfile(userCredential.user, {
        displayName: username
      });

      // 2. CRITICAL: Save to Firestore for Search
      await saveUserToFirestore(userCredential.user, username);

      await sendEmailVerification(userCredential.user);
      switchView('verify-email');
      
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('That email is already in use.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const user = auth.currentUser;
    if (user && resendCooldown === 0) {
        setIsLoading(true);
        try {
            await sendEmailVerification(user);
            setSuccessMessage("Verification email sent again!");
            setResendCooldown(60); 
        } catch (error: any) {
            setError("Error sending email: " + error.message);
        } finally {
            setIsLoading(false);
        }
    }
  };

  // --- Real Phone Flow Handlers ---

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': () => {
          // reCAPTCHA solved, allow signInWithPhoneNumber.
          handleSendPhoneCode(undefined);
        }
      });
    }
  };

  const handleSendPhoneCode = async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      
      if(phoneNumber.length < 8) {
          setError("Please enter a valid phone number (e.g. +15555555555)");
          return;
      }

      setIsLoading(true);
      setError('');
      
      try {
          setupRecaptcha();
          const appVerifier = window.recaptchaVerifier;
          
          const confirmation = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
          setConfirmationResult(confirmation);
          
          setIsLoading(false);
          switchView('phone-verify');
      } catch (error: any) {
          setIsLoading(false);
          console.error(error);
          if (error.code === 'auth/invalid-phone-number') {
              setError("Invalid phone number format. Include country code (e.g. +1...)");
          } else if (error.code === 'auth/too-many-requests') {
              setError("Too many requests. Try again later.");
          } else {
              setError("Error sending code: " + error.message);
          }
          // Reset recaptcha on error
          if (window.recaptchaVerifier) {
              window.recaptchaVerifier.clear();
              window.recaptchaVerifier = null;
          }
      }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
      e.preventDefault();
      if(verificationCode.length !== 6) {
          setError("Code must be 6 digits");
          return;
      }
      if (!confirmationResult) {
          setError("Session expired. Please restart.");
          return;
      }

      setIsLoading(true);
      setError('');

      try {
          await confirmationResult.confirm(verificationCode);
          // User is now signed in via Phone.
          setIsLoading(false);
          switchView('complete-profile');
      } catch (error: any) {
          setIsLoading(false);
          if (error.code === 'auth/invalid-verification-code') {
              setError("Invalid code. Please try again.");
          } else {
              setError("Verification failed: " + error.message);
          }
      }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!username || !password || !confirmPassword) {
          setError("All fields are required");
          return;
      }
      if (password !== confirmPassword) {
          setError("Passwords do not match");
          return;
      }

      // Strict Validation
      if (!validateUsernameFormat(username)) {
        setError('Username can only contain letters, numbers, periods(.) and underscores(_). No spaces.');
        return;
      }

      if (isUsernameAvailable === false) {
          setError("Username not available");
          return;
      }

      setIsLoading(true);
      try {
         const user = auth.currentUser;
         if (user) {
             // 1. Update Display Name
             await updateProfile(user, { displayName: username });
             
             // 2. Set Password for this account (So they can login via phone or potential email link later)
             await updatePassword(user, password);

             // 3. Save to Firestore for Search
             await saveUserToFirestore(user, username);
             
             onClose();
         } else {
             setError("No active user found. Please login again.");
         }
      } catch (error: any) {
         setError("Error updating profile: " + error.message);
      } finally {
         setIsLoading(false);
      }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage('Password reset email sent! Check your inbox.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FAVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorCode || twoFactorCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }
    if (!pendingUser) {
      setError('Session expired. Please login again.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Verify the code
      const isValid = await verify2FACode(pendingUser.email!, twoFactorCode);
      
      if (isValid) {
        // Code is valid, sign in the user again
        await signInWithEmailAndPassword(auth, pendingUser.email!, password);
        await saveUserToFirestore(pendingUser);
        setSuccessMessage('Verificación exitosa!');
        onClose();
      } else {
        setError('Código inválido o expirado. Intenta de nuevo.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al verificar el código');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend2FACode = async () => {
    if (!pendingUser || resendCooldown > 0) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const code = generate2FACode();
      setGenerated2FACode(code);
      await send2FACode(pendingUser.email!, code);
      setSuccessMessage('Código reenviado!');
      setResendCooldown(60);
    } catch (err: any) {
      setError('Error al reenviar el código');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-sans">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300" 
        onClick={onClose}
      />

      {/* Invisible Recaptcha Container */}
      <div id="recaptcha-container"></div>

      {/* Modal Card */}
      <div className="relative w-full max-w-[420px] bg-black rounded-3xl overflow-hidden shadow-2xl animate-[fadeIn_0.3s_ease-out] border border-white/10">
        
        {/* Background Image - Persistent across views */}
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop" 
            alt="Abstract Background" 
            className="w-full h-full object-cover opacity-40"
          />
          {/* Dark Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/90 to-black backdrop-blur-[2px]" />
        </div>

        {/* Content Container */}
        <div className="relative z-10 flex flex-col px-8 py-10 min-h-[550px]">
          
          {/* Menu View */}
          {view === 'menu' && (
            <div className="flex flex-col items-center justify-center animate-[fadeIn_0.3s_ease-out] h-full">
              <div className="mb-6">
                 <img src="https://res.cloudinary.com/dbfza2zyk/image/upload/v1768852307/ZZPO_lmy5e2.png" className="w-12 h-12 mx-auto mb-4" />
                 <h2 className="text-2xl font-bold text-white tracking-wide drop-shadow-lg uppercase text-center">
                    {title}
                 </h2>
              </div>

              {error && (
                <div className="w-full mb-4">
                    <div className="text-red-400 text-xs text-center bg-red-900/60 p-3 rounded-lg border border-red-500/30 leading-tight break-words shadow-md backdrop-blur-md">
                        {error}
                    </div>
                </div>
              )}

              <div className="w-full space-y-3">
                {/* Google Button */}
                <button 
                  onClick={() => handleSocialLogin('google')}
                  className="w-full bg-white hover:bg-gray-200 text-black font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-lg text-sm"
                >
                   <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                   <span>Continue with Google</span>
                </button>
                
                {/* X (Twitter) Button */}
                <button 
                  onClick={() => handleSocialLogin('twitter')}
                  className="w-full bg-black hover:bg-gray-900 border border-white/20 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-lg text-sm"
                >
                   <i className="fa-brands fa-x-twitter text-lg"></i>
                   <span>Continue with X</span>
                </button>

                {/* Discord Button */}
                <button 
                  onClick={() => handleSocialLogin('discord')}
                  className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-lg text-sm"
                >
                   <i className="fa-brands fa-discord text-lg"></i>
                   <span>Continue with Discord</span>
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 text-[10px] text-gray-400 font-bold my-2">
                    <div className="h-px bg-white/20 flex-1"></div>
                    <span>OR</span>
                    <div className="h-px bg-white/20 flex-1"></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {/* Email Button */}
                    <button 
                    onClick={() => switchView('email')}
                    className="w-full bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 backdrop-blur-sm shadow-lg text-sm"
                    >
                    <i className="fa-regular fa-envelope"></i>
                    <span>Email</span>
                    </button>

                    {/* Phone Button */}
                    <button 
                    onClick={() => switchView('phone-entry')}
                    className="w-full bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 backdrop-blur-sm shadow-lg text-sm"
                    >
                    <i className="fa-solid fa-phone"></i>
                    <span>Phone</span>
                    </button>
                </div>
                
                {/* DEMO LOGIN BUTTON */}
                {onDemoLogin && !error && (
                    <button 
                        onClick={onDemoLogin}
                        className="w-full mt-2 bg-gradient-to-r from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600 border border-white/10 text-white/80 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-xs uppercase tracking-wide"
                    >
                        <i className="fa-solid fa-user-secret"></i>
                        <span>Enter as Guest (Demo)</span>
                    </button>
                )}
              </div>

              {/* Footer Terms */}
              <div className="mt-8 text-center">
                <p className="text-[10px] leading-relaxed text-white/50 max-w-[280px] mx-auto font-medium">
                  By continuing, you agree to our <br/>
                  <button onClick={() => switchView('terms')} className="text-white hover:text-accent underline transition-colors">Terms and Conditions</button>
                  <span className="mx-1">&</span>
                  <button onClick={() => switchView('privacy')} className="text-white hover:text-accent underline transition-colors">Privacy Policy</button>
                </p>
              </div>
            </div>
          )}

          {/* Legal Docs Views */}
          {(view === 'terms' || view === 'privacy') && (
              <LegalDocs type={view} onBack={() => switchView('menu')} />
          )}

          {/* --- VERIFY EMAIL VIEW --- */}
          {view === 'verify-email' && (
             <div className="flex flex-col items-center justify-center animate-[fadeIn_0.3s_ease-out] h-full text-center">
                <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mb-6 border border-accent/40 shadow-lg shadow-accent/10">
                    <i className="fa-regular fa-envelope text-4xl text-accent"></i>
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-3">Verify your email</h2>
                <p className="text-white/70 text-sm mb-6 max-w-[280px] leading-relaxed">
                    We've sent a verification link to <br/>
                    <span className="text-white font-bold">{email}</span>
                </p>
                <p className="text-xs text-gray-400 mb-8 max-w-[260px]">
                    Click the link in the email to confirm your account helps us keep poorn secure.
                </p>

                {successMessage && (
                    <div className="text-green-400 text-xs bg-green-900/30 p-2 rounded mb-4 border border-green-500/20">
                        {successMessage}
                    </div>
                )}
                
                {error && (
                    <div className="text-red-400 text-xs bg-red-900/30 p-2 rounded mb-4 border border-red-500/20">
                        {error}
                    </div>
                )}

                <div className="w-full space-y-3">
                    <button 
                        onClick={async () => {
                             setIsLoading(true);
                             try {
                                 await auth.currentUser?.reload();
                                 if (auth.currentUser?.emailVerified) {
                                     onClose();
                                 } else {
                                     setError("Email not verified yet. Check your spam folder or try resending.");
                                 }
                             } catch(e) {
                                 setError("Error checking status. Try logging in again.");
                             } finally {
                                 setIsLoading(false);
                             }
                        }}
                        className="w-full bg-white text-black font-bold py-3.5 px-4 rounded-full transition-transform active:scale-95 shadow-lg hover:bg-gray-200"
                    >
                        {isLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : "I've Verified, Let me in!"}
                    </button>
                    
                    <button 
                        onClick={handleResendVerification}
                        disabled={resendCooldown > 0 || isLoading}
                        className="w-full bg-white/5 hover:bg-white/10 text-white/70 font-bold py-3.5 px-4 rounded-full transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <i className="fa-solid fa-spinner fa-spin"></i>
                        ) : resendCooldown > 0 ? (
                            `Resend Email (${resendCooldown}s)`
                        ) : (
                            "Resend Email"
                        )}
                    </button>
                </div>
             </div>
          )}

          {/* ... Phone Views and others remain same structure, just using saveUserToFirestore ... */}
          {/* Phone Entry */}
          {view === 'phone-entry' && (
             <div className="flex flex-col animate-[fadeIn_0.3s_ease-out]">
                <button onClick={() => switchView('menu')} className="self-start text-white/70 hover:text-white mb-6 flex items-center gap-2 text-sm font-medium"><i className="fa-solid fa-arrow-left"></i> Back</button>
                <h2 className="text-2xl font-bold text-white mb-2">What's your number?</h2>
                <p className="text-white/60 text-sm mb-6">We'll send you a verification code.</p>

                <form onSubmit={handleSendPhoneCode} className="space-y-4">
                    {error && <p className="text-red-400 text-xs p-2 bg-red-900/20 rounded">{error}</p>}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-300 ml-1">Phone Number</label>
                        <input 
                            type="tel" 
                            value={phoneNumber} 
                            onChange={(e) => setPhoneNumber(e.target.value)} 
                            placeholder="+1 555 000 0000" 
                            className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent transition-all" 
                            required 
                        />
                        <p className="text-[10px] text-gray-500 ml-1">Must include country code (e.g. +1 for USA)</p>
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full bg-white text-black font-bold py-3.5 rounded-full flex justify-center items-center gap-2 mt-4 hover:bg-gray-200 transition-colors">
                        {isLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Send Code'}
                    </button>
                </form>
             </div>
          )}

          {/* Verify Code */}
          {view === 'phone-verify' && (
             <div className="flex flex-col animate-[fadeIn_0.3s_ease-out]">
                <button onClick={() => switchView('phone-entry')} className="self-start text-white/70 hover:text-white mb-6 flex items-center gap-2 text-sm font-medium"><i className="fa-solid fa-arrow-left"></i> Back</button>
                <h2 className="text-2xl font-bold text-white mb-2">Verify it's you</h2>
                <p className="text-white/60 text-sm mb-6">Enter the 6-digit code sent to {phoneNumber}</p>

                <form onSubmit={handleVerifyCode} className="space-y-4">
                    {error && <p className="text-red-400 text-xs p-2 bg-red-900/20 rounded">{error}</p>}
                    <div className="space-y-1">
                        <input type="text" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} placeholder="000000" maxLength={6} className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest placeholder-gray-600 focus:outline-none focus:border-accent transition-all" required />
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full bg-accent text-white font-bold py-3.5 rounded-full flex justify-center items-center gap-2 mt-4 hover:bg-accent-hover transition-colors">
                        {isLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Verify'}
                    </button>
                </form>
             </div>
          )}

          {/* Complete Profile */}
          {view === 'complete-profile' && (
             <div className="flex flex-col animate-[fadeIn_0.3s_ease-out]">
                <h2 className="text-2xl font-bold text-white mb-2">Finish Setup</h2>
                <p className="text-white/60 text-sm mb-6">Set your username and password to secure your account.</p>

                <form onSubmit={handleCompleteProfile} className="space-y-4">
                    {error && <p className="text-red-400 text-xs p-2 bg-red-900/20 rounded">{error}</p>}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-300 ml-1">Choose Username</label>
                        <input 
                            type="text" 
                            value={username} 
                            onChange={handleUsernameChange} 
                            placeholder="@dreamer" 
                            className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent transition-all" 
                            required 
                        />
                         {/* Username Availability Indicator */}
                         <div className="ml-1 h-4 flex items-center">
                            {isCheckingUsername ? (
                                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                    <i className="fa-solid fa-circle-notch fa-spin"></i> Checking availability...
                                </span>
                            ) : username.length >= 3 ? (
                                isUsernameAvailable && validateUsernameFormat(username) ? (
                                    <span className="text-[10px] text-green-400 font-medium flex items-center gap-1">
                                        <i className="fa-solid fa-check"></i> Username available
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-red-400 font-medium flex items-center gap-1">
                                        <i className="fa-solid fa-xmark"></i> Not available or invalid format
                                    </span>
                                )
                            ) : null}
                         </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-300 ml-1">Set Password</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent transition-all" required />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-300 ml-1">Confirm Password</label>
                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm Password" className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent transition-all" required />
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full bg-white text-black font-bold py-3.5 rounded-full flex justify-center items-center gap-2 mt-4 hover:bg-gray-200 transition-colors">
                        {isLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Complete Setup'}
                    </button>
                </form>
             </div>
          )}

          {/* 2FA Verification View */}
          {view === '2fa-verify' && (
             <div className="flex flex-col animate-[fadeIn_0.3s_ease-out]">
                <button onClick={() => switchView('email')} className="self-start text-white/70 hover:text-white mb-6 flex items-center gap-2 text-sm font-medium"><i className="fa-solid fa-arrow-left"></i> Back</button>
                
                <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mb-6 border border-accent/40 shadow-lg shadow-accent/10 mx-auto">
                    <i className="fa-solid fa-shield-halved text-4xl text-accent"></i>
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-2 text-center">Verificación de 2 Pasos</h2>
                <p className="text-white/60 text-sm mb-6 text-center">Ingresa el código de 6 dígitos enviado a tu correo</p>

                {successMessage && (
                    <div className="text-green-400 text-xs bg-green-900/30 p-2 rounded mb-4 border border-green-500/20 text-center">
                        {successMessage}
                    </div>
                )}

                <form onSubmit={handle2FAVerification} className="space-y-4">
                    {error && <p className="text-red-400 text-xs p-2 bg-red-900/20 rounded text-center">{error}</p>}
                    <div className="space-y-1">
                        <input 
                            type="text" 
                            value={twoFactorCode} 
                            onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))} 
                            placeholder="000000" 
                            maxLength={6} 
                            className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest placeholder-gray-600 focus:outline-none focus:border-accent transition-all" 
                            required 
                            autoFocus
                        />
                        <p className="text-[10px] text-gray-500 text-center">Revisa tu bandeja de entrada y spam</p>
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={isLoading || twoFactorCode.length !== 6} 
                        className="w-full bg-accent text-white font-bold py-3.5 rounded-full flex justify-center items-center gap-2 mt-4 hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Verificar Código'}
                    </button>

                    <button 
                        type="button"
                        onClick={handleResend2FACode}
                        disabled={resendCooldown > 0 || isLoading}
                        className="w-full bg-white/5 hover:bg-white/10 text-white/70 font-bold py-3 px-4 rounded-full transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <i className="fa-solid fa-spinner fa-spin"></i>
                        ) : resendCooldown > 0 ? (
                            `Reenviar Código (${resendCooldown}s)`
                        ) : (
                            "Reenviar Código"
                        )}
                    </button>
                </form>
             </div>
          )}

          {/* Email Login View */}
          {view === 'email' && (
            <div className="flex flex-col animate-[fadeIn_0.3s_ease-out]">
              <button onClick={() => switchView('menu')} className="self-start text-white/70 hover:text-white transition-colors mb-4 group flex items-center gap-2 text-sm font-medium"><i className="fa-solid fa-arrow-left group-hover:-translate-x-1 transition-transform"></i> Back</button>

              <h2 className="text-2xl font-bold text-white mb-2 tracking-wide drop-shadow-lg">Sign in</h2>
              <p className="text-white/60 text-sm mb-6">Enter your details to continue</p>

              <form className="w-full space-y-4" onSubmit={handleEmailLogin}>
                {error && <div className="text-red-400 text-xs text-center bg-red-900/30 p-2 rounded border border-red-500/20">{error}</div>}
                
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 ml-1">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent transition-all" required />
                </div>
                
                <div className="space-y-1">
                   <div className="flex justify-between items-center ml-1">
                      <label className="text-xs font-semibold text-gray-300">Password</label>
                      <button type="button" onClick={() => switchView('forgot-password')} className="text-[10px] text-accent hover:text-accent-hover transition-colors">Forgot Password?</button>
                   </div>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent transition-all" required />
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={isLoading} className="w-full bg-white text-black font-bold py-3.5 px-4 rounded-full flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg hover:bg-gray-100 disabled:opacity-70">
                    {isLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Sign In'}
                  </button>
                </div>
              </form>
              
              <div className="mt-6 text-center">
                <p className="text-[10px] leading-relaxed text-white/70 font-medium">
                   Don't have an account? <button onClick={() => switchView('signup')} className="text-white underline cursor-pointer hover:text-accent transition-colors">Sign up</button>
                </p>
              </div>
            </div>
          )}

          {/* Sign Up View */}
          {view === 'signup' && (
            <div className="flex flex-col animate-[fadeIn_0.3s_ease-out] max-h-[80vh] overflow-y-auto scrollbar-hide">
              <button onClick={() => switchView('email')} className="self-start text-white/70 hover:text-white transition-colors mb-4 group flex items-center gap-2 text-sm font-medium"><i className="fa-solid fa-arrow-left group-hover:-translate-x-1 transition-transform"></i> Back</button>

              <h2 className="text-2xl font-bold text-white mb-2 tracking-wide drop-shadow-lg">Create Account</h2>
              <p className="text-white/60 text-sm mb-6">Join the community</p>

              <form className="w-full space-y-3" onSubmit={handleSignup}>
                {error && <div className="text-red-400 text-xs text-center bg-red-900/30 p-2 rounded border border-red-500/20">{error}</div>}

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 ml-1">Username</label>
                  <input 
                    type="text" 
                    value={username} 
                    onChange={handleUsernameChange} 
                    placeholder="Choose a username (no spaces)" 
                    className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none transition-all ${
                        isUsernameAvailable === false ? 'border-red-500/50 focus:border-red-500' : 
                        isUsernameAvailable === true ? 'border-green-500/50 focus:border-green-500' : 
                        'border-white/20 focus:border-accent'
                    }`}
                    required 
                  />
                  {/* Username Availability Indicator */}
                  <div className="ml-1 h-4 flex items-center">
                    {isCheckingUsername ? (
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <i className="fa-solid fa-circle-notch fa-spin"></i> Checking availability...
                        </span>
                    ) : username.length >= 3 ? (
                        isUsernameAvailable && validateUsernameFormat(username) ? (
                            <span className="text-[10px] text-green-400 font-medium flex items-center gap-1">
                                <i className="fa-solid fa-check"></i> Username available
                            </span>
                        ) : (
                            <span className="text-[10px] text-red-400 font-medium flex items-center gap-1">
                                <i className="fa-solid fa-xmark"></i> Not available or invalid format
                            </span>
                        )
                    ) : null}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 ml-1">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent transition-all" required />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 ml-1">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent transition-all" required />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 ml-1">Confirm Password</label>
                  <input 
                    type="password" 
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)} 
                    placeholder="Repeat your password" 
                    className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none transition-all ${
                        confirmPassword && password !== confirmPassword 
                        ? 'border-red-500/50 focus:border-red-500' 
                        : 'border-white/20 focus:border-accent'
                    }`}
                    required 
                  />
                  {confirmPassword && password !== confirmPassword && (
                      <p className="text-[10px] text-red-400 ml-1">Passwords do not match</p>
                  )}
                </div>

                <div className="pt-4">
                  <button type="submit" disabled={isLoading} className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-3.5 px-4 rounded-full flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-purple-900/40 disabled:opacity-70">
                    {isLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Forgot Password View */}
          {view === 'forgot-password' && (
            <div className="flex flex-col animate-[fadeIn_0.3s_ease-out]">
              <button onClick={() => switchView('email')} className="self-start text-white/70 hover:text-white transition-colors mb-4 group flex items-center gap-2 text-sm font-medium"><i className="fa-solid fa-arrow-left group-hover:-translate-x-1 transition-transform"></i> Back</button>

              <h2 className="text-2xl font-bold text-white mb-2 tracking-wide drop-shadow-lg">Reset Password</h2>
              <p className="text-white/60 text-sm mb-6">Enter your email and we'll send you a link to reset your password.</p>

              <form className="w-full space-y-4" onSubmit={handlePasswordReset}>
                 {error && <div className="text-red-400 text-xs text-center bg-red-900/30 p-2 rounded border border-red-500/20">{error}</div>}
                 {successMessage && <p className="text-green-400 text-xs text-center bg-green-900/30 p-2 rounded border border-green-500/20">{successMessage}</p>}

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 ml-1">Email Address</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your registered email" className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent transition-all" required />
                </div>

                <div className="pt-4">
                  <button type="submit" disabled={isLoading} className="w-full bg-white text-black font-bold py-3.5 px-4 rounded-full flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg hover:bg-gray-100 disabled:opacity-70">
                    {isLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default LoginModal;