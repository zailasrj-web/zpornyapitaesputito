import React, { useState } from 'react';

interface AgeGateProps {
  onVerify: () => void;
}

const AgeGate: React.FC<AgeGateProps> = ({ onVerify }) => {
  const [showParentalControls, setShowParentalControls] = useState(false);

  const handleExit = () => {
    // Redirect to a safe site
    window.location.href = 'https://www.google.com';
  };

  // Parental Controls View
  if (showParentalControls) {
      return (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center p-4 text-center font-sans animate-[fadeIn_0.3s_ease-out] overflow-y-auto">
             <div className="max-w-2xl w-full bg-[#0A0A0A] border border-white/10 rounded-2xl p-8 md:p-12 shadow-2xl relative">
                <button 
                    onClick={() => setShowParentalControls(false)}
                    className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
                >
                    <i className="fa-solid fa-xmark text-xl"></i>
                </button>

                <div className="flex items-center justify-center gap-3 mb-8">
                     <i className="fa-solid fa-shield-cat text-4xl text-accent"></i>
                     <h2 className="text-3xl font-bold text-white">Parental Controls</h2>
                </div>

                <p className="text-gray-300 text-sm md:text-base mb-8 leading-relaxed">
                    poorn is an adult-only community. We are committed to preventing minors from accessing our content. If you are a parent or guardian and wish to block access to this site, we recommend the following effective methods:
                </p>

                <div className="space-y-4 text-left mb-10">
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                        <h3 className="text-white font-bold text-sm mb-1 flex items-center gap-2">
                            <i className="fa-brands fa-windows text-blue-400"></i> / <i className="fa-brands fa-apple text-gray-300"></i> Operating System Settings
                        </h3>
                        <p className="text-gray-400 text-xs">Use <strong>Family Safety</strong> on Windows or <strong>Screen Time</strong> on macOS/iOS to restrict adult websites system-wide.</p>
                    </div>

                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                        <h3 className="text-white font-bold text-sm mb-1 flex items-center gap-2">
                            <i className="fa-solid fa-globe text-green-400"></i> DNS Filtering (Free)
                        </h3>
                        <p className="text-gray-400 text-xs">Configure your router or device to use <strong>OpenDNS FamilyShield</strong> (208.67.222.123) or <strong>Cloudflare Family</strong> (1.1.1.3) to automatically block adult content.</p>
                    </div>

                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                        <h3 className="text-white font-bold text-sm mb-1 flex items-center gap-2">
                            <i className="fa-solid fa-puzzle-piece text-amber-400"></i> Browser Extensions
                        </h3>
                        <p className="text-gray-400 text-xs">Install extensions like <strong>BlockSite</strong> or <strong>StayFocusd</strong> to explicitly block poorn.ai and other specific domains.</p>
                    </div>
                </div>

                <button 
                    onClick={() => setShowParentalControls(false)}
                    className="w-full bg-white text-black font-bold py-3.5 rounded-xl hover:bg-gray-200 transition-colors shadow-lg"
                >
                    Return to Entrance
                </button>
             </div>
        </div>
      );
  }

  // Standard Age Gate View
  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center p-4 text-center font-sans animate-[fadeIn_0.5s_ease-out]">
        <div className="max-w-3xl w-full">
            {/* Logo */}
            <div className="flex flex-col items-center justify-center gap-2 mb-8">
                 <div className="flex items-center gap-3">
                    <img 
                    src="https://res.cloudinary.com/dbfza2zyk/image/upload/v1768852307/ZZPO_lmy5e2.png" 
                    alt="poorn" 
                    className="w-14 h-14 object-contain"
                    />
                    <span className="text-5xl font-extrabold tracking-tighter text-white">
                        poorn
                    </span>
                 </div>
            </div>

            <h1 className="text-3xl md:text-5xl font-black text-white mb-10 tracking-tight">
                This is an <span className="text-accent">adult website</span>
            </h1>

            <div className="border border-accent/40 bg-accent/5 rounded-xl p-8 mb-10 backdrop-blur-sm shadow-[0_0_30px_rgba(168,85,247,0.1)]">
                <div className="inline-block border border-accent text-accent font-bold px-4 py-1 rounded mb-6 text-sm uppercase tracking-widest">
                    Notice to Users
                </div>
                <p className="text-gray-300 text-sm md:text-lg leading-relaxed font-medium">
                    This website contains age-restricted materials including nudity and explicit depictions of sexual activity. 
                    By entering, you affirm that you are at least <span className="font-bold text-white text-xl">18 years of age</span> or the age of majority in the jurisdiction you are accessing the website from and you consent to viewing sexually explicit content.
                </p>
                <div className="mt-6 text-xs text-gray-500">
                    Our Terms are changing. These changes will or have come into effect on 30 June 2025.
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-16">
                <button 
                    onClick={onVerify}
                    className="group relative px-8 py-5 bg-transparent overflow-hidden rounded-lg border-2 border-accent hover:bg-accent transition-all duration-300 shadow-[0_0_20px_rgba(168,85,247,0.2)] hover:shadow-[0_0_40px_rgba(168,85,247,0.5)]"
                >
                     <span className="relative font-black text-white uppercase tracking-wider text-base md:text-lg flex items-center justify-center gap-2 group-hover:scale-105 transition-transform">
                        I am 18 or older - Enter
                     </span>
                </button>
                
                <button 
                    onClick={handleExit}
                    className="px-8 py-5 rounded-lg border-2 border-gray-800 hover:border-gray-600 bg-gray-900/50 hover:bg-gray-900 text-gray-400 hover:text-white font-bold uppercase tracking-wider text-base md:text-lg transition-all"
                >
                    I am under 18 - Exit
                </button>
            </div>
            
            <div className="text-xs text-gray-600 max-w-lg mx-auto font-medium">
                <p>
                    Our <span onClick={() => setShowParentalControls(true)} className="text-gray-500 cursor-pointer hover:underline hover:text-gray-400 transition-colors">parental controls page</span> explains how you can easily block access to this site.
                </p>
                <p className="mt-2 opacity-50">
                     © 2026 poorn Inc. All rights reserved.
                </p>
            </div>
        </div>
    </div>
  );
};

export default AgeGate;