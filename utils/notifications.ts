import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';

interface CreateNotificationParams {
  toUserId: string;
  fromUserId: string;
  type: 'new_video' | 'new_follower' | 'like' | 'comment' | 'coin_donation';
  message: string;
  videoId?: string;
  videoThumbnail?: string;
}

/**
 * Crea una notificación en Firebase
 * Se verifica las preferencias del usuario antes de crear la notificación
 */
export const createNotification = async (params: CreateNotificationParams) => {
  const { toUserId, fromUserId, type, message, videoId, videoThumbnail } = params;

  try {
    // Obtener datos del usuario que envía la notificación
    const fromUserRef = doc(db, 'users', fromUserId);
    const fromUserDoc = await getDoc(fromUserRef);
    
    if (!fromUserDoc.exists()) {
      console.error('From user not found');
      return;
    }

    const fromUserData = fromUserDoc.data();
    
    // Obtener preferencias del usuario que recibe
    const toUserRef = doc(db, 'users', toUserId);
    const toUserDoc = await getDoc(toUserRef);
    
    if (!toUserDoc.exists()) {
      console.error('To user not found');
      return;
    }

    const toUserData = toUserDoc.data();
    const preferences = toUserData.notificationPreferences || {};

    // Verificar si el usuario tiene habilitada esta notificación
    let shouldNotify = true;
    
    switch (type) {
      case 'new_follower':
        shouldNotify = preferences.newFollowers !== false;
        break;
      case 'like':
        shouldNotify = preferences.characterLikes !== false;
        break;
      case 'coin_donation':
        shouldNotify = preferences.coinDonations !== false;
        break;
      case 'new_video':
        shouldNotify = preferences.followedUserCharacters !== false;
        break;
    }

    if (!shouldNotify) {
      console.log(`Notification skipped: ${type} disabled for user ${toUserId}`);
      return;
    }

    // Crear la notificación
    await addDoc(collection(db, 'notifications'), {
      toUserId,
      fromUserId,
      fromUserName: fromUserData.displayName || fromUserData.username || 'User',
      fromUserAvatar: fromUserData.photoURL || `https://ui-avatars.com/api/?name=${fromUserData.displayName || 'User'}`,
      type,
      message,
      videoId: videoId || null,
      videoThumbnail: videoThumbnail || null,
      timestamp: serverTimestamp(),
      read: false
    });

    console.log(`✅ Notification created: ${type} for user ${toUserId}`);
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

/**
 * Notifica cuando alguien sigue a un usuario
 */
export const notifyNewFollower = async (followedUserId: string, followerUserId: string) => {
  await createNotification({
    toUserId: followedUserId,
    fromUserId: followerUserId,
    type: 'new_follower',
    message: 'started following you'
  });
};

/**
 * Notifica cuando alguien le da like a un video
 */
export const notifyVideoLike = async (videoOwnerId: string, likerUserId: string, videoId: string, videoThumbnail: string) => {
  await createNotification({
    toUserId: videoOwnerId,
    fromUserId: likerUserId,
    type: 'like',
    message: 'liked your video',
    videoId,
    videoThumbnail
  });
};

/**
 * Notifica cuando alguien comenta en un video
 */
export const notifyVideoComment = async (videoOwnerId: string, commenterUserId: string, videoId: string, videoThumbnail: string) => {
  await createNotification({
    toUserId: videoOwnerId,
    fromUserId: commenterUserId,
    type: 'comment',
    message: 'commented on your video',
    videoId,
    videoThumbnail
  });
};

/**
 * Notifica cuando alguien dona coins
 */
export const notifyCoinDonation = async (recipientUserId: string, donorUserId: string, amount: number) => {
  await createNotification({
    toUserId: recipientUserId,
    fromUserId: donorUserId,
    type: 'coin_donation',
    message: `donated ${amount} coins to you`
  });
};

/**
 * Notifica a los seguidores cuando un usuario sube un nuevo video
 */
export const notifyFollowersNewVideo = async (uploaderUserId: string, videoId: string, videoThumbnail: string, followerIds: string[]) => {
  // Crear notificaciones para todos los seguidores
  const promises = followerIds.map(followerId =>
    createNotification({
      toUserId: followerId,
      fromUserId: uploaderUserId,
      type: 'new_video',
      message: 'uploaded a new video',
      videoId,
      videoThumbnail
    })
  );

  await Promise.all(promises);
};
