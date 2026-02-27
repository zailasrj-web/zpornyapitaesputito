import React from 'react';

interface ChatBannedViewProps {
  reason?: string;
  onContactSupport: () => void;
  hasActiveTicket?: boolean;
}

const ChatBannedView: React.FC<ChatBannedViewProps> = ({ reason, onContactSupport, hasActiveTicket }) => {
  return (
    <div className="relative h-full flex items-center justify-center p-6">
      {/* Blurred Background */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl"></div>
      
      {/* Content */}
      <div className="relative z-10 max-w-md w-full text-center animate-[fadeIn_0.5s_ease-out]">
        {/* Ban Icon */}
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-red-600/20 flex items-center justify-center border-2 border-red-600/50 animate-pulse">
          <i className="fa-solid fa-ban text-5xl text-red-600"></i>
        </div>

        {/* Title */}
        <h2 className="text-3xl font-black text-white mb-3 uppercase tracking-tight">
          Chat Access Denied
        </h2>

        {/* Message */}
        <p className="text-red-400 font-bold text-lg mb-4">
          You have been banned from the chat
        </p>

        {/* Reason */}
        {reason && (
          <div className="bg-red-900/20 border border-red-600/30 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-400 mb-1">Reason:</p>
            <p className="text-white font-semibold">{reason}</p>
          </div>
        )}

        {/* Support Button */}
        <button
          onClick={onContactSupport}
          className="w-full px-6 py-4 bg-gradient-to-r from-accent to-accent-hover text-white font-bold rounded-xl transition-all hover:shadow-lg hover:shadow-accent/20 flex items-center justify-center gap-2"
        >
          <i className="fa-solid fa-headset"></i>
          {hasActiveTicket ? 'Ver Ticket de Soporte' : 'Contact Support'}
        </button>

        {/* Info Text */}
        <p className="text-xs text-gray-500 mt-4">
          {hasActiveTicket 
            ? 'Ya tienes un ticket abierto. Haz clic para continuar la conversación con el equipo de soporte.'
            : 'If you believe this is a mistake, please contact our support team'}
        </p>
      </div>
    </div>
  );
};

export default ChatBannedView;
