# Firebase Cloud Functions - Envío de Emails 2FA

## 📋 Requisitos Previos

1. **Node.js 18+** instalado
2. **Firebase CLI** instalado: `npm install -g firebase-tools`
3. **Cuenta de Resend** (100% GRATIS - 3,000 emails/mes): https://resend.com

## 🚀 Configuración Paso a Paso

### 1. Instalar dependencias

```bash
cd functions
npm install
```

### 2. Configurar Resend API Key

Obtén tu API key gratis en: https://resend.com/api-keys

Luego configúrala en Firebase:

```bash
firebase functions:config:set resend.api_key="tu_api_key_aqui"
```

Ejemplo:
```bash
firebase functions:config:set resend.api_key="re_123abc456def789ghi"
```

### 3. Verificar dominio en Resend (Opcional pero recomendado)

Para enviar desde tu propio dominio:
1. Ve a https://resend.com/domains
2. Agrega tu dominio
3. Configura los registros DNS (MX, TXT, CNAME)
4. Actualiza el campo `from` en `functions/src/index.ts`:
   ```typescript
   from: 'poorn <noreply@tudominio.com>'
   ```

Si no tienes dominio, puedes usar el dominio de prueba de Resend temporalmente.

### 4. Compilar el código

```bash
npm run build
```

### 5. Desplegar a Firebase

```bash
cd ..
firebase deploy --only functions
```

Esto desplegará la función y te dará una URL como:
```
https://us-central1-tu-proyecto.cloudfunctions.net/send2FAEmail
```

### 6. Configurar la URL en tu aplicación

Copia la URL de la función y agrégala a tu `.env.local`:

```env
VITE_FIREBASE_FUNCTION_URL=https://us-central1-tu-proyecto.cloudfunctions.net/send2FAEmail
```

### 7. Reiniciar el servidor de desarrollo

```bash
npm run dev
```

## 🧪 Probar localmente (Opcional)

Para probar las funciones localmente antes de desplegar:

```bash
cd functions
npm run serve
```

Esto iniciará el emulador de Firebase Functions en `http://localhost:5001`

Luego en tu `.env.local`:
```env
VITE_FIREBASE_FUNCTION_URL=http://localhost:5001/tu-proyecto/us-central1/send2FAEmail
```

## 📝 Notas Importantes

- **Modo Desarrollo**: Si no configuras `VITE_FIREBASE_FUNCTION_URL`, el sistema mostrará el código en una alerta emergente (perfecto para desarrollo)
- **Resend Gratis**: 3,000 emails/mes, 100 emails/día - más que suficiente para empezar
- **Seguridad**: La función valida el formato del email y maneja errores correctamente
- **CORS**: Ya está configurado para aceptar peticiones desde tu frontend

## 🔧 Comandos Útiles

```bash
# Ver logs de las funciones
firebase functions:log

# Ver configuración actual
firebase functions:config:get

# Eliminar una función
firebase functions:delete send2FAEmail
```

## ❓ Troubleshooting

**Error: "Missing required fields"**
- Verifica que estás enviando `to` y `code` en el body de la petición

**Error: "Failed to send email"**
- Verifica que tu API key de Resend esté configurada correctamente
- Revisa los logs: `firebase functions:log`

**Email no llega**
- Revisa la carpeta de spam
- Verifica que el dominio esté verificado en Resend
- Revisa los logs de Resend: https://resend.com/emails

## 💰 Costos

- **Firebase Functions**: Plan gratuito incluye 2M invocaciones/mes
- **Resend**: Plan gratuito incluye 3,000 emails/mes
- **Total**: 100% GRATIS para empezar 🎉
