// Email service using Firebase Cloud Functions + Resend API (100% FREE)

interface EmailOptions {
  to: string;
  subject: string;
  code: string;
}

export const sendVerificationEmail = async ({ to, code }: EmailOptions): Promise<boolean> => {
  // Check if Firebase Function URL is configured
  const functionUrl = import.meta.env.VITE_FIREBASE_FUNCTION_URL;
  
  // If no function URL is configured, use development mode (show code in console)
  if (!functionUrl || functionUrl === 'YOUR_FUNCTION_URL_HERE') {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 CÓDIGO DE VERIFICACIÓN (Modo Desarrollo)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Para: ${to}`);
    console.log(`🔢 Código: ${code}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  Modo desarrollo: Copia este código para verificar');
    console.log('💡 Configura VITE_FIREBASE_FUNCTION_URL en .env para enviar emails reales');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Show alert in browser for easier access
    setTimeout(() => {
      alert(`🔐 CÓDIGO DE VERIFICACIÓN (Modo Desarrollo)\n\nPara: ${to}\nCódigo: ${code}\n\nCopia este código para verificar tu cuenta.`);
    }, 500);
    
    return true;
  }
  
  try {
    // Call Firebase Cloud Function
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, code }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error enviando email:', error);
      
      // Fallback: Show code in console for development
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔐 CÓDIGO DE VERIFICACIÓN (Fallback)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📧 Para: ${to}`);
      console.log(`🔢 Código: ${code}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('⚠️  Error al enviar email - Usando fallback');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      alert(`🔐 CÓDIGO DE VERIFICACIÓN (Fallback)\n\nPara: ${to}\nCódigo: ${code}\n\nHubo un error al enviar el email. Usa este código.`);
      return true;
    }

    const data = await response.json();
    console.log('✅ Email enviado exitosamente:', data.messageId || 'OK');
    return true;
  } catch (error) {
    console.error('Error al enviar email:', error);
    
    // Fallback: Show code in console
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 CÓDIGO DE VERIFICACIÓN (Fallback)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Para: ${to}`);
    console.log(`🔢 Código: ${code}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  Error de conexión - Usando fallback');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    alert(`🔐 CÓDIGO DE VERIFICACIÓN (Fallback)\n\nPara: ${to}\nCódigo: ${code}\n\nError de conexión. Usa este código.`);
    return true;
  }
};

const generateEmailHTML = (code: string): string => {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Código de Verificación poorn</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background-color: #0A0A0A;
          color: #ffffff;
          line-height: 1.6;
        }
        .container { 
          max-width: 600px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .header { 
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 2px solid #A855F7;
        }
        .logo { 
          font-size: 36px;
          font-weight: 900;
          background: linear-gradient(135deg, #7C3AED 0%, #A855F7 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #999;
          font-size: 14px;
          font-weight: 500;
        }
        .code-box { 
          background: linear-gradient(135deg, #7C3AED 0%, #A855F7 100%);
          border-radius: 20px;
          padding: 40px 30px;
          text-align: center;
          margin: 40px 0;
          box-shadow: 0 10px 40px rgba(168, 85, 247, 0.3);
        }
        .code-label {
          font-size: 16px;
          color: #ffffff;
          margin-bottom: 20px;
          font-weight: 600;
        }
        .code { 
          font-size: 56px;
          font-weight: 900;
          letter-spacing: 12px;
          color: #ffffff;
          margin: 20px 0;
          text-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          font-family: 'Courier New', monospace;
        }
        .expiry {
          font-size: 14px;
          color: #e0e0e0;
          margin-top: 20px;
          font-weight: 500;
        }
        .info-box { 
          background-color: #1a1a1a;
          border-radius: 16px;
          padding: 24px;
          margin: 30px 0;
          border-left: 4px solid #A855F7;
        }
        .info-title {
          font-size: 16px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
        }
        .warning-icon {
          display: inline-block;
          width: 24px;
          height: 24px;
          background-color: #FCD34D;
          border-radius: 50%;
          margin-right: 10px;
          text-align: center;
          line-height: 24px;
          font-weight: 900;
          color: #000;
        }
        .info-list {
          list-style: none;
          padding: 0;
        }
        .info-list li {
          color: #ccc;
          font-size: 14px;
          margin-bottom: 10px;
          padding-left: 24px;
          position: relative;
        }
        .info-list li:before {
          content: "•";
          color: #A855F7;
          font-weight: bold;
          font-size: 20px;
          position: absolute;
          left: 0;
        }
        .footer { 
          text-align: center;
          color: #666;
          font-size: 12px;
          margin-top: 50px;
          padding-top: 30px;
          border-top: 1px solid #333;
        }
        .footer p {
          margin: 8px 0;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #7C3AED 0%, #A855F7 100%);
          color: white;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 12px;
          font-weight: 700;
          margin: 20px 0;
          font-size: 16px;
          box-shadow: 0 4px 15px rgba(168, 85, 247, 0.4);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">poorn</div>
          <div class="subtitle">Verificación de Seguridad</div>
        </div>
        
        <div class="code-box">
          <div class="code-label">Tu código de verificación es:</div>
          <div class="code">${code}</div>
          <div class="expiry">⏱️ Este código expira en 5 minutos</div>
        </div>
        
        <div class="info-box">
          <div class="info-title">
            <span class="warning-icon">⚠</span>
            Importante
          </div>
          <ul class="info-list">
            <li>No compartas este código con nadie</li>
            <li>poorn nunca te pedirá este código por teléfono o email</li>
            <li>Si no solicitaste este código, ignora este mensaje</li>
          </ul>
        </div>
        
        <div class="footer">
          <p>Este es un mensaje automático de poorn</p>
          <p>© ${new Date().getFullYear()} poorn. Todos los derechos reservados.</p>
          <p style="margin-top: 20px; color: #555;">
            ¿Necesitas ayuda? Únete a nuestro <a href="https://discord.gg/RaXBWkV8xv" style="color: #A855F7; text-decoration: none;">Discord</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const generateEmailText = (code: string): string => {
  return `
POORN - Verificación de Seguridad

Tu código de verificación es: ${code}

Este código expira en 5 minutos.

IMPORTANTE:
• No compartas este código con nadie
• poorn nunca te pedirá este código por teléfono o email
• Si no solicitaste este código, ignora este mensaje

© ${new Date().getFullYear()} poorn. Todos los derechos reservados.
  `.trim();
};
