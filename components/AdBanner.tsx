import React, { useEffect, useRef } from 'react';

interface AdBannerProps {
  zoneId: string;
  format: 'banner' | 'native' | 'popunder' | 'video';
  className?: string;
  width?: number;
  height?: number;
}

const AdBanner: React.FC<AdBannerProps> = ({ zoneId, format, className = '', width, height }) => {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // ExoClick ad loading script (magsrv.com)
    if (adRef.current && zoneId) {
      // Clear previous content
      adRef.current.innerHTML = '';

      // Create the ad container
      const insElement = document.createElement('ins');
      insElement.className = 'eas6a97888e';
      insElement.setAttribute('data-zoneid', zoneId);

      adRef.current.appendChild(insElement);

      // Load ExoClick main script if not already loaded
      if (!document.querySelector('script[src*="magsrv.com/ad-provider.js"]')) {
        const mainScript = document.createElement('script');
        mainScript.type = 'application/javascript';
        mainScript.src = 'https://a.magsrv.com/ad-provider.js';
        mainScript.async = true;
        document.head.appendChild(mainScript);
      }

      // Trigger ad serving
      const serveScript = document.createElement('script');
      serveScript.innerHTML = '(AdProvider = window.AdProvider || []).push({"serve": {}});';
      adRef.current.appendChild(serveScript);

      // Fallback: If ad doesn't load in 3 seconds, show placeholder
      const fallbackTimer = setTimeout(() => {
        if (adRef.current && adRef.current.children.length <= 2) {
          // Ad didn't load, show placeholder
          const placeholderWidth = width || 728;
          const placeholderHeight = height || 90;
          adRef.current.innerHTML = `
            <div class="bg-gradient-to-br from-[#151515] to-[#0A0A0A] border border-white/10 rounded-lg flex flex-col items-center justify-center p-6 w-full" style="min-height: ${placeholderHeight}px;">
              <div class="flex items-center gap-3 mb-2">
                <i class="fa-solid fa-ad text-gray-600 text-3xl"></i>
                <div class="h-8 w-px bg-white/10"></div>
                <div>
                  <p class="text-sm text-gray-500 font-bold uppercase tracking-wider">Advertisement</p>
                  <p class="text-[10px] text-gray-700">Zone: ${zoneId}</p>
                </div>
              </div>
              <div class="flex items-center gap-2 mt-2">
                <div class="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
                <p class="text-xs text-gray-600">Loading content...</p>
              </div>
            </div>
          `;
        }
      }, 3000);

      return () => {
        clearTimeout(fallbackTimer);
      };
    }

    return () => {
      // Cleanup
      if (adRef.current) {
        adRef.current.innerHTML = '';
      }
    };
  }, [zoneId, format, width, height]);

  if (!zoneId) {
    // Placeholder when no zone ID is set
    return (
      <div 
        className={`bg-gradient-to-br from-[#151515] to-[#0A0A0A] border border-white/10 rounded-lg flex items-center justify-center ${className}`} 
        style={{ width: width ? `${width}px` : '100%', height: height || 90, maxWidth: '100%' }}
      >
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-ad text-gray-600 text-2xl"></i>
          <div className="h-6 w-px bg-white/10"></div>
          <p className="text-xs text-gray-600 uppercase tracking-wider font-bold">Ad Space Available</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={adRef} 
      className={`ad-container ${className}`}
      style={{ 
        width: width ? `${width}px` : '100%',
        minHeight: height || 'auto',
        maxWidth: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
      }}
    />
  );
};

export default AdBanner;
