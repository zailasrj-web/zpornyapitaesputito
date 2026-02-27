# Guía de Integración - Sistema de Moderación de Chat

## 📦 Componentes Creados

1. **UserProfileModal.tsx** - Modal de perfil con acciones de moderación
2. **ChatBannedView.tsx** - Vista para usuarios baneados del chat
3. **IsolatedChatView.tsx** - Chat aislado admin-usuario

## 🔧 Cambios Necesarios en ChatView.tsx

### 1. Importar los nuevos componentes

Agregar al inicio del archivo (después de las importaciones existentes):

```typescript
import UserProfileModal from './UserProfileModal';
import ChatBannedView from './ChatBannedView';
import IsolatedChatView from './IsolatedChatView';
```

### 2. Agregar estados necesarios

Agregar después de los estados existentes (alrededor de la línea 100):

```typescript
// User Profile Modal State
const [showUserProfile, setShowUserProfile] = useState(false);
const [selectedUserProfile, setSelectedUserProfile] = useState<{
  uid: string;
  displayName: string;
  photoURL: string;
  email?: string;
} | null>(null);

// Chat Ban State
const [isChatBanned, setIsChatBanned] = useState(false);
const [chatBanReason, setChatBanReason] = useState('');

// Isolation State
const [isIsolated, setIsIsolated] = useState(false);
```

### 3. Agregar listener para verificar estado del usuario

Agregar este useEffect después de los existentes (alrededor de la línea 500):

```typescript
// Check if current user is banned or isolated from chat
useEffect(() => {
  if (!currentUser) return;

  const userRef = doc(db, 'users', currentUser.uid);
  const unsubscribe = onSnapshot(userRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // Check chat ban
      if (data.chatBanned === true) {
        setIsChatBanned(true);
        setChatBanReason(data.chatBanReason || 'Violación de normas del chat');
      } else {
        setIsChatBanned(false);
        setChatBanReason('');
      }
      
      // Check isolation
      if (data.chatIsolated === true) {
        setIsIsolated(true);
      } else {
        setIsIsolated(false);
      }
    }
  });

  return () => unsubscribe();
}, [currentUser]);
```

### 4. Agregar función para abrir perfil de usuario

Agregar esta función antes del return principal (alrededor de la línea 1000):

```typescript
const handleUserAvatarClick = (msg: Message) => {
  // Don't open profile for system messages
  if (msg.type === 'system' || msg.type === 'admin_log') return;
  
  // Don't open own profile
  if (msg.senderUid === currentUser?.uid) return;
  
  setSelectedUserProfile({
    uid: msg.senderUid,
    displayName: msg.displayName,
    photoURL: msg.photoURL,
    email: msg.email
  });
  setShowUserProfile(true);
};

const handleStartChatFromProfile = () => {
  if (!selectedUserProfile) return;
  
  // Find or create chat with this user
  const existingChat = inboxChats.find(c => c.id === selectedUserProfile.uid);
  
  if (existingChat) {
    setSelectedContact(existingChat);
  } else {
    setSelectedContact({
      id: selectedUserProfile.uid,
      name: selectedUserProfile.displayName,
      avatar: selectedUserProfile.photoURL,
      status: 'online',
      lastMessage: 'Start a conversation',
      time: 'Now',
      unread: 0
    });
  }
  
  setShowUserProfile(false);
  setShowMobileList(false);
};

const handleReportFromProfile = async () => {
  if (!selectedUserProfile || !currentUser) return;
  
  const reason = prompt('Razón del reporte:');
  if (!reason || !reason.trim()) return;
  
  try {
    await addDoc(collection(db, 'reports'), {
      type: 'User',
      reportedUserId: selectedUserProfile.uid,
      reportedUserName: selectedUserProfile.displayName,
      reportedUserEmail: selectedUserProfile.email,
      reporterId: currentUser.uid,
      reporterEmail: currentUser.email,
      reason: reason.trim(),
      createdAt: serverTimestamp(),
      status: 'Pending'
    });
    
    alert('Reporte enviado exitosamente');
    setShowUserProfile(false);
  } catch (error) {
    console.error('Error reporting user:', error);
    alert('Error al enviar el reporte');
  }
};

const handleContactSupport = () => {
  // Create support chat with admin
  const supportChat: Contact = {
    id: 'support_admin',
    name: 'Support Team',
    avatar: 'https://ui-avatars.com/api/?name=Support&background=FF1B6D&color=fff',
    status: 'online',
    lastMessage: 'How can we help you?',
    time: 'Now',
    unread: 0
  };
  
  setSelectedContact(supportChat);
  setIsChatBanned(false); // Temporarily allow access to support chat
};
```

