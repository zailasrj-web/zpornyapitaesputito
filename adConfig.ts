// ExoClick Ad Configuration
// Get your Zone IDs from: https://www.exoclick.com/

export const AD_CONFIG = {
  // Enable/Disable all ads globally
  ADS_ENABLED: true,

  // AGGRESSIVE MODE: Maximum monetization
  AGGRESSIVE_MODE: true,

  // ExoClick Zone IDs
  ZONES: {
    // Top Banner (Desktop) - 728x90
    TOP_BANNER_DESKTOP: '5839814',
    
    // Top Banner (Mobile) - 320x50
    TOP_BANNER_MOBILE: '5839814',
    
    // Native Ad (Between content) - 300x250
    NATIVE_AD: '5839814',
    
    // Inline Native (Every 4 videos) - 300x250
    INLINE_NATIVE: '5839814',
    
    // Video Player Banner - 728x90
    VIDEO_BANNER: '5839814',
    
    // Sidebar Banner (Desktop) - 300x250
    SIDEBAR_BANNER: '',
    
    // Popunder (High revenue but can annoy users)
    POPUNDER: '', // Add Zone ID here for popunder
  },

  // Ad Placement Settings
  SETTINGS: {
    // Show ad every X videos in grid (más bajo = más ads)
    INLINE_AD_FREQUENCY: 4,  // ← Cambiado de 8 a 4 (más anuncios)
    
    // Show ads to admin/owner?
    SHOW_ADS_TO_ADMIN: true,
    
    // Show ads to Visionary tier?
    SHOW_ADS_TO_VISIONARY: true,
    
    // Show multiple native ads on same page
    SHOW_MULTIPLE_NATIVES: true,
    
    // Enable popunder (most aggressive)
    ENABLE_POPUNDER: false, // Set to true when you add popunder zone
  }
};

// Helper function to check if ads should be shown
export const shouldShowAds = (userTier?: string, isAdmin?: boolean): boolean => {
  if (!AD_CONFIG.ADS_ENABLED) return false;
  
  if (isAdmin && !AD_CONFIG.SETTINGS.SHOW_ADS_TO_ADMIN) return false;
  
  if (userTier === 'Visionary' && !AD_CONFIG.SETTINGS.SHOW_ADS_TO_VISIONARY) return false;
  
  return true;
};
