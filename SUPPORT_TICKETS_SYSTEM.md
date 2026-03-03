# Sistema de Support Tickets

## 📋 Descripción

El sistema de tickets de soporte está sincronizado entre el Chat normal y el Panel de Admin, usando la misma colección de Firebase: `supportTickets`.

## 🔄 Diferencias entre Chat y Admin Panel

### Chat Normal (ChatView)
- **Solo muestra tickets ABIERTOS** (`status === 'open'`)
- Los tickets cerrados NO aparecen en la lista de contactos
- Esto mantiene el chat limpio y enfocado en tickets activos
- Los admins ven los tickets en la sección de contactos

### Panel de Admin (SupportTicketsPanel)
- **Muestra TODOS los tickets** (abiertos, cerrados, todos)
- Tiene filtros para ver:
  - Abiertos
  - Cerrados
  - Todos
- Permite cerrar y reabrir tickets
- Muestra historial completo de tickets

## 🗄️ Estructura de Datos en Firebase

### Colección: `supportTickets`
```
supportTickets/
  {ticketId}/
    - userId: string
    - userEmail: string
    - userName: string
    - userAvatar: string
    - userDisplayName: string
    - username: string
    - userPhotoURL: string
    - status: 'open' | 'closed'
    - reason: string
    - message: string (mensaje inicial)
    - createdAt: timestamp
    - lastMessageAt: timestamp
    - closedAt: timestamp (opcional)
    - closedBy: string (opcional)
    - reopenedAt: timestamp (opcional)
    
    messages/
      {messageId}/
        - text: string
        - senderId: string
        - senderName: string
        - senderAvatar: string
        - timestamp: timestamp
        - isAdmin: boolean
        - email: string (opcional)
```

## 🔧 Funcionalidades

### Para Usuarios
1. Crear ticket de soporte desde el chat
2. Ver respuestas de admins en tiempo real
3. Continuar conversación en ticket abierto

### Para Admins en Chat
1. Ver solo tickets abiertos en la lista de contactos
2. Responder a tickets
3. Los tickets cerrados desaparecen automáticamente del chat

### Para Admins en Panel Admin
1. Ver todos los tickets (abiertos y cerrados)
2. Filtrar por estado
3. Cerrar tickets resueltos
4. Reabrir tickets si es necesario
5. Ver historial completo de conversaciones

## ⚙️ Sincronización

Ambos sistemas usan:
- **Misma colección**: `supportTickets`
- **Mismos mensajes**: `supportTickets/{ticketId}/messages`
- **Tiempo real**: Ambos usan `onSnapshot` para actualizaciones en vivo

La única diferencia es el query:
- **Chat**: `where('status', '==', 'open')`
- **Admin Panel**: Filtros dinámicos (all/open/closed)

## 🎯 Beneficios

1. **Separación clara**: Chat limpio vs historial completo
2. **Sincronización perfecta**: Misma fuente de datos
3. **Flexibilidad**: Admins pueden gestionar desde ambos lugares
4. **Historial**: No se pierde información de tickets cerrados
5. **UX mejorada**: Usuarios no ven tickets cerrados innecesariamente
