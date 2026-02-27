import React, { useState, useEffect, useRef } from 'react';
import { TAGS } from '../constants';

interface FiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedGender: string;
  onGenderChange: (gender: string) => void;
  selectedStyle: string;
  onStyleChange: (style: string) => void;
  selectedAge: string;
  onAgeChange: (age: string) => void;
  selectedSort: string;
  onSortChange: (sort: string) => void;
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
}

const Filters: React.FC<FiltersProps> = ({ 
  searchQuery, 
  onSearchChange,
  selectedGender,
  onGenderChange,
  selectedStyle,
  onStyleChange,
  selectedAge,
  onAgeChange,
  selectedSort,
  onSortChange,
  selectedTags,
  onTagToggle
}) => {
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  const [showAgeDropdown, setShowAgeDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const genderOptions = ['Any', 'Female', 'Male', 'Trans'];
  const styleOptions = ['Any', 'Realistic', 'Anime', 'Cartoon', 'Fantasy'];
  const ageOptions = ['Any', '18-25', '26-35', '36-45', '45+'];
  const sortOptions = ['Popular · Month', 'Popular · Week', 'Popular · All Time', 'Newest', 'Oldest'];

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.dropdown-container')) {
        setShowGenderDropdown(false);
        setShowStyleDropdown(false);
        setShowAgeDropdown(false);
        setShowSortDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  return (
    <div className="space-y-4 mb-6">
      {/* Search Row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <i className="fa-solid fa-magnifying-glass text-gray-500"></i>
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-3 bg-darkinput border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600 transition-colors"
            placeholder="Search videos..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <button className="px-4 bg-darkinput border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-colors">
          <i className="fa-solid fa-sliders"></i>
        </button>
      </div>

      {/* Dropdowns Row */}
      <div className="flex flex-wrap gap-2 text-sm">
        {/* Gender Dropdown */}
        <div className="relative dropdown-container">
          <button 
            onClick={() => setShowGenderDropdown(!showGenderDropdown)}
            className="flex items-center gap-2 bg-darkinput border border-gray-800 hover:border-gray-600 text-gray-300 px-4 py-2 rounded-lg"
          >
            Gender: <span className="text-white">{selectedGender}</span>
            <i className="fa-solid fa-chevron-down text-xs ml-1"></i>
          </button>
          {showGenderDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-darkinput border border-gray-700 rounded-lg shadow-lg z-10 min-w-[120px]">
              {genderOptions.map(option => (
                <button
                  key={option}
                  onClick={() => {
                    onGenderChange(option);
                    setShowGenderDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-700 transition-colors ${
                    selectedGender === option ? 'text-accent' : 'text-white'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Style Dropdown */}
        <div className="relative dropdown-container">
          <button 
            onClick={() => setShowStyleDropdown(!showStyleDropdown)}
            className="flex items-center gap-2 bg-darkinput border border-gray-800 hover:border-gray-600 text-gray-300 px-4 py-2 rounded-lg"
          >
            Style: <span className="text-white">{selectedStyle}</span>
            <i className="fa-solid fa-chevron-down text-xs ml-1"></i>
          </button>
          {showStyleDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-darkinput border border-gray-700 rounded-lg shadow-lg z-10 min-w-[120px]">
              {styleOptions.map(option => (
                <button
                  key={option}
                  onClick={() => {
                    onStyleChange(option);
                    setShowStyleDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-700 transition-colors ${
                    selectedStyle === option ? 'text-accent' : 'text-white'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Age Dropdown */}
        <div className="relative dropdown-container">
          <button 
            onClick={() => setShowAgeDropdown(!showAgeDropdown)}
            className="flex items-center gap-2 bg-darkinput border border-gray-800 hover:border-gray-600 text-gray-300 px-4 py-2 rounded-lg"
          >
            Age: <span className="text-white">{selectedAge}</span>
            <i className="fa-solid fa-chevron-down text-xs ml-1"></i>
          </button>
          {showAgeDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-darkinput border border-gray-700 rounded-lg shadow-lg z-10 min-w-[120px]">
              {ageOptions.map(option => (
                <button
                  key={option}
                  onClick={() => {
                    onAgeChange(option);
                    setShowAgeDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-700 transition-colors ${
                    selectedAge === option ? 'text-accent' : 'text-white'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort Dropdown */}
        <div className="relative dropdown-container ml-auto">
          <button 
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className="flex items-center gap-2 bg-darkinput border border-gray-800 hover:border-gray-600 text-gray-300 px-4 py-2 rounded-lg"
          >
            Sort by: <span className="text-white">{selectedSort}</span>
            <i className="fa-solid fa-chevron-down text-xs ml-1"></i>
          </button>
          {showSortDropdown && (
            <div className="absolute top-full right-0 mt-1 bg-darkinput border border-gray-700 rounded-lg shadow-lg z-10 min-w-[180px]">
              {sortOptions.map(option => (
                <button
                  key={option}
                  onClick={() => {
                    onSortChange(option);
                    setShowSortDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-700 transition-colors ${
                    selectedSort === option ? 'text-accent' : 'text-white'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tags Row */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
        {TAGS.map((tag, idx) => (
          <button
            key={idx}
            onClick={() => onTagToggle(tag.label)}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              selectedTags.includes(tag.label)
                ? 'bg-[#1e1a2a] text-accent border-accent/30'
                : 'bg-transparent text-gray-400 border-transparent hover:bg-gray-900 hover:text-white'
            }`}
          >
            {tag.label}
          </button>
        ))}
        {/* More arrow indicator if needed */}
        <button className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs text-gray-400 hover:text-white">
          <i className="fa-solid fa-chevron-right"></i>
        </button>
      </div>
    </div>
  );
};

export default Filters;