import React, { useState } from 'react';
import { Character } from '../types';

interface CharacterCardProps {
  character: Character;
  onClick?: () => void;
  currentUserId?: string;
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
  onReport?: (id: string) => void;
  onCopyLink?: (id: string) => void;
  onNotInterested?: (id: string) => void;
  onHide?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
}

const CharacterCard: React.FC<CharacterCardProps> = ({ 
  character, 
  onClick, 
  currentUserId, 
  isAdmin, 
  onDelete,
  onReport,
  onCopyLink,
  onNotInterested,
  onHide,
  onToggleFavorite
}) => {
  const [showMenu, setShowMenu] = useState(false);
  
  // Check if current user can delete (owner or admin)
  const canDelete = isAdmin || (currentUserId && character.authorId === currentUserId);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this video? This cannot be undone.')) {
      onDelete?.(character.id);
      setShowMenu(false);
    }
  };

  const handleReport = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReport?.(character.id);
    setShowMenu(false);
  };

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopyLink?.(character.id);
    setShowMenu(false);
  };

  const handleNotInterested = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNotInterested?.(character.id);
    setShowMenu(false);
  };

  const handleHide = (e: React.MouseEvent) => {
    e.stopPropagation();
    onHide?.(character.id);
    setShowMenu(false);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.(character.id);
    setShowMenu(false);
  };

  return (
    <div 
      onClick={onClick}
      className="relative group rounded-xl overflow-hidden aspect-square cursor-pointer bg-gray-900 border border-white/5 hover:border-accent/50 transition-all duration-500 shadow-md hover:shadow-xl hover:shadow-accent/5"
    >
      {/* Background Image */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <img
          src={character.image}
          alt={character.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 will-change-transform"
          loading="lazy"
        />
        
        {/* Dark overlay for better text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-500" />
      </div>

      {/* Three-dot Menu Button (Top Right) */}
      {currentUserId && (
        <div className="absolute top-2 right-2 z-30">
          <button
            onClick={handleMenuClick}
            className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg hover:bg-black/80 transition-colors"
          >
            <i className="fa-solid fa-ellipsis text-white text-sm"></i>
          </button>
          
          {/* Dropdown Menu */}
          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}
              />
              <div className="absolute right-0 mt-1 w-48 bg-[#1a1a1a] rounded-lg shadow-2xl border border-white/10 overflow-hidden z-50 animate-[fadeIn_0.1s_ease-out]">
                
                {/* Report - Always visible */}
                <button
                  onClick={handleReport}
                  className="w-full py-3 px-4 text-left text-red-500 font-bold hover:bg-white/5 transition-colors border-b border-white/10"
                >
                  Report
                </button>
                
                {/* Save to Favorites */}
                {onToggleFavorite && (
                  <button
                    onClick={handleToggleFavorite}
                    className="w-full py-3 px-4 text-left text-accent text-sm font-medium hover:bg-white/5 transition-colors border-b border-white/10 flex items-center gap-2"
                  >
                    <i className="fa-solid fa-heart text-xs"></i>
                    Save to Favorites
                  </button>
                )}
                
                {/* User Options */}
                <button
                  onClick={handleNotInterested}
                  className="w-full py-3 px-4 text-left text-white text-sm hover:bg-white/5 transition-colors border-b border-white/10"
                >
                  Not interested
                </button>
                
                <button
                  onClick={handleCopyLink}
                  className="w-full py-3 px-4 text-left text-white text-sm hover:bg-white/5 transition-colors border-b border-white/10"
                >
                  Copy link
                </button>
                
                {/* Admin Controls */}
                {isAdmin && (
                  <>
                    <div className="bg-white/5 px-2 py-1 text-[9px] text-gray-500 font-bold text-center uppercase tracking-widest border-b border-white/10">
                      Admin
                    </div>
                    
                    <button
                      onClick={handleHide}
                      className="w-full py-2.5 px-4 text-left text-yellow-400 text-sm font-medium hover:bg-white/5 transition-colors border-b border-white/10 flex items-center gap-2"
                    >
                      <i className="fa-regular fa-eye-slash text-xs"></i>
                      Hide
                    </button>
                  </>
                )}
                
                {/* Delete - Owner or Admin */}
                {canDelete && (
                  <button
                    onClick={handleDelete}
                    className="w-full py-2.5 px-4 text-left text-red-400 text-sm font-medium hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <i className="fa-regular fa-trash-can text-xs"></i>
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Play Icon Overlay */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 transform scale-90 group-hover:scale-100 z-10 hidden md:flex">
        <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-2xl hover:bg-white/30 hover:scale-110 transition-all duration-300 cursor-pointer">
          <i className="fa-solid fa-play text-white text-lg ml-1 drop-shadow-lg"></i>
        </div>
      </div>

      {/* Mobile Play Icon - Always visible on mobile */}
      <div className="absolute top-2 left-2 md:hidden z-20">
        <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
          <i className="fa-solid fa-play text-white text-xs ml-0.5"></i>
        </div>
      </div>

      {/* Glassmorphism Content Box - Fixed to bottom with margins */}
      <div className="absolute bottom-2 left-2 right-2 z-20">
        <div className="bg-black/60 md:bg-black/40 backdrop-blur-xl border border-white/10 rounded-lg p-2.5 md:p-3 shadow-lg transition-all duration-300 hover:bg-black/60">
            {/* Header: Title and Author */}
            <div className="flex items-start justify-between gap-2 mb-2 md:mb-2.5">
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm md:text-base font-bold text-white tracking-tight leading-tight truncate">
                        {character.name}
                    </h3>
                    {character.authorName && (
                        <p className="text-[9px] md:text-[10px] text-gray-400 mt-0.5 truncate">
                            {character.authorName.replace('@', '')}
                        </p>
                    )}
                </div>
            </div>

            {/* Footer Stats */}
            <div className="flex items-center gap-3 md:gap-4 text-[10px] md:text-[11px] text-gray-300 font-medium">
                <div className="flex items-center gap-1 group/stat">
                    <i className="fa-solid fa-heart text-[10px] md:text-[11px] text-gray-400 group-hover/stat:text-accent transition-colors"></i>
                    <span>{character.likes}</span>
                </div>
                <div className="flex items-center gap-1 group/stat">
                    <i className="fa-solid fa-eye text-[10px] md:text-[11px] text-gray-400 group-hover/stat:text-white transition-colors"></i>
                    <span>{character.views}</span>
                </div>
                <div className="flex items-center gap-1 group/stat">
                    <i className="fa-solid fa-comment text-[10px] md:text-[11px] text-gray-400 group-hover/stat:text-blue-400 transition-colors"></i>
                    <span>{character.comments || 0}</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterCard;