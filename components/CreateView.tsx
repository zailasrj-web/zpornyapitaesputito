import React from 'react';

interface CreateViewProps {
  onUploadClick?: () => void;
}

const CATEGORIES = [
  {
    id: 'solo',
    title: 'Solo Content',
    description: 'Upload your best solo performances and intimate moments.',
    icon: 'fa-solid fa-user',
    color: 'from-purple-500 to-indigo-500',
    badge: 'Popular'
  },
  {
    id: 'couples',
    title: 'Couples & Duos',
    description: 'Share passionate content with your partner or collaborator.',
    icon: 'fa-solid fa-heart',
    color: 'from-pink-500 to-rose-500'
  },
  {
    id: 'premium',
    title: 'Premium Exclusive',
    description: 'High-quality exclusive content for your premium subscribers.',
    icon: 'fa-solid fa-crown',
    color: 'from-amber-500 to-orange-500',
    badge: 'VIP'
  },
  {
    id: 'custom',
    title: 'Custom Requests',
    description: 'Fulfill custom requests and personalized content for fans.',
    icon: 'fa-solid fa-star',
    color: 'from-emerald-500 to-teal-500'
  }
];

const CreateView: React.FC<CreateViewProps> = ({ onUploadClick }) => {
  return (
    <div className="max-w-7xl mx-auto pt-2 pb-20 animate-[fadeIn_0.3s_ease-out] font-sans">
      
      {/* Hero Header */}
      <div className="relative rounded-3xl overflow-hidden mb-10 border border-white/10 shadow-2xl group">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-900 to-black"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
        {/* Animated Glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

        <div className="relative p-10 md:p-14 flex flex-col items-start justify-center min-h-[250px]">
             <div className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full text-xs font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                v2.5 Upload Engine Active
             </div>
             <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight leading-tight">
                Upload Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-accent">Content.</span>
             </h1>
             <p className="text-gray-400 text-base md:text-lg max-w-xl mb-8 leading-relaxed">
                Share your exclusive content with the world. Choose your category and start earning.
             </p>
             <button 
                onClick={onUploadClick}
                className="bg-white text-black font-extrabold py-3.5 px-8 rounded-full hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] flex items-center gap-2 group-hover:scale-105 active:scale-95"
             >
                <i className="fa-solid fa-upload text-sm"></i>
                Upload Content
             </button>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <i className="fa-solid fa-layer-group text-accent"></i> Content Categories
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {CATEGORIES.map((category) => (
                <div 
                    key={category.id} 
                    onClick={onUploadClick}
                    className="group relative bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 hover:bg-white/5 transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden"
                >
                    {/* Hover Gradient Border Effect */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${category.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}></div>
                    
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${category.color} flex items-center justify-center shadow-lg`}>
                                <i className={`${category.icon} text-xl text-white`}></i>
                            </div>
                            {category.badge && (
                                <span className="bg-white/10 border border-white/10 text-[10px] font-bold text-white px-2 py-1 rounded-md">
                                    {category.badge}
                                </span>
                            )}
                        </div>
                        
                        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-accent transition-colors">{category.title}</h3>
                        <p className="text-sm text-gray-500 leading-relaxed mb-6 flex-1">{category.description}</p>
                        
                        <div className="flex items-center text-xs font-bold text-gray-400 group-hover:text-white transition-colors">
                            Upload Now <i className="fa-solid fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>

    </div>
  );
};

export default CreateView;