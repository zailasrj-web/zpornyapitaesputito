# Firebase Friends System Setup

## 🚀 Automatic Setup (Recommended)

El sistema está configurado para crear los índices automáticamente. Simplemente:

1. **Abre la aplicación** y ve a Profile → Edit Profile → Edit Public Profile
2. **Haz clic en la pestaña "Friends"**
3. **Revisa la consola del navegador** (F12)
4. Si ves un error de índice, **Firebase mostrará un link directo** en el error
5. **Haz clic en el link** y Firebase creará el índice automáticamente
6. **Espera 1-2 minutos** a que el índice se construya
7. **Recarga la página** y todo funcionará

### Ejemplo de lo que verás en la consola:

```
🔍 Loading friend requests...
❌ Error loading friend requests: FirebaseError: ...

🔥 FIREBASE INDEX REQUIRED

👉 Click here to create the index automatically:
https://console.firebase.google.com/v1/r/project/YOUR_PROJECT/firestore/indexes?create_composite=...
```

**Solo haz clic en el link y Firebase hará todo por ti.**

---

## 📋 Manual Setup (Si prefieres hacerlo manualmente)

### 1. friendRequests Collection
Stores pending, accepted, and rejected friend requests.

**Document Structure:**
```javascript
{
  fromUserId: string,        // User who sent the request
  toUserId: string,          // User who receives the request
  status: string,            // 'pending', 'accepted', 'rejected'
  createdAt: timestamp,
  acceptedAt: timestamp      // Optional, only when accepted
}
```

**Required Indexes:**
- Collection: `friendRequests`
- Fields:
  - `toUserId` (Ascending)
  - `status` (Ascending)
  - `createdAt` (Descending)

### 2. friends Collection
Stores confirmed friendships (bidirectional).

**Document Structure:**
```javascript
{
  userId: string,            // One user in the friendship
  friendId: string,          // The other user in the friendship
  createdAt: timestamp
}
```

**Required Indexes:**
- Collection: `friends`
- Fields:
  - `userId` (Ascending)
  - `createdAt` (Descending)

### 3. users Collection (Extended)
Add these fields to existing user documents:

```javascript
{
  // ... existing fields ...
  socialLinks: [
    {
      platform: string,      // 'twitter', 'instagram', 'tiktok', etc.
      url: string,
      icon: string           // Font Awesome icon class
    }
  ],
  friendsCount: number,      // Optional: for quick display
  publicVideos: [],          // Array of video IDs to display publicly
  publicFavorites: []        // Array of favorite video IDs to display
}
```

## Security Rules

Add these rules to your Firestore Security Rules:

```javascript
// Friend Requests
match /friendRequests/{requestId} {
  // Users can read their own incoming requests
  allow read: if request.auth != null && 
    (resource.data.toUserId == request.auth.uid || 
     resource.data.fromUserId == request.auth.uid);
  
  // Users can create requests to others
  allow create: if request.auth != null && 
    request.resource.data.fromUserId == request.auth.uid;
  
  // Users can update/delete their own sent requests or received requests
  allow update, delete: if request.auth != null && 
    (resource.data.fromUserId == request.auth.uid || 
     resource.data.toUserId == request.auth.uid);
}

// Friends
match /friends/{friendId} {
  // Users can read their own friendships
  allow read: if request.auth != null && 
    (resource.data.userId == request.auth.uid || 
     resource.data.friendId == request.auth.uid);
  
  // Only system can create friendships (via Cloud Functions or admin)
  allow create: if request.auth != null && 
    request.resource.data.userId == request.auth.uid;
  
  // Users can delete their own friendships
  allow delete: if request.auth != null && 
    resource.data.userId == request.auth.uid;
}
```

## Features Implemented

### ✅ Edit Public Profile Modal
- **Videos Tab**: Placeholder for organizing uploaded videos
- **Favorites Tab**: Placeholder for managing favorite content
- **Social Links Tab**: Fully functional
  - Add social media links (Twitter, Instagram, TikTok, YouTube, OnlyFans, Website)
  - Remove social links
  - Display with icons
- **Friends Tab**: Fully functional
  - View pending friend requests
  - Accept/reject friend requests
  - View current friends list

### ✅ Friend Request System
- Send friend requests (to be implemented in user profiles)
- Receive notifications of pending requests
- Accept or reject requests
- Bidirectional friendship creation
- Real-time updates

## Next Steps

### To Complete the System:

1. **Add "Send Friend Request" button** to other users' profiles
2. **Create notification system** for friend requests
3. **Implement video organization** in the Videos tab
4. **Implement favorites management** in the Favorites tab
5. **Add public profile view** for other users to see
6. **Add friend activity feed** (optional)

## Usage

1. User clicks "Profile" → "Edit Profile" → "Edit Public Profile"
2. Navigate through tabs to manage different aspects
3. Social links are saved immediately
4. Friend requests show with notification badge
5. Accept/reject buttons update Firebase in real-time

## Testing

To test the friend request system:
1. Create two user accounts
2. Manually add a friend request document in Firestore:
```javascript
{
  fromUserId: "user1_uid",
  toUserId: "user2_uid",
  status: "pending",
  createdAt: new Date()
}
```
3. Log in as user2 and check the Friends tab
4. Accept or reject the request
5. Verify both users now appear in each other's friends list
