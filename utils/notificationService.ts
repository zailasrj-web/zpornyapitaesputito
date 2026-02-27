import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

/**
 * Create a notification for a user
 */
export const createNotification = async (
  toUserId: string,
  type: 'new_video' | 'new_follower' | 'like' | 'comment',
  fromUserId: string,
  fromUserName: string,
  fromUserAvatar: string,
  message: string,
  videoId?: string,
  videoThumbnail?: string
) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      toUserId,
      type,
      fromUserId,
      fromUserName,
      fromUserAvatar,
      message,
      videoId: videoId || null,
      videoThumbnail: videoThumbnail || null,
      timestamp: serverTimestamp(),
      read: false
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

/**
 * Notify all followers when a user uploads a new video
 */
export const notifyFollowersNewVideo = async (
  uploaderUserId: string,
  uploaderName: string,
  uploaderAvatar: string,
  videoId: string,
  videoThumbnail: string
) => {
  try {
    // Get all users who follow this uploader
    const followersQuery = query(
      collection(db, 'follows'),
      where('followingId', '==', uploaderUserId)
    );
    
    const followersSnapshot = await getDocs(followersQuery);
    
    // Create notification for each follower
    const notificationPromises = followersSnapshot.docs.map(doc => {
      const followerId = doc.data().followerId;
      return createNotification(
        followerId,
        'new_video',
        uploaderUserId,
        uploaderName,
        uploaderAvatar,
        'uploaded a new video',
        videoId,
        videoThumbnail
      );
    });
    
    await Promise.all(notificationPromises);
    console.log(`Notified ${followersSnapshot.size} followers about new video`);
  } catch (error) {
    console.error('Error notifying followers:', error);
  }
};

/**
 * Notify user when someone follows them
 */
export const notifyNewFollower = async (
  followedUserId: string,
  followerUserId: string,
  followerName: string,
  followerAvatar: string
) => {
  await createNotification(
    followedUserId,
    'new_follower',
    followerUserId,
    followerName,
    followerAvatar,
    'started following you'
  );
};

/**
 * Notify user when someone likes their video
 */
export const notifyVideoLike = async (
  videoOwnerId: string,
  likerUserId: string,
  likerName: string,
  likerAvatar: string,
  videoId: string,
  videoThumbnail: string
) => {
  // Don't notify if user likes their own video
  if (videoOwnerId === likerUserId) return;
  
  await createNotification(
    videoOwnerId,
    'like',
    likerUserId,
    likerName,
    likerAvatar,
    'liked your video',
    videoId,
    videoThumbnail
  );
};

/**
 * Notify user when someone comments on their video
 */
export const notifyVideoComment = async (
  videoOwnerId: string,
  commenterUserId: string,
  commenterName: string,
  commenterAvatar: string,
  videoId: string,
  videoThumbnail: string,
  commentText: string
) => {
  // Don't notify if user comments on their own video
  if (videoOwnerId === commenterUserId) return;
  
  const truncatedComment = commentText.length > 30 
    ? commentText.substring(0, 30) + '...' 
    : commentText;
  
  await createNotification(
    videoOwnerId,
    'comment',
    commenterUserId,
    commenterName,
    commenterAvatar,
    `commented: "${truncatedComment}"`,
    videoId,
    videoThumbnail
  );
};
