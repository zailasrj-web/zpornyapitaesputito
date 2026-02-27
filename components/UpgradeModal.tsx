import React, { useState } from 'react';
import { STRIPE_CONFIG, getPaymentLink, isPaymentLinkConfigured, getStripeDashboardUrl, PRICING } from '../stripe-config';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier?: 'Free' | 'Premium' | 'VIP';
}

// ----------------------------------------------------------------------
// CONFIGURACIÓN DE PAGOS (STRIPE) - NUEVA IMPLEMENTACIÓN
// ----------------------------------------------------------------------
// 🚀 Configuración automática según entorno:
// - DESARROLLO (localhost): Usa links de TEST
// - PRODUCCIÓN: Usa links de LIVE (configurar en stripe-config.ts)
// 
// Para activar pagos reales:
// 1. Ve a stripe-config.ts
// 2. Reemplaza los links de LIVE_CONFIG con los reales de tu Stripe Dashboard
// 3. Sigue la guía en stripe-setup-guide.md
// ----------------------------------------------------------------------

const PLANS = [
  {
    name: 'Free',
    price: 'Free',
    period: 'forever',
    description: 'Explore and enjoy unlimited content.',
    features: [
      'Unlimited Content Browsing',
      'HD Video Streaming',
      'Community Access',
      'Ad-supported experience'
    ],
    cta: 'Current Plan',
    highlight: false,
    color: 'gray'
  },
  {
    name: 'Premium',
    price: `$${PRICING.Premium.monthly.price}`,
    period: '/month',
    yearlyPrice: `$${PRICING.Premium.yearly.price}`,
    yearlyPeriod: '/year',
    savings: PRICING.Premium.yearly.savings,
    description: 'Enhanced experience without ads.',
    features: [
      '✨ Ad-Free Experience',
      '🎬 Unlimited Downloads',
      '⚡ Priority Streaming',
      '💬 Priority Support',
      '🔒 Private Browsing Mode'
    ],
    cta: 'Upgrade to Premium',
    highlight: true,
    color: 'purple'
  },
  {
    name: 'VIP',
    price: `$${PRICING.VIP.monthly.price}`,
    period: '/month',
    yearlyPrice: `$${PRICING.VIP.yearly.price}`,
    yearlyPeriod: '/year',
    savings: PRICING.VIP.yearly.savings,
    description: 'Ultimate VIP access and exclusive perks.',
    features: [
      '👑 All Premium Features',
      '🌟 Exclusive VIP Content',
      '4K Ultra HD Streaming',
      '💎 VIP Badge & Profile',
      '🎁 Early Access to New Content',
      '💬 Discord VIP Role'
    ],
    cta: 'Get VIP Access',
    highlight: false,
    color: 'gold'
  }
];

