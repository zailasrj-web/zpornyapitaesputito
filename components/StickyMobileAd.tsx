import React, { useState } from 'react';
import AdBanner from './AdBanner';
import { AD_CONFIG } from '../adConfig';

interface StickyMobileAdProps {
  zoneId?: string;
}

const StickyMobileAd: React.FC<StickyMobileAdProps> = ({ zoneId }) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible || !zoneId) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-black border-t border-white/10 shadow-2xl animate-[slideUp_0.3s_ease-out]">
      <button 
        onClick={() => setIsVisible(false)}
        className="absolute -top-6 right-2 w-6 h-6 bg-black/80 rounded-full flex items-center justify-center text-white/60 hover:text-white text-xs border border-white/20"
      >
        <i className="fa-solid fa-xmark"></i>
      </button>
      <div className="flex justify-center py-2">
        <AdBanner 
          zoneId={zoneId} 
          format="banner" 
          width={320} 
          height={50}
        />
      </div>
    </div>
  );
};

export default StickyMobileAd;
