# 🔥 Configuración de Firestore

## 📋 Problema Actual

Los mensajes privados no aparecen en el inbox porque Firestore está bloqueando las escrituras en la colección `users/{userId}/active_chats`.

## ✅ Solución

Necesitas aplicar las reglas de seguridad de Firestore que he creado en el archivo `firestore.rules`.

## 🚀 Pasos para Aplicar las Reglas

### Opción 1: Desde Firebase Console (Recomendado)

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: **zpoom-9c448**
3. En el menú lateral, ve a **Firestore Database**
4. Haz click en la pestaña **Reglas** (Rules)
5. Copia todo el contenido del archivo `firestore.rules`
6. Pégalo en el editor de reglas
7. Haz click en **Publicar** (Publish)

### Opción 2: Desde Firebase CLI

Si tienes Firebase CLI instalado:

```bash
# Navega a la carpeta del proyecto
cd zpoorn

# Inicializa Firebase (si no lo has hecho)
firebase init firestore

# Despliega las reglas
firebase deploy --only firestore:rules
```

## 📝 Qué Hacen Estas Reglas

### ✅ Permisos de Chat

- **Community Chat (general_community_chat):**
  - ✅ Cualquiera puede leer
  - ✅ Usuarios autenticados pueden escribir

- **Chats Privados:**
  - ✅ Solo los participantes pueden leer/escribir
  - ✅ Se identifica por el chatId que contiene los UIDs de ambos usuarios

- **Active Chats (Inbox):**
  - ✅ Usuarios pueden leer/escribir en su propio inbox
  - ✅ Esto permite que aparezcan los mensajes en la lista lateral

### ✅ Permisos de Moderación

- **Isolated Chats:**
  - ✅ Solo el usuario aislado y admins pueden acceder
  - ✅ Solo admins pueden crear/modificar

- **User Profiles:**
  - ✅ Cualquiera puede leer perfiles
  - ✅ Usuarios pueden actualizar su propio perfil
  - ✅ Admins pueden actualizar cualquier perfil (para baneos, mutes, etc.)

### ✅ Otros Permisos

- **Posts (Videos):** Cualquiera lee, usuarios autenticados crean
- **Reports:** Solo admins leen, usuarios autenticados crean
- **Notifications:** Usuarios leen/actualizan sus propias notificaciones
- **Platform Settings:** Cualquiera lee, solo owner escribe

## 🔍 Verificar que Funcionó

Después de aplicar las reglas:

1. Recarga la aplicación
2. Inicia sesión con un usuario
3. Envía un mensaje privado a otro usuario
4. El chat debería aparecer en la lista lateral izquierda
5. El otro usuario debería ver el mensaje en su inbox

## ⚠️ Importante

- Las reglas incluyen verificación de admins usando `platformSettings/admins`
- El owner (zailasrj@gmail.com) tiene permisos especiales
- Los usuarios baneados pueden ser bloqueados a nivel de aplicación, no de Firestore

## 🐛 Si Sigue Sin Funcionar

1. **Verifica en Firebase Console:**
   - Ve a Firestore Database
   - Busca la colección `users/{tu-uid}/active_chats`
   - Verifica que se estén creando documentos

2. **Revisa la consola del navegador:**
   - Abre DevTools (F12)
   - Ve a la pestaña Console
   - Busca errores de permisos de Firestore

3. **Prueba con reglas temporales (solo para debug):**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
   ⚠️ **NUNCA uses esto en producción**, solo para verificar que el problema es de permisos

## 📞 Soporte

Si después de aplicar las reglas sigue sin funcionar, verifica:
- Que el usuario esté autenticado correctamente
- Que el `currentUser.uid` no sea null
- Que no haya errores en la consola del navegador
