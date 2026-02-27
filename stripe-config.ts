// Configuración centralizada de Stripe
// Este archivo facilita el manejo de links de test vs producción

export interface StripeConfig {
  mode: 'test' | 'live';
  links: {
    monthly: {
      Premium: string;
      VIP: string;
    };
    yearly: {
      Premium: string;
      VIP: string;
    };
  };
}

// Detectar entorno
// FORZADO A MODO LIVE - Links completos configurados
const isDevelopment = false;

// Configuración de TEST (desarrollo)
const TEST_CONFIG: StripeConfig = {
  mode: 'test',
  links: {
    monthly: {
      Premium: 'https://buy.stripe.com/test_14AbJ05Yf3sq85r4OE5AQ00',
      VIP: 'https://buy.stripe.com/test_aFaaEWdqH1ki85repe5AQ01',
    },
    yearly: {
      Premium: 'https://buy.stripe.com/test_4gM5kC9arbYW3Pb6WM5AQ02',
      VIP: 'https://buy.stripe.com/test_28EfZgaev7IGetPfti5AQ03',
    }
  }
};

// Configuración de LIVE (producción)
// ✅ LINKS REALES DE STRIPE CONFIGURADOS Y ACTIVOS
const LIVE_CONFIG: StripeConfig = {
  mode: 'live',
  links: {
    monthly: {
      Premium: 'https://buy.stripe.com/14A14m89lgUyauL3KRaIM00',
      VIP: 'https://buy.stripe.com/aFa3cu0GT9s6gT9bdjaIM01',
    },
    yearly: {
      Premium: 'https://buy.stripe.com/cNi4gy3T547M6evgxDaIM02',
      VIP: 'https://buy.stripe.com/00wfZg89lawa46nbdjaIM03',
    }
  }
};

// Exportar configuración según el entorno
export const STRIPE_CONFIG = isDevelopment ? TEST_CONFIG : LIVE_CONFIG;

// Función helper para obtener link de pago
export const getPaymentLink = (plan: 'Premium' | 'VIP', billing: 'monthly' | 'yearly'): string => {
  return STRIPE_CONFIG.links[billing][plan];
};

// Función helper para verificar si un link está configurado
export const isPaymentLinkConfigured = (link: string): boolean => {
  return link && 
         link.startsWith('https://buy.stripe.com/') && 
         !link.includes('REEMPLAZAR');
};

// Función helper para obtener URL del dashboard
export const getStripeDashboardUrl = (): string => {
  return STRIPE_CONFIG.mode === 'test' 
    ? 'https://dashboard.stripe.com/test/payment-links'
    : 'https://dashboard.stripe.com/payment-links';
};

// Precios para mostrar en la UI
export const PRICING = {
  Premium: {
    monthly: { price: 9.99, currency: 'USD' },
    yearly: { price: 99.99, currency: 'USD', savings: '2 months free' }
  },
  VIP: {
    monthly: { price: 19.99, currency: 'USD' },
    yearly: { price: 199.99, currency: 'USD', savings: '2 months free' }
  }
} as const;