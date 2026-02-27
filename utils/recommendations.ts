import { db } from '../firebase';
import { doc, setDoc, getDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';

interface UserInteraction {
  videoId: string;
  tags: string[];
  timestamp: any;
  type: 'view' | 'like' | 'comment';
}

interface VideoData {
  id: string;
  tags: string[];
  category?: string;
  userId: string;
}

/**
 * Track user interaction with a video (view, like, comment)
 */
export const trackInteraction = async (
  userId: string,
  videoId: string,
  tags: string[],
  type: 'view' | 'like' | 'comment'
) => {
  try {
    const userInteractionsRef = doc(db, 'userInteractions', userId);
    
    const interaction: UserInteraction = {
      videoId,
      tags,
      timestamp: serverTimestamp(),
      type
    };

    await setDoc(userInteractionsRef, {
      [type + 's']: arrayUnion(interaction),
      lastUpdated: serverTimestamp()
    }, { merge: true });

    // Update tag preferences
    await updateTagPreferences(userId, tags, type);
  } catch (error) {
    console.error('Error tracking interaction:', error);
  }
};

/**
 * Update user's tag preferences based on interactions
 */
const updateTagPreferences = async (
  userId: string,
  tags: string[],
  type: 'view' | 'like' | 'comment'
) => {
  try {
    const userPrefsRef = doc(db, 'userPreferences', userId);
    const userPrefsSnap = await getDoc(userPrefsRef);
    
    let tagScores: { [key: string]: number } = {};
    
    if (userPrefsSnap.exists()) {
      tagScores = userPrefsSnap.data().tagScores || {};
    }

    // Weight different interactions
    const weights = {
      view: 1,
      like: 3,
      comment: 2
    };

    // Update scores for each tag
    tags.forEach(tag => {
      const normalizedTag = tag.toLowerCase();
      tagScores[normalizedTag] = (tagScores[normalizedTag] || 0) + weights[type];
    });

    await setDoc(userPrefsRef, {
      tagScores,
      lastUpdated: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error updating tag preferences:', error);
  }
};

/**
 * Get recommended videos based on user preferences
 */
export const getRecommendedVideos = async (
  userId: string,
  allVideos: VideoData[]
): Promise<VideoData[]> => {
  try {
    const userPrefsRef = doc(db, 'userPreferences', userId);
    const userPrefsSnap = await getDoc(userPrefsRef);
    
    if (!userPrefsSnap.exists()) {
      // No preferences yet, return random shuffle
      return shuffleArray(allVideos);
    }

    const tagScores: { [key: string]: number } = userPrefsSnap.data().tagScores || {};
    
    // Get videos user has already interacted with
    const userInteractionsRef = doc(db, 'userInteractions', userId);
    const userInteractionsSnap = await getDoc(userInteractionsRef);
    
    const viewedVideoIds = new Set<string>();
    if (userInteractionsSnap.exists()) {
      const data = userInteractionsSnap.data();
      const views = data.views || [];
      views.forEach((v: UserInteraction) => viewedVideoIds.add(v.videoId));
    }

    // Score each video based on tag preferences
    const scoredVideos = allVideos.map(video => {
      let score = 0;
      
      // Penalize already viewed videos
      if (viewedVideoIds.has(video.id)) {
        score -= 100;
      }

      // Score based on matching tags
      video.tags.forEach(tag => {
        const normalizedTag = tag.toLowerCase();
        score += tagScores[normalizedTag] || 0;
      });

      // Add some randomness to avoid echo chamber (20% random factor)
      score += Math.random() * 20;

      return { video, score };
    });

    // Sort by score (highest first)
    scoredVideos.sort((a, b) => b.score - a.score);

    return scoredVideos.map(sv => sv.video);
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return shuffleArray(allVideos);
  }
};

/**
 * Shuffle array for random order
 */
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Track video view (call when video is played for >3 seconds)
 */
export const trackVideoView = async (
  userId: string,
  videoId: string,
  tags: string[]
) => {
  await trackInteraction(userId, videoId, tags, 'view');
};

/**
 * Track video like
 */
export const trackVideoLike = async (
  userId: string,
  videoId: string,
  tags: string[]
) => {
  await trackInteraction(userId, videoId, tags, 'like');
};

/**
 * Track video comment
 */
export const trackVideoComment = async (
  userId: string,
  videoId: string,
  tags: string[]
) => {
  await trackInteraction(userId, videoId, tags, 'comment');
};
