# Sistema de Referidos - Configuración de Firebase

## Estructura de Datos en Firestore

### Colección: `users`

Cada documento de usuario debe tener los siguientes campos para el sistema de referidos:

```javascript
{
  uid: string,
  email: string,
  displayName: string,
  
  // Campos del Sistema de Referidos
  referralCode: string,              // Código único de 6 caracteres (ej: "ABC123")
  referralCreatedAt: timestamp,      // Fecha de creación del código
  referralCount: number,             // Contador de referidos (opcional, se calcula con query)
  usedReferralCode: string,          // Código que este usuario usó al registrarse
  referralAppliedAt: timestamp,      // Fecha cuando aplicó el código
  
  // Recompensas
  vipRewardClaimed: boolean,         // Si ya reclamó VIP por 10 referidos
  premiumRewardClaimed: boolean,     // Si ya reclamó Premium por 100 referidos
  premiumPermanent: boolean,         // Si tiene Premium permanente
  vipExpiryDate: timestamp,          // Fecha de expiración del VIP temporal
  
  // Suscripción actual
  subscription: string,              // "Free", "VIP", "Premium"
}
```

## Índices Compuestos Necesarios

Para optimizar las queries, crea estos índices en Firestore:

### Índice 1: Buscar usuarios por código de referido
```
Collection: users
Fields:
  - referralCode (Ascending)
  - __name__ (Ascending)
```

### Índice 2: Contar referidos de un usuario
```
Collection: users
Fields:
  - usedReferralCode (Ascending)
  - referralAppliedAt (Descending)
```

## Reglas de Seguridad de Firestore

Agrega estas reglas para proteger el sistema de referidos:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      // Permitir lectura del propio perfil
      allow read: if request.auth != null && request.auth.uid == userId;
      
      // Permitir lectura de referralCode para validación
      allow read: if request.auth != null && 
                     request.resource.data.keys().hasOnly(['referralCode']);
      
      // Permitir actualización solo de campos específicos
      allow update: if request.auth != null && 
                       request.auth.uid == userId &&
                       request.resource.data.diff(resource.data).affectedKeys()
                         .hasOnly(['referralCode', 'usedReferralCode', 
                                  'referralAppliedAt', 'referralCreatedAt']);
    }
  }
}
```

## Flujo del Sistema

### 1. Usuario Genera su Link de Referido
```javascript
// Se crea un código único
referralCode: "ABC123"
referralCreatedAt: new Date()

// Link generado: https://zpoorn.com/?ref=ABC123
```

### 2. Nuevo Usuario Usa el Link
```javascript
// Al registrarse, se guarda:
usedReferralCode: "ABC123"
referralAppliedAt: new Date()

// Se incrementa el contador del referidor
```

### 3. Sistema de Recompensas Automático

#### 10 Referidos = VIP por 15 días
```javascript
if (referralCount >= 10 && !vipRewardClaimed) {
  subscription: "VIP"
  vipExpiryDate: Date.now() + 15 días
  vipRewardClaimed: true
}
```

#### 100 Referidos = Premium Permanente
```javascript
if (referralCount >= 100 && !premiumRewardClaimed) {
  subscription: "Premium"
  premiumRewardClaimed: true
  premiumPermanent: true
}
```

## Queries Importantes

### Contar referidos de un usuario
```javascript
const referralsQuery = query(
  collection(db, 'users'),
  where('usedReferralCode', '==', userReferralCode)
);
const snapshot = await getDocs(referralsQuery);
const count = snapshot.size;
```

### Validar código de referido
```javascript
const codeQuery = query(
  collection(db, 'users'),
  where('referralCode', '==', code)
);
const snapshot = await getDocs(codeQuery);
const isValid = !snapshot.empty;
```

## Integración con Registro de Usuarios

Al registrar un nuevo usuario, verifica si hay un código de referido en la URL:

```javascript
// En el componente de registro
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref');
  
  if (refCode) {
    localStorage.setItem('pendingReferralCode', refCode);
  }
}, []);

// Después del registro exitoso
const applyPendingReferral = async (newUserId) => {
  const refCode = localStorage.getItem('pendingReferralCode');
  
  if (refCode) {
    await setDoc(doc(db, 'users', newUserId), {
      usedReferralCode: refCode,
      referralAppliedAt: new Date()
    }, { merge: true });
    
    localStorage.removeItem('pendingReferralCode');
  }
};
```

## Mantenimiento

### Verificar expiración de VIP
Ejecuta periódicamente (Cloud Function o en el login):

```javascript
const checkVIPExpiry = async (userId) => {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  const userData = userDoc.data();
  
  if (userData.subscription === 'VIP' && 
      userData.vipExpiryDate && 
      new Date() > userData.vipExpiryDate.toDate() &&
      !userData.premiumPermanent) {
    
    await updateDoc(userRef, {
      subscription: 'Free'
    });
  }
};
```

## Notas Importantes

1. Los códigos de referido son únicos y de 6 caracteres (A-Z, 0-9)
2. Un usuario solo puede usar UN código de referido
3. Las recompensas se aplican automáticamente al alcanzar el objetivo
4. El Premium por 100 referidos es PERMANENTE
5. El VIP por 10 referidos dura 15 días
6. El dominio oficial es: https://zpoorn.com
