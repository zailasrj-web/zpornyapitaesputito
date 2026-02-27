export interface Character {
  id: string;
  name: string; // Treated as Title
  duration: string; // New field for video length
  image: string;
  likes: string;
  views: string; // Renamed from chats for video context
  comments?: number; // Number of comments
  videoUrl?: string; // Added for uploaded video reference
  category?: string;
  description?: string; // Video description
  // Optional author fields for the player
  authorId?: string; // ID of the user who created the content
  authorName?: string;
  authorAvatar?: string;
  authorHandle?: string;
  // Premium/VIP features
  vipOnly?: boolean; // Only VIP users can view this content
  premiumOnly?: boolean; // Premium and VIP users can view this content
  earlyAccess?: boolean; // Early access content (VIP gets it first)
  earlyAccessUntil?: any; // Timestamp when it becomes available to all
}

export interface SidebarItem {
  label: string;
  iconClass: string;
  isActive?: boolean;
  isNew?: boolean;
  link?: string;
}

export interface Tag {
  label: string;
  isActive?: boolean;
}