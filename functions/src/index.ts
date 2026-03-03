// Firebase Cloud Functions para envío de emails 2FA
// NOTA: Los errores de TypeScript se resolverán al instalar las dependencias:
// cd functions && npm install

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Resend } from 'resend';
import type { Request, Response } from 'firebase-functions';

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Resend with your API key
// Get your FREE API key at: https://resend.com/api-keys
const resend = new Resend(process.env.RESEND_API_KEY);

// Email template
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
            ¿Necesitas ayuda? Únete a nuestro <a href="https://discord.gg/r3wDycJ3" style="color: #A855F7; text-decoration: none;">Discord</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Cloud Function to send 2FA email
export const send2FAEmail = functions.https.onRequest(async (req: Request, res: Response) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { to, code } = req.body;

    // Validate input
    if (!to || !code) {
      res.status(400).json({ error: 'Missing required fields: to, code' });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    // Send email using Resend
    const data = await resend.emails.send({
      from: 'poorn <noreply@yourdomain.com>', // Replace with your verified domain
      to: [to],
      subject: '🔐 Tu código de verificación poorn',
      html: generateEmailHTML(code),
    });

    console.log('Email sent successfully:', data);
    res.status(200).json({ 
      success: true, 
      messageId: typeof data === 'object' && data && 'id' in data ? data.id : 'sent'
    });

  } catch (error: any) {
    console.error('Error sending email:', error);
    res.status(500).json({ 
      error: 'Failed to send email',
      details: error.message 
    });
  }
});
