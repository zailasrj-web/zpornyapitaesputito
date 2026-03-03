# Sistema de Soporte - Configuración

## 🎯 Funcionalidad Implementada

### Botón "Request Help"
Ubicado en: Profile → Support & Feedback

**Comportamiento:**
1. Usuario hace clic en "Request Help"
2. Sistema busca un administrador disponible
3. Crea o abre un chat privado con el admin
4. Marca el chat como `isSupport: true`
5. Envía mensaje del sistema indicando que es soporte
6. Notifica al usuario que vaya a la sección Chat

### Links de Discord Actualizados
Todos los links de Discord ahora apuntan a: `https://discord.gg/RaXBWkV8xv`

**Ubicaciones actualizadas:**
- ProfileView (Support & Feedback)
- Menú lateral (Bottom Nav)
- CommunityView
- App.tsx (Onboarding)
- EmailService (emails)

## 📊 Estructura de Firebase

### Collection: privateChats
```javascript
{
  participants: [userId, adminId],
  participantNames: {
    userId: "User Name",
    adminId: "Admin Name"
  },
  lastMessage: string,
  lastMessageTime: timestamp,
  isSupport: boolean,           // TRUE para chats de soporte
  supportRequestedBy: string,   // UID del usuario que pidió soporte
  createdAt: timestamp
}
```

### SubCollection: privateChats/{chatId}/messages
```javascript
{
  text: string,
  senderUid: string,
  displayName: string,
  photoURL: string,
  createdAt: timestamp,
  type: 'text' | 'system' | 'admin_log'
}
```

## 🎨 UI/UX del Sistema de Soporte

### Badge de Soporte
Cuando un chat es de soporte (`isSupport: true`), debe mostrar:

**Para el Usuario:**
```jsx
<div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-1.5 flex items-center gap-2">
  <i className="fa-solid fa-headset text-blue-400 text-xs"></i>
  <span className="text-xs font-bold text-blue-400">Chat de Soporte</span>
</div>
```

**Para el Admin:**
```jsx
<div className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-1.5 flex items-center gap-2">
  <i className="fa-solid fa-user-headset text-green-400 text-xs"></i>
  <span className="text-xs font-bold text-green-400">Soporte Activo</span>
</div>
```

### Mensaje del Sistema
Cuando se abre un chat de soporte, se envía automáticamente:
```
🆘 Solicitud de soporte iniciada
```

## 🔧 Implementación en ChatView

Para mostrar los badges en el ChatView, necesitas:

1. **Detectar si es chat de soporte:**
```typescript
const [isSupportChat, setIsSupportChat] = useState(false);

// En el useEffect que carga el chat
const chatDoc = await getDoc(doc(db, 'privateChats', chatId));
if (chatDoc.exists()) {
  setIsSupportChat(chatDoc.data().isSupport || false);
}
```

2. **Mostrar badge en el header del chat:**
```tsx
{isSupportChat && (
  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-1.5 flex items-center gap-2">
    <i className="fa-solid fa-headset text-blue-400 text-xs"></i>
    <span className="text-xs font-bold text-blue-400">
      {isAdmin ? 'Soporte Activo' : 'Chat de Soporte'}
    </span>
  </div>
)}
```

3. **Filtrar mensajes del sistema:**
```typescript
// Los mensajes con type: 'system' deben mostrarse con estilo especial
{message.type === 'system' && (
  <div className="flex justify-center my-2">
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2">
      <p className="text-xs text-gray-400 text-center">{message.text}</p>
    </div>
  </div>
)}
```

## 🚀 Mejoras Futuras

1. **Prioridad de Admins:**
   - Buscar primero admins online
   - Si no hay online, buscar el que tenga menos chats activos
   - Implementar sistema de turnos

2. **Notificaciones:**
   - Notificar al admin cuando recibe solicitud de soporte
   - Sonido especial para chats de soporte

3. **Métricas:**
   - Tiempo de respuesta promedio
   - Satisfacción del usuario
   - Número de tickets resueltos

4. **Categorías:**
   - Permitir al usuario seleccionar tipo de problema
   - Asignar automáticamente al admin especializado

## 📝 Notas Importantes

- Solo se crea UN chat por usuario-admin
- Si ya existe un chat, se reutiliza
- El campo `isSupport` diferencia chats normales de soporte
- Los admins deben tener `role: 'admin'` en su documento de usuario
- El sistema es escalable para múltiples admins
