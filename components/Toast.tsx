import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000); // Disappear after 4 seconds

    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    info: 'fa-circle-info'
  };

  const colors = {
    success: 'border-green-500/50 text-green-400 bg-green-500/10',
    error: 'border-red-500/50 text-red-400 bg-red-500/10',
    info: 'border-blue-500/50 text-blue-400 bg-blue-500/10'
  };

  return (
    <div className={`fixed top-20 right-4 md:right-10 z-[200] flex items-center gap-3 px-6 py-4 rounded-xl border backdrop-blur-xl shadow-2xl animate-[slideIn_0.3s_ease-out] ${colors[type]}`}>
      <i className={`fa-solid ${icons[type]} text-xl`}></i>
      <div>
        <h4 className="font-bold text-sm text-white capitalize">{type}</h4>
        <p className="text-xs text-white/80 font-medium">{message}</p>
      </div>
      <button onClick={onClose} className="ml-4 text-white/50 hover:text-white transition-colors">
        <i className="fa-solid fa-xmark"></i>
      </button>
      
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Toast;