### 5. Modificar el renderizado de avatares en mensajes

Buscar donde se renderizan los mensajes (alrededor de la línea 2400) y modificar el avatar para que sea clickeable:

```typescript
// Buscar esta línea:
<img src={msg.photoURL} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt={msg.displayName} />

// Reemplazar por:
<img 
  src={msg.photoURL} 
  className="w-8 h-8 rounded-full object-cover flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-accent transition-all" 
  alt={msg.displayName}
  onClick={() => handleUserAvatarClick(msg)}
  title={`Ver perfil de ${msg.displayName}`}
/>
```

### 6. Agregar renderizado condicional en el return principal

Modificar el return principal para mostrar las vistas especiales:

```typescript
// Al inicio del return, antes de todo el contenido actual:
return (
  <div className="flex-1 flex flex-col bg-[#0A0A0A] relative overflow-hidden">
    {/* Show Banned View if user is banned */}
    {isChatBanned && !isAdmin && (
      <ChatBannedView 
        reason={chatBanReason}
        onContactSupport={handleContactSupport}
      />
    )}
    
    {/* Show Isolated Chat if user is isolated */}
    {!isChatBanned && isIsolated && (
      <IsolatedChatView 
        currentUser={currentUser!}
        isAdmin={isAdminOrOwner}
        onClose={isAdminOrOwner ? () => {
          // Admin closes isolation
          const userRef = doc(db, 'users', selectedContact.id);
          updateDoc(userRef, {
            chatIsolated: false,
            isolationReason: null
          });
        } : undefined}
      />
    )}
    
    {/* Normal Chat View */}
    {!isChatBanned && !isIsolated && (
      <>
        {/* Todo el contenido actual del chat va aquí */}
      </>
    )}
    
    {/* User Profile Modal */}
    {showUserProfile && selectedUserProfile && (
      <UserProfileModal 
        user={selectedUserProfile}
        currentUser={currentUser!}
        isAdmin={isAdminOrOwner}
        onClose={() => setShowUserProfile(false)}
        onStartChat={handleStartChatFromProfile}
        onReport={handleReportFromProfile}
      />
    )}
  </div>
);
```

## 🗄️ Estructura de Base de Datos

### Campos agregados a la colección `users`:

```typescript
{
  // Campos existentes...
  
  // Nuevos campos para moderación de chat:
  chatMuted: boolean,
  muteReason: string,
  muteExpiresAt: Timestamp,
  mutedBy: string,
  mutedAt: Timestamp,
  
  chatBanned: boolean,
  chatBanReason: string,
  bannedBy: string,
  bannedAt: Timestamp,
  
  chatIsolated: boolean,
  isolationReason: string,
  isolatedBy: string,
  isolatedAt: Timestamp
}
```

### Nueva colección `isolatedChats`:

```typescript
isolatedChats/{userId}/messages/{messageId}
{
  text: string,
  senderUid: string,
  displayName: string,
  photoURL: string,
  createdAt: Timestamp,
  isAdmin: boolean
}
```

## ✅ Funcionalidades Implementadas

### Para todos los usuarios:
- ✅ Click en avatar para ver perfil
- ✅ Iniciar chat privado desde perfil
- ✅ Reportar usuario

### Para administradores:
- ✅ Silenciar usuario (1h, 24h, 7d, permanente)
- ✅ Banear del chat (pantalla con blur)
- ✅ Aislar usuario (chat único admin-usuario)
- ✅ Remover aislamiento

### Vistas especiales:
- ✅ Vista de baneo con botón de soporte
- ✅ Vista de chat aislado
- ✅ Modal de confirmación para acciones administrativas

## 🎨 Estilos

Todos los componentes usan el mismo sistema de diseño que el resto de la aplicación:
- Gradientes oscuros
- Bordes con opacidad
- Animaciones suaves
- Responsive design
- Iconos de FontAwesome

## 🚀 Próximos Pasos

1. Aplicar los cambios en ChatView.tsx según esta guía
2. Probar cada funcionalidad
3. Ajustar estilos si es necesario
4. Configurar reglas de Firestore para las nuevas colecciones

## 📝 Notas Importantes

- Los usuarios baneados NO pueden acceder al chat normal
- Los usuarios aislados SOLO pueden chatear con admins
- Los admins pueden ver y gestionar todos los estados
- El botón de soporte crea un chat especial con admins
- Todas las acciones se registran con timestamp y autor
