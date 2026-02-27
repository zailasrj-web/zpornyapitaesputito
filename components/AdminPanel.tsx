import React, { useState, useEffect } from 'react';
import { Character } from '../types';
import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit,
  where,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
  addDoc,
  increment
} from 'firebase/firestore';
import SupportTicketsPanel from './SupportTicketsPanel';

interface AdminPanelProps {
  admins: string[];
  onAddAdmin: (email: string) => void;
  onRemoveAdmin: (email: string) => void;
  videos: Character[];
  onDeleteVideo: (id: string) => void;
  currentUserEmail: string | null | undefined;
  onOpenVideo?: (videoId: string) => void;
}

interface UserData {
  id: string;
  email: string;
  displayName: string;
  username?: string;
  status: 'Active' | 'Banned';
  role: string;
  createdAt?: any;
  banned?: boolean;
  subscription?: string;
}

interface Report {
  id: string;
  type: string;
  content: string;
  reporter: string;
  reporterId?: string;
  reportedUser?: string;
  reportedUserId?: string;
  reportedUserEmail?: string;
  status: 'Pending' | 'Reviewed' | 'Resolved';
  createdAt: any;
  videoId?: string;
  postId?: string;
  reason?: string;
}

interface AuditLog {
  id: string;
  action: string;
  user: string;
  targetUser?: string;
  ip?: string;
  timestamp: any;
  details?: string;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  admins, 
  onAddAdmin, 
  onRemoveAdmin, 
  videos, 
  onDeleteVideo,
  currentUserEmail,
  onOpenVideo
}) => {
  const OWNER_EMAIL = 'zailasrj@gmail.com';
  const isOwner = currentUserEmail === OWNER_EMAIL;
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'moderation' | 'content' | 'settings' | 'logs' | 'support'>('dashboard');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  
  // Real Data States
  const [users, setUsers] = useState<UserData[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSubscriptions: 0,
    pendingReports: 0,
    totalVideos: 0
  });
  const [loading, setLoading] = useState(true);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [resolvingReportId, setResolvingReportId] = useState<string | null>(null);
  
  // Tier Update States
  const [tierUpdateEmail, setTierUpdateEmail] = useState('');
  const [selectedTier, setSelectedTier] = useState<'Premium' | 'VIP'>('Premium');
  const [updatingTier, setUpdatingTier] = useState(false);
  
  // Settings State
  const [settings, setSettings] = useState({
    maintenanceMode: false,
    allowSignups: true,
    filterNSFW: true,
    requireEmailVerification: true
  });

  // Load Real Data
  useEffect(() => {
    loadAllData();
  }, []);

  // Debug: Log when admins prop changes
  useEffect(() => {
    console.log("📋 AdminPanel - admins prop updated:", admins);
  }, [admins]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadUsers(),
        loadReports(),
        loadAuditLogs(),
        loadStats(),
        loadSettings()
      ]);
    } catch (error) {
      console.error("Error loading admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const usersRef = collection(db, "users");
      const snapshot = await getDocs(usersRef);
      const usersData: UserData[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        usersData.push({
          id: doc.id,
          email: data.email || 'No email',
          displayName: data.displayName || data.email?.split('@')[0] || 'Anonymous',
          username: data.username || data.email?.split('@')[0],
          status: data.banned ? 'Banned' : 'Active',
          role: data.subscription === 'visionary' ? 'Visionary' : 'User',
          createdAt: data.createdAt,
          banned: data.banned || false,
          subscription: data.subscription
        });
      });
      
      setUsers(usersData);
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  const loadReports = async () => {
    try {
      const reportsRef = collection(db, "reports");
      const q = query(reportsRef, orderBy("createdAt", "desc"), limit(50));
      const snapshot = await getDocs(q);
      const reportsData: Report[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        reportsData.push({
          id: doc.id,
          type: data.type || 'General',
          content: data.content || data.reason || 'No details',
          reporter: data.reporterEmail || data.reporterId || data.reporter || 'Anonymous',
          reporterId: data.reporterId,
          reportedUser: data.reportedUser || data.targetUser,
          reportedUserId: data.reportedUserId,
          reportedUserEmail: data.reportedUserEmail,
          status: data.status || 'Pending',
          createdAt: data.createdAt,
          videoId: data.videoId,
          postId: data.postId,
          reason: data.reason
        });
      });
      
      setReports(reportsData);
    } catch (error) {
      console.error("Error loading reports:", error);
      setReports([]);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const logsRef = collection(db, "auditLogs");
      const q = query(logsRef, orderBy("timestamp", "desc"), limit(100));
      const snapshot = await getDocs(q);
      const logsData: AuditLog[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        logsData.push({
          id: doc.id,
          action: data.action || 'UNKNOWN',
          user: data.user || data.adminEmail || 'System',
          targetUser: data.targetUser,
          ip: data.ip || 'Unknown',
          timestamp: data.timestamp,
          details: data.details
        });
      });
      
      setAuditLogs(logsData);
    } catch (error) {
      console.error("Error loading audit logs:", error);
      setAuditLogs([]);
    }
  };

  const loadStats = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, "users"));
      const totalUsers = usersSnapshot.size;
      
      let activeSubscriptions = 0;
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.subscription === 'visionary') {
          activeSubscriptions++;
        }
      });

      const reportsSnapshot = await getDocs(
        query(collection(db, "reports"), where("status", "==", "Pending"))
      );
      const pendingReports = reportsSnapshot.size;

      setStats({
        totalUsers,
        activeSubscriptions,
        pendingReports,
        totalVideos: videos.length
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const loadSettings = async () => {
    try {
      const settingsRef = doc(db, "platformSettings", "general");
      const settingsDoc = await getDoc(settingsRef);
      
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        setSettings({
          maintenanceMode: data.maintenanceMode || false,
          allowSignups: data.allowSignups !== false,
          filterNSFW: data.filterNSFW !== false,
          requireEmailVerification: data.requireEmailVerification !== false
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const logAdminAction = async (action: string, targetUser?: string, details?: string) => {
    try {
      await setDoc(doc(collection(db, "auditLogs")), {
        action,
        user: currentUserEmail || 'Unknown',
        targetUser,
        details,
        timestamp: serverTimestamp(),
        ip: 'Client'
      });
      loadAuditLogs(); // Refresh logs
    } catch (error) {
      console.error("Error logging action:", error);
    }
  };

  const handleBanUser = async (userId: string, userEmail: string) => {
    if (!confirm(`¿Banear a ${userEmail}?`)) return;
    
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        banned: true,
        bannedAt: serverTimestamp(),
        bannedBy: currentUserEmail
      });
      
      await logAdminAction('USER_BAN', userEmail, `User banned by admin`);
      loadUsers();
      loadStats();
      alert(`Usuario ${userEmail} baneado exitosamente`);
    } catch (error) {
      console.error("Error banning user:", error);
      alert("Error al banear usuario");
    }
  };

  const handleUnbanUser = async (userId: string, userEmail: string) => {
    if (!confirm(`¿Desbanear a ${userEmail}?`)) return;
    
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        banned: false,
        unbannedAt: serverTimestamp(),
        unbannedBy: currentUserEmail
      });
      
      await logAdminAction('USER_UNBAN', userEmail, `User unbanned by admin`);
      loadUsers();
      loadStats();
      alert(`Usuario ${userEmail} desbaneado exitosamente`);
    } catch (error) {
      console.error("Error unbanning user:", error);
      alert("Error al desbanear usuario");
    }
  };

  const handleSetUserTier = async (userId: string, userEmail: string, tier: 'Free' | 'Premium' | 'VIP') => {
    if (!confirm(`¿Asignar tier ${tier} a ${userEmail}?`)) return;
    
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        tier: tier,
        tierUpdatedAt: serverTimestamp(),
        tierUpdatedBy: currentUserEmail
      });
      
      await logAdminAction('USER_TIER_UPDATE', userEmail, `Tier changed to ${tier} by admin`);
      loadUsers();
      loadStats();
      alert(`Usuario ${userEmail} ahora tiene tier ${tier}`);
    } catch (error) {
      console.error("Error updating user tier:", error);
      alert("Error al actualizar tier del usuario");
    }
  };

  // Nueva función para actualizar tier por email (para pagos manuales)
  const updateUserTierByEmail = async () => {
    if (!tierUpdateEmail.trim()) {
      alert('❌ Ingresa un email válido');
      return;
    }

    setUpdatingTier(true);
    try {
      // Buscar usuario por email
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", tierUpdateEmail.trim()));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        alert(`❌ Usuario con email ${tierUpdateEmail} no encontrado`);
        setUpdatingTier(false);
        return;
      }

      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();
      
      // Actualizar tier
      await updateDoc(userDoc.ref, {
        tier: selectedTier,
        tierUpdatedAt: serverTimestamp(),
        subscriptionActive: true,
        tierUpdatedBy: currentUserEmail
      });
      
      await logAdminAction('MANUAL_TIER_UPDATE', userData.email, `Tier updated to ${selectedTier} manually after payment`);
      
      alert(`✅ Usuario ${tierUpdateEmail} actualizado a ${selectedTier}`);
      setTierUpdateEmail('');
      loadUsers();
      loadStats();
      
    } catch (error) {
      console.error('Error updating user tier:', error);
      alert('❌ Error al actualizar tier del usuario');
    } finally {
      setUpdatingTier(false);
    }
  };

  const handleResolveReport = async (reportId: string, action: 'dismiss' | 'action') => {
    try {
      const report = reports.find(r => r.id === reportId);
      if (!report) return;

      // Set resolving state for visual feedback
      setResolvingReportId(reportId);

      const reportRef = doc(db, "reports", reportId);
      await updateDoc(reportRef, {
        status: action === 'dismiss' ? 'Resolved' : 'Reviewed',
        resolvedAt: serverTimestamp(),
        resolvedBy: currentUserEmail
      });
      
      await logAdminAction('REPORT_RESOLVED', reportId, `Report ${action === 'dismiss' ? 'dismissed' : 'actioned'}`);
      
      // Send system message to reporter
      if (report.reporterId) {
        await sendSystemMessageToUser(report.reporterId, action, report);
      }
      
      // Small delay for smooth animation
      setTimeout(() => {
        setResolvingReportId(null);
        loadReports();
        loadStats();
      }, 300);
      
    } catch (error) {
      console.error("Error resolving report:", error);
      setResolvingReportId(null);
    }
  };

  const sendSystemMessageToUser = async (userId: string, action: 'dismiss' | 'action', report: Report) => {
    try {
      // Create chat ID between System and user
      const SYSTEM_UID = 'system_bot_official';
      const chatId = [SYSTEM_UID, userId].sort().join('_');
      
      // Determine message based on action
      let messageText = '';
      if (action === 'dismiss') {
        messageText = `🔍 **Reporte Revisado**\n\nHemos revisado tu reporte sobre "${report.content}" y no encontramos violaciones a nuestras normas comunitarias.\n\nEl contenido reportado cumple con nuestras políticas.\n\nGracias por ayudarnos a mantener la plataforma segura. 💜`;
      } else {
        messageText = `✅ **Acción Tomada**\n\nGracias por tu reporte sobre "${report.content}".\n\nHemos revisado el contenido y tomado las medidas correspondientes según nuestras políticas.\n\n¡Tu ayuda es invaluable para mantener nuestra comunidad segura! 🛡️`;
      }
      
      // Calculate expiration time (24 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      
      // Send message to chat with expiration
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: messageText,
        senderUid: SYSTEM_UID,
        displayName: 'System',
        photoURL: 'https://res.cloudinary.com/dbfza2zyk/image/upload/v1768852307/ZZPO_lmy5e2.png',
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        type: 'system',
        read: false
      });
      
      // Update active_chats for the user to show System chat
      const userChatRef = doc(db, "users", userId, "active_chats", SYSTEM_UID);
      await setDoc(userChatRef, {
        partnerId: SYSTEM_UID,
        partnerName: 'System',
        partnerAvatar: 'https://res.cloudinary.com/dbfza2zyk/image/upload/v1768852307/ZZPO_lmy5e2.png',
        lastMessage: action === 'dismiss' ? 'Reporte revisado' : 'Acción tomada',
        timestamp: serverTimestamp(),
        unread: increment(1)
      });
      
      console.log(`✅ System message sent to user ${userId} for report ${report.id} (expires in 24h)`);
    } catch (error) {
      console.error("Error sending system message:", error);
    }
  };

  const handleDeleteVideoAdmin = async (videoId: string) => {
    if (!confirm('¿Eliminar este video permanentemente?')) return;
    
    try {
      await onDeleteVideo(videoId);
      await logAdminAction('DELETE_VIDEO', videoId, 'Video deleted by admin');
      loadStats();
    } catch (error) {
      console.error("Error deleting video:", error);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Only owner can add admins
    if (!isOwner) {
      alert('Solo el Owner puede agregar administradores');
      return;
    }
    
    if (newAdminEmail.trim()) {
      onAddAdmin(newAdminEmail.trim());
      logAdminAction('ADD_ADMIN', newAdminEmail, 'New admin added');
      setNewAdminEmail('');
    }
  };

  const toggleSetting = async (key: keyof typeof settings) => {
    const newValue = !settings[key];
    setSettings(prev => ({ ...prev, [key]: newValue }));
    
    try {
      const settingsRef = doc(db, "platformSettings", "general");
      await setDoc(settingsRef, {
        [key]: newValue,
        updatedAt: serverTimestamp(),
        updatedBy: currentUserEmail
      }, { merge: true });
      
      await logAdminAction('SETTINGS_UPDATE', undefined, `${key} set to ${newValue}`);
    } catch (error) {
      console.error("Error updating settings:", error);
      setSettings(prev => ({ ...prev, [key]: !newValue })); // Revert on error
    }
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const diff = (now.getTime() - date.getTime()) / 1000; // seconds
      
      if (diff < 60) return 'Just now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.displayName.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    (user.username && user.username.toLowerCase().includes(userSearchTerm.toLowerCase()))
  );

  const NavButton = ({ id, icon, label }: { id: typeof activeTab, icon: string, label: string }) => (
    <button 
        onClick={() => setActiveTab(id)}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left mb-1 ${
            activeTab === id 
            ? 'bg-accent text-white shadow-lg shadow-purple-900/20 font-bold' 
            : 'text-gray-400 hover:bg-white/5 hover:text-white'
        }`}
    >
        <div className={`w-6 flex justify-center ${activeTab === id ? 'text-white' : 'text-gray-500'}`}>
            <i className={`fa-solid ${icon}`}></i>
        </div>
        <span className="text-sm">{label}</span>
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto pt-4 pb-20 animate-[fadeIn_0.3s_ease-out] font-sans flex flex-col md:flex-row gap-6 min-h-[80vh]">
      
      {/* --- SIDEBAR NAVIGATION --- */}
      <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-4 h-full sticky top-24">
              <div className="mb-6 px-2">
                 <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <i className="fa-solid fa-shield-cat text-accent"></i> Admin
                 </h2>
                 <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 font-bold">Control Center</p>
              </div>

              <nav className="space-y-1">
                  <NavButton id="dashboard" icon="fa-chart-line" label="Dashboard" />
                  <NavButton id="users" icon="fa-users-gear" label="User Management" />
                  <NavButton id="moderation" icon="fa-gavel" label="Moderation" />
                  <NavButton id="support" icon="fa-headset" label="Support Tickets" />
                  <NavButton id="content" icon="fa-video" label="Content Library" />
                  <NavButton id="settings" icon="fa-sliders" label="Platform Settings" />
                  <NavButton id="logs" icon="fa-file-shield" label="Security Logs" />
              </nav>

              <div className="mt-8 pt-6 border-t border-white/5 px-2">
                  <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                          <i className="fa-solid fa-triangle-exclamation text-xs"></i>
                      </div>
                      <div className="text-xs">
                          <p className="text-white font-bold">System Status</p>
                          <p className="text-green-400">● Operational</p>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1">
        
        {/* === DASHBOARD TAB === */}
        {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                <h3 className="text-2xl font-bold text-white">Overview</h3>
                
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
                    </div>
                ) : (
                    <>
                        {/* Stats Grid - REAL DATA */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-colors">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-gray-400 text-xs font-medium uppercase">Total Users</p>
                                        <h4 className="text-2xl font-bold text-white mt-1">{stats.totalUsers.toLocaleString()}</h4>
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-blue-400">
                                        <i className="fa-solid fa-users text-lg"></i>
                                    </div>
                                </div>
                                <span className="text-xs px-2 py-1 rounded-md bg-white/5 text-gray-400">
                                    Registered accounts
                                </span>
                            </div>

                            <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-colors">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-gray-400 text-xs font-medium uppercase">Visionary Users</p>
                                        <h4 className="text-2xl font-bold text-white mt-1">{stats.activeSubscriptions}</h4>
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-amber-400">
                                        <i className="fa-solid fa-crown text-lg"></i>
                                    </div>
                                </div>
                                <span className="text-xs px-2 py-1 rounded-md bg-white/5 text-gray-400">
                                    Premium subscribers
                                </span>
                            </div>

                            <div 
                                onClick={() => setActiveTab('moderation')}
                                className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-5 hover:border-red-500/50 transition-all cursor-pointer group"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-gray-400 text-xs font-medium uppercase group-hover:text-red-400 transition-colors">Pending Reports</p>
                                        <h4 className="text-2xl font-bold text-white mt-1 group-hover:text-red-400 transition-colors">{stats.pendingReports}</h4>
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-red-400 group-hover:bg-red-500/20 transition-colors">
                                        <i className="fa-solid fa-flag text-lg"></i>
                                    </div>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-md bg-white/5 ${stats.pendingReports > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                    {stats.pendingReports > 0 ? 'Click to review' : 'All clear'}
                                </span>
                            </div>

                            <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-colors">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-gray-400 text-xs font-medium uppercase">Total Videos</p>
                                        <h4 className="text-2xl font-bold text-white mt-1">{stats.totalVideos}</h4>
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-green-400">
                                        <i className="fa-solid fa-video text-lg"></i>
                                    </div>
                                </div>
                                <span className="text-xs px-2 py-1 rounded-md bg-white/5 text-gray-400">
                                    Content library
                                </span>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6">
                            <h4 className="text-lg font-bold text-white mb-4">Quick Actions</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <button 
                                    onClick={() => setActiveTab('users')}
                                    className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 text-center transition-colors"
                                >
                                    <i className="fa-solid fa-users text-2xl text-blue-400 mb-2"></i>
                                    <p className="text-xs text-white font-bold">Manage Users</p>
                                </button>
                                <button 
                                    onClick={() => setActiveTab('moderation')}
                                    className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 text-center transition-colors"
                                >
                                    <i className="fa-solid fa-gavel text-2xl text-red-400 mb-2"></i>
                                    <p className="text-xs text-white font-bold">View Reports</p>
                                </button>
                                <button 
                                    onClick={() => setActiveTab('content')}
                                    className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 text-center transition-colors"
                                >
                                    <i className="fa-solid fa-video text-2xl text-green-400 mb-2"></i>
                                    <p className="text-xs text-white font-bold">Manage Content</p>
                                </button>
                                <button 
                                    onClick={() => setActiveTab('settings')}
                                    className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 text-center transition-colors"
                                >
                                    <i className="fa-solid fa-cog text-2xl text-gray-400 mb-2"></i>
                                    <p className="text-xs text-white font-bold">Settings</p>
                                </button>
                            </div>
                        </div>

                        {/* Manual Tier Update - Para pagos sin Success URL */}
                        <div className="bg-[#0A0A0A] border border-amber-500/20 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                    <i className="fa-solid fa-crown text-amber-400"></i>
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-white">Actualizar Tier Manual</h4>
                                    <p className="text-sm text-gray-400">Para usuarios que pagaron pero no se actualizó automáticamente</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Email del usuario
                                    </label>
                                    <input
                                        type="email"
                                        value={tierUpdateEmail}
                                        onChange={(e) => setTierUpdateEmail(e.target.value)}
                                        placeholder="usuario@ejemplo.com"
                                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Nuevo tier
                                    </label>
                                    <select
                                        value={selectedTier}
                                        onChange={(e) => setSelectedTier(e.target.value as 'Premium' | 'VIP')}
                                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                                    >
                                        <option value="Premium">Premium</option>
                                        <option value="VIP">VIP</option>
                                    </select>
                                </div>
                                
                                <button
                                    onClick={updateUserTierByEmail}
                                    disabled={updatingTier || !tierUpdateEmail.trim()}
                                    className="px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    {updatingTier ? (
                                        <>
                                            <i className="fa-solid fa-spinner fa-spin"></i>
                                            Actualizando...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-crown"></i>
                                            Actualizar Tier
                                        </>
                                    )}
                                </button>
                            </div>
                            
                            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                <p className="text-sm text-blue-300">
                                    <i className="fa-solid fa-info-circle mr-2"></i>
                                    <strong>Uso:</strong> Cuando un usuario pague con Stripe pero no se actualice automáticamente, 
                                    ingresa su email aquí para asignarle el tier correspondiente.
                                </p>
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6">
                            <h4 className="text-lg font-bold text-white mb-4">Recent Admin Actions</h4>
                            {auditLogs.length > 0 ? (
                                <div className="space-y-2">
                                    {auditLogs.slice(0, 5).map(log => (
                                        <div key={log.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                                                    <i className="fa-solid fa-bolt text-accent text-xs"></i>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-white font-bold">{log.action.replace(/_/g, ' ')}</p>
                                                    <p className="text-xs text-gray-500">by {log.user}</p>
                                                </div>
                                            </div>
                                            <span className="text-xs text-gray-500">{formatTimestamp(log.timestamp)}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-gray-500 py-8">No recent activity</p>
                            )}
                        </div>
                    </>
                )}
            </div>
        )}

        {/* === USERS TAB === */}
        {activeTab === 'users' && (
            <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* Add Admin */}
                        <div className="lg:col-span-1">
                            <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 h-full">
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    Grant Admin Access
                                    {!isOwner && <span className="text-xs text-red-400">(Owner Only)</span>}
                                </h3>
                                {isOwner ? (
                                    <form onSubmit={handleAddSubmit} className="space-y-4">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-400 block mb-2">User Email</label>
                                            <input 
                                                type="email" 
                                                value={newAdminEmail}
                                                onChange={(e) => setNewAdminEmail(e.target.value)}
                                                placeholder="user@example.com"
                                                className="w-full bg-[#151515] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-accent focus:outline-none transition-colors"
                                                required
                                            />
                                        </div>
                                        <button 
                                            type="submit"
                                            className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                                        >
                                            Add Admin
                                        </button>
                                    </form>
                                ) : (
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
                                        <i className="fa-solid fa-lock text-red-400 text-2xl mb-2"></i>
                                        <p className="text-sm text-red-400">Solo el Owner puede agregar administradores</p>
                                    </div>
                                )}

                                {/* Current Admins List (Small) */}
                                <div className="mt-8">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">
                                        Active Admins ({admins.length})
                                    </h4>
                                    <div className="space-y-2">
                                        {admins.map(admin => (
                                            <div key={admin} className="flex justify-between items-center text-sm p-2 bg-white/5 rounded-lg">
                                                <span className="text-gray-300 truncate flex-1">{admin}</span>
                                                {admin !== currentUserEmail && admin !== 'zailasrj@gmail.com' && isOwner && (
                                                    <button 
                                                        onClick={() => {
                                                            console.log("🗑️ Remove button clicked for:", admin);
                                                            onRemoveAdmin(admin);
                                                        }} 
                                                        className="text-red-400 hover:text-red-300 text-xs font-bold ml-2"
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                                {admin === 'zailasrj@gmail.com' && (
                                                    <span className="text-blue-400 text-xs ml-2">👑 Owner</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* All Users Table - REAL DATA */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* ADMINS TABLE */}
                            <div className="bg-[#0A0A0A] border border-red-500/20 rounded-2xl overflow-hidden">
                                <div className="p-6 border-b border-red-500/10 flex justify-between items-center bg-red-500/5">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <i className="fa-solid fa-shield-halved text-red-400"></i>
                                        Administrators ({filteredUsers.filter(u => admins.includes(u.email)).length})
                                    </h3>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-red-500/5 text-xs text-gray-400 uppercase sticky top-0">
                                            <tr>
                                                <th className="p-4">Admin</th>
                                                <th className="p-4">Role</th>
                                                <th className="p-4">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 text-sm">
                                            {filteredUsers.filter(u => admins.includes(u.email)).length > 0 ? (
                                                filteredUsers.filter(u => admins.includes(u.email)).map(user => (
                                                    <tr key={user.id} className="hover:bg-white/5">
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-2">
                                                                <div>
                                                                    <div className="font-bold text-white">{user.displayName}</div>
                                                                    <div className="text-xs text-gray-500">{user.email}</div>
                                                                </div>
                                                                {user.email === OWNER_EMAIL && (
                                                                    <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                                                                        👑 OWNER
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className="px-2 py-1 rounded text-xs font-bold border bg-red-500/10 text-red-400 border-red-500/20">
                                                                ADMIN
                                                            </span>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className={`px-2 py-1 rounded text-xs border ${
                                                                user.status === 'Active' 
                                                                ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                                                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                                                            }`}>
                                                                {user.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={3} className="p-8 text-center text-gray-500">
                                                        No admins found
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* REGULAR USERS TABLE */}
                            <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden">
                                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <i className="fa-solid fa-users text-blue-400"></i>
                                        Regular Users ({filteredUsers.filter(u => !admins.includes(u.email)).length})
                                    </h3>
                                    <input 
                                        type="text" 
                                        placeholder="Search users..." 
                                        value={userSearchTerm}
                                        onChange={(e) => setUserSearchTerm(e.target.value)}
                                        className="bg-[#151515] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
                                    />
                                </div>
                                <div className="max-h-[600px] overflow-y-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-white/5 text-xs text-gray-400 uppercase sticky top-0">
                                            <tr>
                                                <th className="p-4">User</th>
                                                <th className="p-4">Tier</th>
                                                <th className="p-4">Status</th>
                                                <th className="p-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 text-sm">
                                            {filteredUsers.filter(u => !admins.includes(u.email)).length > 0 ? (
                                                filteredUsers.filter(u => !admins.includes(u.email)).map(user => (
                                                    <tr key={user.id} className="hover:bg-white/5">
                                                        <td className="p-4">
                                                            <div className="font-bold text-white">{user.displayName}</div>
                                                            <div className="text-xs text-gray-500">{user.email}</div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2 py-1 rounded text-xs font-bold border ${
                                                                    user.subscription === 'vip' || user.role === 'VIP'
                                                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                                                                    : user.subscription === 'premium' || user.role === 'Premium'
                                                                    ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                                                    : 'bg-white/5 text-gray-400 border-white/10'
                                                                }`}>
                                                                    {user.subscription || user.role || 'Free'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className={`px-2 py-1 rounded text-xs border ${
                                                                user.status === 'Active' 
                                                                ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                                                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                                                            }`}>
                                                                {user.status}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            <div className="flex items-center justify-end gap-2 flex-wrap">
                                                                {/* Tier Buttons */}
                                                                <div className="flex gap-1">
                                                                    <button 
                                                                        onClick={() => handleSetUserTier(user.id, user.email, 'Free')}
                                                                        className="text-[10px] px-2 py-1 rounded bg-gray-500/10 text-gray-400 hover:bg-gray-500/20 border border-gray-500/20 font-bold"
                                                                        title="Set Free"
                                                                    >
                                                                        Free
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleSetUserTier(user.id, user.email, 'Premium')}
                                                                        className="text-[10px] px-2 py-1 rounded bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border border-yellow-500/20 font-bold"
                                                                        title="Set Premium"
                                                                    >
                                                                        Premium
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleSetUserTier(user.id, user.email, 'VIP')}
                                                                        className="text-[10px] px-2 py-1 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 font-bold"
                                                                        title="Set VIP"
                                                                    >
                                                                        VIP
                                                                    </button>
                                                                </div>
                                                                
                                                                {/* Ban/Unban Button */}
                                                                {user.banned ? (
                                                                    <button 
                                                                        onClick={() => handleUnbanUser(user.id, user.email)}
                                                                        className="text-green-400 hover:text-green-300 text-xs font-bold"
                                                                        title="Unban user"
                                                                    >
                                                                        <i className="fa-solid fa-check mr-1"></i>Unban
                                                                    </button>
                                                                ) : (
                                                                    <button 
                                                                        onClick={() => handleBanUser(user.id, user.email)}
                                                                        className="text-red-400 hover:text-red-300 text-xs font-bold"
                                                                        title="Ban user"
                                                                    >
                                                                        <i className="fa-solid fa-ban mr-1"></i>Ban
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={4} className="p-8 text-center text-gray-500">
                                                        No users found
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* === MODERATION TAB === */}
        {activeTab === 'moderation' && (
             <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out]">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Reports ({reports.filter(r => r.status === 'Pending').length} Pending)</h3>
                    <button 
                        onClick={loadReports}
                        className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white transition-colors"
                    >
                        <i className="fa-solid fa-rotate mr-1"></i>Refresh
                    </button>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
                        {reports.filter(r => r.status === 'Pending').length > 0 ? (
                            reports.filter(r => r.status === 'Pending').map(report => (
                                <div 
                                    key={report.id} 
                                    className={`p-5 hover:bg-white/5 transition-all ${
                                        resolvingReportId === report.id ? 'opacity-50 pointer-events-none animate-pulse' : ''
                                    }`}
                                >
                                    {/* Header with badges and timestamp */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                                                report.type === 'Message' ? 'border-blue-500/30 text-blue-400' : 
                                                report.type === 'Image' ? 'border-purple-500/30 text-purple-400' : 
                                                'border-orange-500/30 text-orange-400'
                                            }`}>
                                                {report.type}
                                            </span>
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                                                report.status === 'Pending' ? 'border-yellow-500/30 text-yellow-400' :
                                                report.status === 'Reviewed' ? 'border-blue-500/30 text-blue-400' :
                                                'border-green-500/30 text-green-400'
                                            }`}>
                                                {report.status}
                                            </span>
                                        </div>
                                        <span className="text-xs text-gray-600">{formatTimestamp(report.createdAt)}</span>
                                    </div>

                                    {/* Main content - clickable to open video */}
                                    <div 
                                        className="cursor-pointer group mb-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors border border-white/5"
                                        onClick={() => {
                                            const videoId = report.videoId || report.postId;
                                            if (videoId && onOpenVideo) {
                                                onOpenVideo(videoId);
                                            } else {
                                                alert('⚠️ No se puede abrir el video.\n\nEste reporte no tiene un ID de video asociado.\nProbablemente es un reporte antiguo o de contenido eliminado.');
                                            }
                                        }}
                                    >
                                        <div className="flex items-start gap-2 mb-2">
                                            <i className="fa-solid fa-video text-accent mt-1"></i>
                                            <div className="flex-1">
                                                <p className="text-white text-sm font-bold group-hover:text-accent transition-colors">
                                                    {report.content}
                                                    {(report.videoId || report.postId) ? (
                                                        <i className="fa-solid fa-external-link-alt ml-2 text-xs text-gray-500 group-hover:text-accent"></i>
                                                    ) : (
                                                        <span className="ml-2 text-xs text-gray-600 italic font-normal">(Video no disponible)</span>
                                                    )}
                                                </p>
                                                {report.reportedUser && (
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        <i className="fa-solid fa-user mr-1"></i>
                                                        Reported user: <span className="text-gray-400 font-medium">
                                                            {report.reportedUser === 'Unknown' && report.reportedUserEmail && report.reportedUserEmail !== 'Unknown'
                                                                ? report.reportedUserEmail
                                                                : report.reportedUser}
                                                        </span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Reporter info and reason - highlighted */}
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-3">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                                <i className="fa-solid fa-flag text-red-400 text-xs"></i>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold text-red-400 uppercase">Reportado por:</span>
                                                    <span className="text-sm text-white font-bold">{report.reporter}</span>
                                                </div>
                                                {report.reason && (
                                                    <div className="mt-2">
                                                        <p className="text-xs font-bold text-gray-400 mb-1">Razón del reporte:</p>
                                                        <p className="text-sm text-white bg-black/30 p-2 rounded border border-white/5 italic">
                                                            "{report.reason}"
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    {report.status === 'Pending' && (
                                        <div className="flex gap-3 justify-end">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm('¿Descartar este reporte?\n\nEsto significa que revisaste el contenido y no encontraste ningún problema.')) {
                                                        handleResolveReport(report.id, 'dismiss');
                                                    }
                                                }}
                                                disabled={resolvingReportId === report.id}
                                                className="bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-bold px-4 py-2 rounded-lg border border-green-500/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Marcar como revisado - No hay problema"
                                            >
                                                {resolvingReportId === report.id ? (
                                                    <>
                                                        <i className="fa-solid fa-circle-notch fa-spin"></i>
                                                        Resolving...
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fa-solid fa-check"></i>
                                                        Dismiss
                                                    </>
                                                )}
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm('¿Tomar acción sobre este reporte?\n\nEsto significa que el contenido viola las reglas y tomarás medidas (borrar video, banear usuario, etc.)')) {
                                                        handleResolveReport(report.id, 'action');
                                                    }
                                                }}
                                                disabled={resolvingReportId === report.id}
                                                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold px-4 py-2 rounded-lg border border-red-500/20 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Tomar acción - Contenido viola reglas"
                                            >
                                                {resolvingReportId === report.id ? (
                                                    <>
                                                        <i className="fa-solid fa-circle-notch fa-spin"></i>
                                                        Processing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fa-solid fa-gavel"></i>
                                                        Take Action
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-500">
                                <i className="fa-solid fa-check-circle text-4xl text-green-500 mb-3"></i>
                                <p className="font-bold text-white mb-1">No pending reports!</p>
                                <p className="text-sm">All reports have been reviewed. Great job! 🎉</p>
                            </div>
                        )}
                    </div>
                )}
             </div>
        )}

        {/* === SUPPORT TICKETS TAB === */}
        {activeTab === 'support' && (
            <SupportTicketsPanel currentUser={currentUser} isAdmin={true} />
        )}

        {/* === CONTENT LIBRARY TAB === */}
        {activeTab === 'content' && (
            <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out]">
                 <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Video Library ({videos.length})</h3>
                    <div className="flex gap-2">
                        <button 
                            onClick={loadStats}
                            className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white transition-colors"
                        >
                            <i className="fa-solid fa-rotate mr-1"></i>Refresh
                        </button>
                    </div>
                </div>
                
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 text-xs text-gray-400 uppercase tracking-wider border-b border-white/5 sticky top-0">
                                <th className="p-4 font-medium">Video</th>
                                <th className="p-4 font-medium">Category</th>
                                <th className="p-4 font-medium">Stats</th>
                                <th className="p-4 font-medium">ID</th>
                                <th className="p-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm text-gray-300">
                            {videos.map(video => (
                                <tr key={video.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-800 relative">
                                                <img src={video.image} alt={video.name} className="w-full h-full object-cover" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white max-w-[200px] truncate">{video.name}</p>
                                                <p className="text-[10px] text-gray-500">{video.duration}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="bg-white/5 border border-white/10 px-2 py-1 rounded text-xs">
                                            {video.category || 'General'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col text-xs text-gray-500">
                                            <span><i className="fa-solid fa-heart mr-1"></i> {video.likes}</span>
                                            <span><i className="fa-solid fa-eye mr-1"></i> {video.views}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="font-mono text-[10px] text-gray-600">{video.id.slice(0, 8)}...</span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button 
                                            onClick={() => handleDeleteVideoAdmin(video.id)}
                                            className="text-gray-500 hover:text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-all"
                                            title="Delete Video"
                                        >
                                            <i className="fa-regular fa-trash-can"></i>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {videos.length === 0 && (
                        <div className="p-12 text-center text-gray-500">
                            <i className="fa-solid fa-video-slash text-4xl mb-3"></i>
                            <p>No videos found in the database.</p>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* === SETTINGS TAB === */}
        {activeTab === 'settings' && (
            <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-8 animate-[fadeIn_0.2s_ease-out]">
                <h3 className="text-xl font-bold text-white mb-6">Platform Configuration</h3>
                
                <div className="space-y-6">
                    {/* Setting Item */}
                    <div className="flex items-center justify-between pb-6 border-b border-white/5">
                        <div>
                            <h4 className="text-white font-bold">Maintenance Mode</h4>
                            <p className="text-xs text-gray-500 mt-1">Disables access to the platform for all non-admin users.</p>
                        </div>
                        <button 
                            onClick={() => toggleSetting('maintenanceMode')}
                            className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.maintenanceMode ? 'bg-accent' : 'bg-gray-700'}`}
                        >
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.maintenanceMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </button>
                    </div>

                    {/* Setting Item */}
                    <div className="flex items-center justify-between pb-6 border-b border-white/5">
                        <div>
                            <h4 className="text-white font-bold">Allow Signups</h4>
                            <p className="text-xs text-gray-500 mt-1">If disabled, new users cannot register accounts.</p>
                        </div>
                        <button 
                            onClick={() => toggleSetting('allowSignups')}
                            className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.allowSignups ? 'bg-accent' : 'bg-gray-700'}`}
                        >
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.allowSignups ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </button>
                    </div>

                    {/* Setting Item */}
                    <div className="flex items-center justify-between pb-6 border-b border-white/5">
                        <div>
                            <h4 className="text-white font-bold">Strict NSFW Filtering</h4>
                            <p className="text-xs text-gray-500 mt-1">Automatically flag uploaded content with NSFW detection AI.</p>
                        </div>
                        <button 
                            onClick={() => toggleSetting('filterNSFW')}
                            className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.filterNSFW ? 'bg-accent' : 'bg-gray-700'}`}
                        >
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.filterNSFW ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </button>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button className="bg-white text-black font-bold py-2 px-6 rounded-lg hover:bg-gray-200 transition-colors">
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* === LOGS TAB === */}
        {activeTab === 'logs' && (
            <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden animate-[fadeIn_0.2s_ease-out]">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-white">Security Audit Logs</h3>
                        <p className="text-xs text-gray-500">Track administrative actions and system events.</p>
                    </div>
                    <button 
                        onClick={loadAuditLogs}
                        className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white transition-colors"
                    >
                        <i className="fa-solid fa-rotate mr-1"></i>Refresh
                    </button>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
                    </div>
                ) : (
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 text-xs text-gray-400 uppercase sticky top-0">
                                <tr>
                                    <th className="p-4">Action</th>
                                    <th className="p-4">User</th>
                                    <th className="p-4">Target</th>
                                    <th className="p-4">IP Address</th>
                                    <th className="p-4 text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-sm font-mono text-gray-300">
                                {auditLogs.length > 0 ? (
                                    auditLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-white/5">
                                            <td className="p-4">
                                                <span className="text-accent font-bold">{log.action.replace(/_/g, ' ')}</span>
                                            </td>
                                            <td className="p-4 text-white">{log.user}</td>
                                            <td className="p-4 text-gray-500">{log.targetUser || '-'}</td>
                                            <td className="p-4 text-gray-500">{log.ip || 'Unknown'}</td>
                                            <td className="p-4 text-right text-gray-500">{formatTimestamp(log.timestamp)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-gray-500">
                                            <i className="fa-solid fa-file-circle-question text-4xl mb-3"></i>
                                            <p>No audit logs found</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )}

      </div>
    </div>
  );
};

export default AdminPanel;