const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, currentTier = 'Observer' }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  if (!isOpen) return null;

  const handleSubscribe = (planName: string) => {
    // Si ya tiene este plan o uno superior (simplificado), no hacer nada
    if (planName === currentTier) {
        return;
    }
    
    // Si elige el plan gratuito (Free)
    if (planName === 'Free') {
      onClose();
      return;
    }

    // Obtener el link de pago usando la nueva configuración
    const link = getPaymentLink(planName as 'Premium' | 'VIP', billingCycle);

    // Verificar si el link está configurado
    if (isPaymentLinkConfigured(link)) {
      // Redirigir a Stripe
      // Al volver, App.tsx detectará ?payment_success=true y actualizará el estado
      window.location.href = link; 
    } else {
      // Link no configurado
      const mode = STRIPE_CONFIG.mode.toUpperCase();
      const dashboardUrl = getStripeDashboardUrl();
      
      alert(`⚠️ STRIPE ${mode} NO CONFIGURADO\n\nPara activar pagos ${mode.toLowerCase()}:\n\n1. Ve a stripe-config.ts\n2. Reemplaza los links de ${mode}_CONFIG\n3. Sigue la guía en stripe-setup-guide.md\n\nDashboard: ${dashboardUrl}\n\nLink actual: ${link}`);
      console.warn(`⚠️ Stripe Payment Link not configured for ${planName} (${billingCycle}) in ${mode} mode`);
    }
  };

  const getDisplayPrice = (plan: any) => {
    if (plan.name === 'Free') return 'Free';
    
    if (billingCycle === 'monthly') {
      return plan.price;
    } else {
      return plan.yearlyPrice || plan.price;
    }
  };

  const getDisplayPeriod = (plan: any) => {
    if (plan.name === 'Free') return 'forever';
    
    if (billingCycle === 'monthly') {
      return plan.period;
    } else {
      return plan.yearlyPeriod || '/year';
    }
  };

  const isCurrentPlan = (planName: string) => {
    return planName === currentTier;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-sans overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/90 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-5xl bg-[#050505] border border-white/10 rounded-3xl shadow-2xl animate-[fadeIn_0.3s_ease-out] overflow-hidden my-auto">
        
        {/* Background Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-purple-900/20 rounded-full blur-[100px] pointer-events-none"></div>

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-20 text-gray-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-full w-10 h-10 flex items-center justify-center backdrop-blur-sm"
        >
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>

        <div className="relative z-10 px-6 py-12 md:px-12 md:py-16 text-center">
          
          {/* Header */}
          <div className="mb-12">
            <span className="inline-block py-1 px-3 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold uppercase tracking-wider mb-4">
               Current Plan: {currentTier}
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">
              Upgrade Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Reality</span>
            </h2>
            <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto">
              Unlock full potential. Payments are processed securely by Stripe.
            </p>
            
            {/* Stripe Mode Indicator */}
            <div className="mt-4">
              <span className={`inline-block py-1 px-3 rounded-full text-xs font-bold uppercase tracking-wider ${
                STRIPE_CONFIG.mode === 'test' 
                  ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400' 
                  : 'bg-green-500/10 border border-green-500/20 text-green-400'
              }`}>
                {STRIPE_CONFIG.mode === 'test' ? '🧪 Test Mode' : '🚀 Live Mode'}
              </span>
            </div>

            {/* Billing Toggle */}
            <div className="flex justify-center mt-8">
              <div className="bg-white/5 p-1 rounded-xl flex items-center relative border border-white/5">
                 <button 
                   onClick={() => setBillingCycle('monthly')}
                   className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${billingCycle === 'monthly' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-white'}`}
                 >
                   Monthly
                 </button>
                 <button 
                   onClick={() => setBillingCycle('yearly')}
                   className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${billingCycle === 'yearly' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-white'}`}
                 >
                   Yearly
                   <span className="bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5 rounded-full border border-green-500/20">
                     Save ~17%
                   </span>
                 </button>
              </div>
            </div>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
             {PLANS.map((plan) => {
               const isCurrent = isCurrentPlan(plan.name);
               return (
               <div 
                 key={plan.name}
                 className={`relative flex flex-col p-8 rounded-3xl border transition-all duration-300 group ${
                   isCurrent 
                      ? 'bg-white/5 border-accent/50 opacity-80'
                      : plan.highlight 
                        ? 'bg-gradient-to-b from-[#1a1625] to-black border-accent/50 shadow-2xl shadow-purple-900/20 z-10 scale-105' 
                        : 'bg-[#0A0A0A] border-white/10 hover:border-white/20 hover:-translate-y-2'
                 }`}
               >
                 {plan.highlight && !isCurrent && (
                   <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg border border-purple-400/50">
                     Most Popular
                   </div>
                 )}
                 {isCurrent && (
                   <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
                     Active Plan
                   </div>
                 )}

                 {/* Plan Header */}
                 <div className="mb-6 text-left">
                    <h3 className={`text-xl font-bold mb-2 ${plan.color === 'gold' ? 'text-amber-400' : 'text-white'}`}>
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline gap-1 mb-2">
                       <span className="text-3xl font-black text-white">
                         {getDisplayPrice(plan)}
                       </span>
                       <span className="text-sm text-gray-500 font-medium">
                         {getDisplayPeriod(plan)}
                       </span>
                       {billingCycle === 'yearly' && plan.savings && plan.name !== 'Free' && (
                         <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full ml-2">
                           {plan.savings}
                         </span>
                       )}
                    </div>
                 </div>

                 <div className="w-full h-px bg-white/5 mb-6"></div>

                 {/* Features */}
                 <ul className="space-y-4 mb-8 flex-1 text-left">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm text-gray-300">
                        <i className={`fa-solid fa-check mt-1 ${
                          plan.highlight ? 'text-accent' : plan.color === 'gold' ? 'text-amber-400' : 'text-gray-500'
                        }`}></i>
                        <span className={feature.includes('VIP') ? 'font-bold text-white' : ''}>{feature}</span>
                      </li>
                    ))}
                 </ul>

                 {/* CTA Button */}
                 <button 
                   onClick={() => handleSubscribe(plan.name)}
                   disabled={isCurrent}
                   className={`w-full py-4 rounded-xl font-bold text-sm transition-all shadow-lg ${
                     isCurrent 
                     ? 'bg-white/10 text-gray-400 cursor-default'
                     : plan.highlight 
                        ? 'bg-accent hover:bg-accent-hover text-white shadow-purple-900/40' 
                        : plan.color === 'gold'
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 text-black shadow-amber-900/20'
                            : 'bg-white/10 hover:bg-white/20 text-white'
                 }`}>
                   {isCurrent ? 'Current Plan' : plan.cta}
                 </button>
               </div>
             )})}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;