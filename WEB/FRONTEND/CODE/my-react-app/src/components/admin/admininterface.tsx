import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Shield,
  Database,
  Users,
  User,
  Archive,
  ArchiveRestore,
  Activity,
  Trash2,
  ExternalLink,
  RefreshCw,
  Lock,
  Unlock,
  Share2,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  LogOut,
  Sun,
  Moon,
  ArrowRight,
  Maximize2,
  Minimize2,
  Gauge
} from 'lucide-react';

interface User {
  id: number;
  username: string;
  email: string;
  bio: string | null;
  avatar_path: string | null;
  is_admin: boolean;
  confirmed: boolean;
  suspended: boolean;
  created_at: string;
  updated_at: string;
  repository: Repository[];
  issue: any[];
  pull_request: any[];
}

interface Repository {
  id: number;
  name: string;
  owner_user_id: number;
  description: string | null;
  is_private: boolean;
  repoPath: string;
  parent_id: number | null;
  forked_at: string | null;
  created_at: string;
  updated_at: string;
  archived: boolean;
  forks_count: number;
  pull_requests_count: number;
  owner?: {
    username: string;
  };
}

interface AdminStats {
  totalUsers: number;
  totalRepos: number;
  activeUsers: number;
  suspendedUsers: number;
  privateRepos: number;
  publicRepos: number;
  archivedRepos: number;
}

interface Particle {
  size: number;
  x: number;
  y: number;
  speedX: number;
  speedY: number;
}

interface TransferModalProps {
  show: boolean;
  onClose: () => void;
  repository: Repository | null;
  users: User[];
  onTransfer: (repoId: number, newOwnerEmail: string) => void;
  darkMode: boolean;
}

const TransferModal: React.FC<TransferModalProps> = ({ show, onClose, repository, users, onTransfer, darkMode }) => {
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  if (!show || !repository) return null;

  const filteredUsers = users.filter(user =>
    user.id !== repository.owner_user_id &&
    !user.suspended &&
    (user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className={`bg-${darkMode ? 'gray-900' : 'white'} border border-${darkMode ? 'gray-800' : 'gray-200'} rounded-lg shadow-xl p-6 w-full max-w-md`}>
        <h3 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4 flex items-center`}>
          <Share2 className="mr-2 text-violet-400" size={20} />
          Transfer Repository Ownership
        </h3>
        <div className="mb-6">
          <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
            Transfer <span className="font-semibold text-violet-400">{repository.name}</span> to:
          </p>
          <input
            type="text"
            placeholder="Search users..."
            className={`w-full bg-${darkMode ? 'gray-800' : 'gray-100'} border border-${darkMode ? 'gray-700' : 'gray-300'} rounded-md py-2 px-3 ${darkMode ? 'text-white' : 'text-gray-900'} focus:outline-none focus:ring-2 focus:ring-violet-500 mb-2`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="max-h-60 overflow-y-auto">
            {filteredUsers.map(user => (
              <div
                key={user.id}
                onClick={() => setSelectedUserEmail(user.email)}
                className={`p-2 hover:bg-${darkMode ? 'gray-700' : 'gray-200'} cursor-pointer rounded-md ${selectedUserEmail === user.email ? 'bg-violet-600/20' : ''
                  }`}
              >
                {user.username} ({user.email})
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className={`px-4 py-2 bg-${darkMode ? 'gray-800' : 'gray-200'} hover:bg-${darkMode ? 'gray-700' : 'gray-300'} transition-colors rounded-md ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selectedUserEmail) {
                onTransfer(repository.id, selectedUserEmail);
                onClose();
              }
            }}
            disabled={!selectedUserEmail}
            className={`px-4 py-2 rounded-md flex items-center ${selectedUserEmail
                ? 'bg-violet-600 hover:bg-violet-700 text-white'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              } transition-colors`}
          >
            <ArrowRight size={16} className="mr-1" />
            Transfer
          </button>
        </div>
      </div>
    </div>
  );
};

interface NotificationModalProps {
  show: boolean;
  message: string;
  type: 'success' | 'error';
  darkMode: boolean;
}

const NotificationModal: React.FC<NotificationModalProps> = ({ show, message, type, darkMode }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none">
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in"></div>
      
      {/* Modal */}
      <div className={`relative transform transition-all duration-500 ${show ? 'animate-scale-in' : 'animate-scale-out'}`}>
        <div className={`
          bg-gradient-to-br ${type === 'success' 
            ? darkMode 
              ? 'from-emerald-900/90 via-emerald-800/90 to-green-900/90' 
              : 'from-emerald-100/95 via-green-50/95 to-emerald-100/95'
            : darkMode
              ? 'from-red-900/90 via-red-800/90 to-pink-900/90'
              : 'from-red-100/95 via-pink-50/95 to-red-100/95'
          }
          border ${type === 'success'
            ? 'border-emerald-400/30'
            : 'border-red-400/30'
          }
          rounded-2xl shadow-2xl backdrop-blur-md
          min-w-[400px] max-w-md mx-4
          overflow-hidden
        `}>
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className={`absolute inset-0 bg-gradient-to-r ${type === 'success' ? 'from-emerald-400 to-green-400' : 'from-red-400 to-pink-400'} animate-pulse`}></div>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer"></div>
          </div>

          {/* Content */}
          <div className="relative p-8 text-center">
            {/* Icon with animation */}
            <div className={`
              mx-auto mb-6 w-16 h-16 rounded-full 
              bg-gradient-to-br ${type === 'success'
                ? 'from-emerald-400 to-green-500'
                : 'from-red-400 to-pink-500'
              }
              flex items-center justify-center
              animate-bounce-gentle shadow-lg
            `}>
              {type === 'success' ? (
                <CheckCircle size={32} className="text-white animate-check-mark" />
              ) : (
                <AlertCircle size={32} className="text-white" />
              )}
            </div>

            {/* Success title */}
            <h3 className={`
              text-2xl font-bold mb-3
              ${type === 'success'
                ? darkMode ? 'text-emerald-300' : 'text-emerald-700'
                : darkMode ? 'text-red-300' : 'text-red-700'
              }
            `}>
              {type === 'success' ? 'Success!' : 'Error!'}
            </h3>

            {/* Message */}
            <p className={`
              text-lg leading-relaxed
              ${darkMode ? 'text-gray-200' : 'text-gray-700'}
            `}>
              {message}
            </p>

            {/* Animated progress bar */}
            <div className="mt-6 w-full bg-gray-200/30 rounded-full h-1 overflow-hidden">
              <div className={`
                h-full bg-gradient-to-r ${type === 'success'
                  ? 'from-emerald-400 to-green-500'
                  : 'from-red-400 to-pink-500'
                }
                animate-progress-bar
              `}></div>
            </div>
          </div>

          {/* Floating particles effect */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`
                  absolute w-2 h-2 rounded-full
                  bg-gradient-to-r ${type === 'success'
                    ? 'from-emerald-400 to-green-400'
                    : 'from-red-400 to-pink-400'
                  }
                  animate-float-${i % 3 + 1}
                `}
                style={{
                  left: `${20 + (i * 15)}%`,
                  top: `${30 + (i * 10)}%`,
                  animationDelay: `${i * 0.2}s`
                }}
              ></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

interface AdminInterfaceProps {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

const AdminInterface = ({ darkMode, setDarkMode }: AdminInterfaceProps) => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [userSortBy, setUserSortBy] = useState<string>('username');
  const [userSortDir, setUserSortDir] = useState<'asc' | 'desc'>('asc');
  const [repoSortBy, setRepoSortBy] = useState<string>('name');
  const [repoSortDir, setRepoSortDir] = useState<'asc' | 'desc'>('asc');
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [actionInProgress, setActionInProgress] = useState<{ id: number; type: string } | null>(null);
  const [actionSuccess, setActionSuccess] = useState<{ message: string; timestamp: number } | null>(null);
  const [actionError, setActionError] = useState<{ message: string; timestamp: number } | null>(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'success' | 'error'>('success');
  const [fullscreen, setFullscreen] = useState(false);
  const [isFrameLoading, setIsFrameLoading] = useState(true);
  const [isResourceFrameLoading, setIsResourceFrameLoading] = useState(true);
  const [resourceFullscreen, setResourceFullscreen] = useState(false);

  const [particles, setParticles] = useState<Particle[]>(Array(15).fill(null).map(() => ({
    size: Math.random() * 4 + 1,
    x: Math.random() * 100,
    y: Math.random() * 100,
    speedX: (Math.random() - 0.5) * 0.3,
    speedY: (Math.random() - 0.5) * 0.3
  })));

  // Stats calculation
  const calculateStats = (): AdminStats => {
    return {
      totalUsers: users.length,
      totalRepos: repositories.length,
      activeUsers: users.filter(user => !user.suspended).length,
      suspendedUsers: users.filter(user => user.suspended).length,
      privateRepos: repositories.filter(repo => repo.is_private).length,
      publicRepos: repositories.filter(repo => !repo.is_private).length,
      archivedRepos: repositories.filter(repo => repo.archived).length
    };
  };

  const stats = calculateStats();

  // Fetch data functions
  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        navigate('/');
        return;
      }

      const response = await fetch('http://localhost:5000/v1/api/users?relations=pull_requests,issues,repositories', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch users');

      const result = await response.json();
      setUsers(result.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      setActionError({ message: 'Failed to fetch users', timestamp: Date.now() });
    }
  };

  const fetchRepositories = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        navigate('/');
        return;
      }

      const response = await fetch('http://localhost:5000/v1/api/repositories/archived/all', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch repositories');

      const result = await response.json();
      setRepositories(result.data);
    } catch (error) {
      console.error('Error fetching repositories:', error);
      setActionError({ message: 'Failed to fetch repositories', timestamp: Date.now() });
    }
  };

  // Initialize data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchUsers(), fetchRepositories()]);
      setIsLoading(false);
    };

    loadData();
  }, []);

  // Particle animation
  useEffect(() => {
    const interval = setInterval(() => {
      setParticles(particles =>
        particles.map(particle => ({
          ...particle,
          x: ((particle.x + particle.speedX + 100) % 100),
          y: ((particle.y + particle.speedY + 100) % 100)
        }))
      );
    }, 50);

    return () => clearInterval(interval);
  }, []);

  // Helper function to show notification modal
  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotificationModal(true);
    
    // Auto-hide after 2 seconds
    setTimeout(() => {
      setShowNotificationModal(false);
    }, 2000);
  };

  // User actions
  const handleSuspendUser = async (userId: number, suspend: boolean) => {
    try {
      setActionInProgress({ id: userId, type: suspend ? 'suspend' : 'unsuspend' });

      const token = localStorage.getItem('authToken');
      if (!token) {
        navigate('/');
        return;
      }

      const response = await fetch(`http://localhost:5000/v1/api/users/${userId}/suspend`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ suspend })
      });

      const result = await response.json();

      if (result.status === 'success') {
        setUsers(prevUsers =>
          prevUsers.map(user =>
            user.id === userId ? { ...user, suspended: suspend } : user
          )
        );
        showNotification(`User ${suspend ? 'suspended' : 'unsuspended'} successfully`, 'success');
      } else {
        showNotification(result.message, 'error');
      }
    } catch (error) {
      console.error(`Error ${suspend ? 'suspending' : 'unsuspending'} user:`, error);
      showNotification(`Failed to ${suspend ? 'suspend' : 'unsuspend'} user`, 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      setActionInProgress({ id: userId, type: 'delete-user' });

      const token = localStorage.getItem('authToken');
      if (!token) {
        navigate('/');
        return;
      }

      const response = await fetch(`http://localhost:5000/v1/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete user');

      setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
      showNotification('User deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting user:', error);
      showNotification('Failed to delete user', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  // Repository actions
  const handleArchiveRepository = async (repoId: number, archive: boolean) => {
    try {
      setActionInProgress({ id: repoId, type: archive ? 'archive' : 'restore' });

      const token = localStorage.getItem('authToken');
      if (!token) {
        navigate('/');
        return;
      }

      const endpoint = archive ?
        `http://localhost:5000/v1/api/repositories/${repoId}/archive` :
        `http://localhost:5000/v1/api/repositories/${repoId}/restore`;

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.status === 'success') {
        setRepositories(prevRepos =>
          prevRepos.map(repo =>
            repo.id === repoId ? { ...repo, archived: archive } : repo
          )
        );
        showNotification(`Repository ${archive ? 'archived' : 'restored'} successfully`, 'success');
      } else {
        showNotification(result.message, 'error');
      }
    } catch (error) {
      console.error(`Error ${archive ? 'archiving' : 'restoring'} repository:`, error);
      showNotification(`Failed to ${archive ? 'archive' : 'restore'} repository`, 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeleteRepository = async (repoId: number) => {
    if (!window.confirm('Are you sure you want to delete this repository? This action cannot be undone.')) {
      return;
    }

    try {
      setActionInProgress({ id: repoId, type: 'delete-repo' });

      const token = localStorage.getItem('authToken');
      if (!token) {
        navigate('/');
        return;
      }

      const response = await fetch(`http://localhost:5000/v1/api/admin/repositories/${repoId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete repository');

      setRepositories(prevRepos => prevRepos.filter(repo => repo.id !== repoId));
      showNotification('Repository deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting repository:', error);
      showNotification('Failed to delete repository', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleTransferRepository = async (repoId: number, newOwnerEmail: string) => {
    try {
      setActionInProgress({ id: repoId, type: 'transfer' });

      const token = localStorage.getItem('authToken');
      if (!token) {
        navigate('/');
        return;
      }

      const response = await fetch(`http://localhost:5000/v1/api/repositories/${repoId}/transfer`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: newOwnerEmail })
      });

      if (!response.ok) throw new Error('Failed to transfer repository');

      // Optionally update owner_user_id if you want to reflect the change in UI
      setRepositories(prevRepos =>
        prevRepos.map(repo =>
          repo.id === repoId
            ? {
              ...repo,
              owner_user_id: users.find(u => u.email === newOwnerEmail)?.id || repo.owner_user_id
            }
            : repo
        )
      );

      showNotification('Repository transferred successfully', 'success');
    } catch (error) {
      console.error('Error transferring repository:', error);
      showNotification('Failed to transfer repository ownership', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  // UI Helper functions
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const sortUsers = (users: User[]) => {
    return [...users].sort((a, b) => {
      let comparison = 0;

      switch (userSortBy) {
        case 'username':
          comparison = a.username.localeCompare(b.username);
          break;
        case 'email':
          comparison = a.email.localeCompare(b.email);
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'repos':
          comparison = (a.repository?.length || 0) - (b.repository?.length || 0);
          break;
        default:
          comparison = a.username.localeCompare(b.username);
      }

      return userSortDir === 'asc' ? comparison : -comparison;
    });
  };

  const sortRepositories = (repositories: Repository[]) => {
    return [...repositories].sort((a, b) => {
      let comparison = 0;

      switch (repoSortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'owner':
          const ownerA = users.find(user => user.id === a.owner_user_id)?.username || '';
          const ownerB = users.find(user => user.id === b.owner_user_id)?.username || '';
          comparison = ownerA.localeCompare(ownerB);
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'forks':
          comparison = a.forks_count - b.forks_count;
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }

      return repoSortDir === 'asc' ? comparison : -comparison;
    });
  };

  const filteredUsers = sortUsers(users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  ));

  const filteredRepositories = sortRepositories(repositories.filter(repo =>
    repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    repo.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    users.find(user => user.id === repo.owner_user_id)?.username.toLowerCase().includes(searchTerm.toLowerCase())
  ));

  const toggleSort = (field: string, isUserTab: boolean) => {
    if (isUserTab) {
      if (userSortBy === field) {
        setUserSortDir(userSortDir === 'asc' ? 'desc' : 'asc');
      } else {
        setUserSortBy(field);
        setUserSortDir('asc');
      }
    } else {
      if (repoSortBy === field) {
        setRepoSortDir(repoSortDir === 'asc' ? 'desc' : 'asc');
      } else {
        setRepoSortBy(field);
        setRepoSortDir('asc');
      }
    }
  };

  const openTransferModal = (repo: Repository) => {
    setSelectedRepo(repo);
    setShowTransferModal(true);
  };

  // Render content based on selected tab
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500"></div>
        </div>
      );
    }

    switch (currentTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Users Card */}
              <div className={`bg-${darkMode ? 'gray-800/70' : 'white'} border border-${darkMode ? 'gray-700' : 'gray-200'} rounded-xl shadow-lg p-6 backdrop-blur-sm`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-lg font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Users</h3>
                  <div className="p-2 bg-violet-600/20 rounded-lg">
                    <Users size={20} className="text-violet-400" />
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{stats.totalUsers}</p>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total registered users</p>
                  </div>
                  <div className="flex space-x-2 text-sm">
                    <div className="flex flex-col items-center">
                      <span className="text-green-400">{stats.activeUsers}</span>
                      <span className={`text-${darkMode ? 'gray-500' : 'gray-700'}`}>Active</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-red-400">{stats.suspendedUsers}</span>
                      <span className={`text-${darkMode ? 'gray-500' : 'gray-700'}`}>Suspended</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Repositories Card */}
              <div className={`bg-${darkMode ? 'gray-800/70' : 'white'} border border-${darkMode ? 'gray-700' : 'gray-200'} rounded-xl shadow-lg p-6 backdrop-blur-sm`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-lg font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Repositories</h3>
                  <div className="p-2 bg-cyan-600/20 rounded-lg">
                    <Database size={20} className="text-cyan-400" />
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{stats.totalRepos}</p>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total repositories</p>
                  </div>
                  <div className="flex space-x-2 text-sm">
                    <div className="flex flex-col items-center">
                      <span className="text-blue-400">{stats.publicRepos}</span>
                      <span className={`text-${darkMode ? 'gray-500' : 'gray-700'}`}>Public</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-amber-400">{stats.privateRepos}</span>
                      <span className={`text-${darkMode ? 'gray-500' : 'gray-700'}`}>Private</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className={`text-${darkMode ? 'gray-400' : 'gray-600'}`}>{stats.archivedRepos}</span>
                      <span className={`text-${darkMode ? 'gray-500' : 'gray-700'}`}>Archived</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity Card */}
              <div className={`bg-${darkMode ? 'gray-800/70' : 'white'} border border-${darkMode ? 'gray-700' : 'gray-200'} rounded-xl shadow-lg p-6 backdrop-blur-sm col-span-1 md:col-span-2`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-lg font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Recent Activity</h3>
                  <div className="p-2 bg-emerald-600/20 rounded-lg">
                    <Activity size={20} className="text-emerald-400" />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="p-1.5 bg-violet-600/20 rounded-lg">
                      <Users size={16} className="text-violet-400" />
                    </div>
                    <div>
                      <p className={`text-${darkMode ? 'gray-300' : 'gray-700'}`}>New user registered: <span className="text-violet-400 font-medium">frontproffesionel</span></p>
                      <p className={`text-xs text-${darkMode ? 'gray-500' : 'gray-600'}`}>3 days ago</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="p-1.5 bg-cyan-600/20 rounded-lg">
                      <Database size={16} className="text-cyan-400" />
                    </div>
                    <div>
                      <p className={`text-${darkMode ? 'gray-300' : 'gray-700'}`}>New repository created: <span className="text-cyan-400 font-medium">testrepo</span></p>
                      <p className={`text-xs text-${darkMode ? 'gray-500' : 'gray-600'}`}>Today</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="p-1.5 bg-amber-600/20 rounded-lg">
                      <Archive size={16} className="text-amber-400" />
                    </div>
                    <div>
                      <p className={`text-${darkMode ? 'gray-300' : 'gray-700'}`}>Repository archived: <span className="text-amber-400 font-medium">testrepoemail</span></p>
                      <p className={`text-xs text-${darkMode ? 'gray-500' : 'gray-600'}`}>Today</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className={`bg-${darkMode ? 'gray-800/70' : 'white'} border border-${darkMode ? 'gray-700' : 'gray-200'} rounded-xl shadow-lg p-6 backdrop-blur-sm`}>
              <h3 className={`text-lg font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'} mb-4`}>Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  onClick={() => setCurrentTab('users')}
                  className={`flex flex-col items-center justify-center p-6 bg-${darkMode ? 'gray-700/50' : 'gray-100'} hover:bg-${darkMode ? 'violet-600/20' : 'violet-200'} border border-${darkMode ? 'gray-600' : 'gray-300'} hover:border-${darkMode ? 'violet-500/50' : 'violet-300'} rounded-xl transition-all duration-300`}
                >
                  <Users size={24} className="text-violet-400 mb-2" />
                  <span className={`text-${darkMode ? 'gray-300' : 'gray-700'}`}>Manage Users</span>
                </button>
                <button
                  onClick={() => setCurrentTab('repositories')}
                  className={`flex flex-col items-center justify-center p-6 bg-${darkMode ? 'gray-700/50' : 'gray-100'} hover:bg-${darkMode ? 'cyan-600/20' : 'cyan-200'} border border-${darkMode ? 'gray-600' : 'gray-300'} hover:border-${darkMode ? 'cyan-500/50' : 'cyan-300'} rounded-xl transition-all duration-300`}
                >
                  <Database size={24} className="text-cyan-400 mb-2" />
                  <span className={`text-${darkMode ? 'gray-300' : 'gray-700'}`}>Manage Repositories</span>
                </button>
                <button
                  onClick={() => setCurrentTab('systemlogs')}
                  className={`flex flex-col items-center justify-center p-6 bg-${darkMode ? 'gray-700/50' : 'gray-100'} hover:bg-${darkMode ? 'emerald-600/20' : 'emerald-200'} border border-${darkMode ? 'gray-600' : 'gray-300'} hover:border-${darkMode ? 'emerald-500/50' : 'emerald-300'} rounded-xl transition-all duration-300`}>
                  <Activity size={24} className="text-emerald-400 mb-2" />
                  <span className={`text-${darkMode ? 'gray-300' : 'gray-700'}`}>System Logs</span>
                </button>
                <button
                  onClick={() => setCurrentTab('resources')}
                  className={`flex flex-col items-center justify-center p-6 bg-${darkMode ? 'gray-700/50' : 'gray-100'} hover:bg-${darkMode ? 'cyan-600/20' : 'cyan-200'} border border-${darkMode ? 'gray-600' : 'gray-300'} hover:border-${darkMode ? 'cyan-500/50' : 'cyan-300'} rounded-xl transition-all duration-300`}
                >
                  <Gauge size={24} className="text-cyan-400 mb-2" />
                  <span className={`text-${darkMode ? 'gray-300' : 'gray-700'}`}>Resource Monitoring</span>
                </button>
              </div>
            </div>
          </div>
        );

      case 'users':
        return (
          <div className={`bg-${darkMode ? 'gray-800/70' : 'white'} border border-${darkMode ? 'gray-700' : 'gray-200'} rounded-xl shadow-lg backdrop-blur-sm`}>
            <div className={`p-6 border-b border-${darkMode ? 'gray-700' : 'gray-200'}`}>
              <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-2`}>User Management</h2>
              <p className={`text-${darkMode ? 'gray-400' : 'gray-600'}`}>Manage user accounts, permissions, and access.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`bg-${darkMode ? 'gray-800/90' : 'gray-100'}`}>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider cursor-pointer hover:text-violet-400`}
                      onClick={() => toggleSort('username', true)}>
                      <div className="flex items-center">
                        Username
                        {userSortBy === 'username' && (
                          userSortDir === 'asc' ? <ChevronUp size={16} className="ml-1" /> : <ChevronDown size={16} className="ml-1" />
                        )}
                      </div>
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider cursor-pointer hover:text-violet-400`}
                      onClick={() => toggleSort('email', true)}>
                      <div className="flex items-center">
                        Email
                        {userSortBy === 'email' && (
                          userSortDir === 'asc' ? <ChevronUp size={16} className="ml-1" /> : <ChevronDown size={16} className="ml-1" />
                        )}
                      </div>
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider cursor-pointer hover:text-violet-400`}
                      onClick={() => toggleSort('created_at', true)}>
                      <div className="flex items-center">
                        Joined
                        {userSortBy === 'created_at' && (
                          userSortDir === 'asc' ? <ChevronUp size={16} className="ml-1" /> : <ChevronDown size={16} className="ml-1" />
                        )}
                      </div>
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider`}>
                      Status
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider cursor-pointer hover:text-violet-400`}
                      onClick={() => toggleSort('repos', true)}>
                      <div className="flex items-center">
                        Repos
                        {userSortBy === 'repos' && (
                          userSortDir === 'asc' ? <ChevronUp size={16} className="ml-1" /> : <ChevronDown size={16} className="ml-1" />
                        )}
                      </div>
                    </th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider`}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y divide-${darkMode ? 'gray-700/50' : 'gray-200'}`}>
                  {filteredUsers.map(user => (
                    <tr key={user.id} className={`hover:bg-${darkMode ? 'gray-800/40' : 'gray-100'} transition-colors`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                            {user.avatar_path ? (
                              <img
                                src={`http://localhost:5000${user.avatar_path}`}
                                alt={user.username}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <User size={16} className="text-gray-400" />
                            )}
                          </div>
                          <div className="ml-4">
                            <div className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>{user.username}</div>
                            {user.is_admin && (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-violet-600/20 text-violet-400">
                                Admin
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{user.email}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.suspended
                            ? 'bg-red-600/20 text-red-400'
                            : 'bg-emerald-600/20 text-emerald-400'
                          }`}>
                          {user.suspended ? 'Suspended' : 'Active'}
                        </span>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {user.repository?.length || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleSuspendUser(user.id, !user.suspended)}
                          disabled={actionInProgress?.id === user.id}
                          className={`px-3 py-1 rounded-md flex items-center ${user.suspended
                              ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'
                              : 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                            } transition-colors`}
                        >
                          {actionInProgress?.id === user.id && actionInProgress.type === (user.suspended ? 'unsuspend' : 'suspend') ? (
                            <RefreshCw size={14} className="animate-spin mr-1" />
                          ) : user.suspended ? (
                            <>
                              <Unlock size={14} className="mr-1" />
                              Unsuspend
                            </>
                          ) : (
                            <>
                              <Lock size={14} className="mr-1" />
                              Suspend
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={actionInProgress?.id === user.id}
                          className={`px-3 py-1 rounded-md bg-${darkMode ? 'gray-700/50' : 'gray-200'} hover:bg-${darkMode ? 'gray-700' : 'gray-300'} ${darkMode ? 'text-gray-400' : 'text-gray-600'} hover:text-red-400 transition-colors`}
                        >
                          {actionInProgress?.id === user.id && actionInProgress.type === 'delete-user' ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <div className={`p-8 text-center ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                  <AlertCircle className="mx-auto mb-2" size={20} />
                  No users found matching your criteria
                </div>
              )}
            </div>
          </div>
        );

      case 'repositories':
        return (
          <div className={`bg-${darkMode ? 'gray-800/70' : 'white'} border border-${darkMode ? 'gray-700' : 'gray-200'} rounded-xl shadow-lg backdrop-blur-sm`}>
            <div className={`p-6 border-b border-${darkMode ? 'gray-700' : 'gray-200'}`}>
              <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-2`}>Repository Management</h2>
              <p className={`text-${darkMode ? 'gray-400' : 'gray-600'}`}>Manage all repositories, including archiving and ownership transfers.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`bg-${darkMode ? 'gray-800/90' : 'gray-100'}`}>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider cursor-pointer hover:text-violet-400`}
                      onClick={() => toggleSort('name', false)}>
                      <div className="flex items-center">
                        Name
                        {repoSortBy === 'name' && (
                          repoSortDir === 'asc' ? <ChevronUp size={16} className="ml-1" /> : <ChevronDown size={16} className="ml-1" />
                        )}
                      </div>
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider cursor-pointer hover:text-violet-400`}
                      onClick={() => toggleSort('owner', false)}>
                      <div className="flex items-center">
                        Owner
                        {repoSortBy === 'owner' && (
                          repoSortDir === 'asc' ? <ChevronUp size={16} className="ml-1" /> : <ChevronDown size={16} className="ml-1" />
                        )}
                      </div>
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider`}>
                      Visibility
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider`}>
                      Status
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider cursor-pointer hover:text-violet-400`}
                      onClick={() => toggleSort('created_at', false)}>
                      <div className="flex items-center">
                        Created
                        {repoSortBy === 'created_at' && (
                          repoSortDir === 'asc' ? <ChevronUp size={16} className="ml-1" /> : <ChevronDown size={16} className="ml-1" />
                        )}
                      </div>
                    </th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'} uppercase tracking-wider`}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y divide-${darkMode ? 'gray-700/50' : 'gray-200'}`}>
                  {filteredRepositories.map(repo => {
                    const owner = users.find(u => u.id === repo.owner_user_id);
                    return (
                      <tr key={repo.id} className={`hover:bg-${darkMode ? 'gray-800/40' : 'gray-100'} transition-colors`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                              {repo.name}
                              {repo.archived && <Archive className="ml-2 inline-block text-amber-400" size={14} />}
                            </div>
                          </div>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {owner?.username || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {repo.is_private ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-600/20 text-amber-400">
                              Private
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-600/20 text-blue-400">
                              Public
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${repo.archived
                              ? 'bg-amber-600/20 text-amber-400'
                              : 'bg-emerald-600/20 text-emerald-400'
                            }`}>
                            {repo.archived ? 'Archived' : 'Active'}
                          </span>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {formatDate(repo.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleArchiveRepository(repo.id, !repo.archived)}
                            disabled={actionInProgress?.id === repo.id}
                            className={`px-3 py-1 rounded-md flex items-center ${repo.archived
                                ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'
                                : 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/30'
                              } transition-colors`}
                          >
                            {actionInProgress?.id === repo.id && actionInProgress.type === (repo.archived ? 'restore' : 'archive') ? (
                              <RefreshCw size={14} className="animate-spin mr-1" />
                            ) : repo.archived ? (
                              <>
                                <ArchiveRestore size={14} className="mr-1" />
                                Restore
                              </>
                            ) : (
                              <>
                                <Archive size={14} className="mr-1" />
                                Archive
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => openTransferModal(repo)}
                            className={`px-3 py-1 rounded-md bg-${darkMode ? 'gray-700/50' : 'gray-200'} hover:bg-${darkMode ? 'gray-700' : 'gray-300'} ${darkMode ? 'text-gray-400' : 'text-gray-600'} hover:text-violet-400 transition-colors`}
                          >
                            <Share2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteRepository(repo.id)}
                            disabled={actionInProgress?.id === repo.id}
                            className={`px-3 py-1 rounded-md bg-${darkMode ? 'gray-700/50' : 'gray-200'} hover:bg-${darkMode ? 'gray-700' : 'gray-300'} ${darkMode ? 'text-gray-400' : 'text-gray-600'} hover:text-red-400 transition-colors`}
                          >
                            {actionInProgress?.id === repo.id && actionInProgress.type === 'delete-repo' ? (
                              <RefreshCw size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </td>
                      </tr>
                    )
                  }
                  )}
                </tbody>
              </table>
              {filteredRepositories.length === 0 && (
                <div className={`p-8 text-center ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                  <AlertCircle className="mx-auto mb-2" size={20} />
                  No repositories found matching your criteria
                </div>
              )}
            </div>
          </div>
        );

      case 'systemlogs':
        return (
          <div className={`bg-${darkMode ? 'gray-800/70' : 'white'} border border-${darkMode ? 'gray-700' : 'gray-200'} rounded-xl shadow-lg backdrop-blur-sm overflow-hidden transition-all duration-300 ${fullscreen ? 'fixed inset-0 z-50' : 'relative'
            }`}>
            <div className={`p-6 border-b border-${darkMode ? 'gray-700' : 'gray-200'} flex justify-between items-center`}>
              <div>
                <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-2 flex items-center`}>
                  <Activity className="mr-2 text-violet-400" size={24} />
                  System Logs & Traces
                </h2>
                <p className={`text-${darkMode ? 'gray-400' : 'gray-600'}`}>
                  Monitor system performance and trace requests across services
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => window.open('http://localhost:16686', '_blank')}
                  className={`px-4 py-2 rounded-md bg-violet-600/20 text-violet-400 hover:bg-violet-600/30 transition-colors flex items-center`}
                >
                  <ExternalLink size={16} className="mr-2" />
                  Open in New Window
                </button>
                <button
                  onClick={() => setFullscreen(!fullscreen)}
                  className={`p-2 rounded-md bg-${darkMode ? 'gray-700/50' : 'gray-200'} hover:bg-${darkMode ? 'gray-700' : 'gray-300'} transition-colors`}
                >
                  {fullscreen ? (
                    <Minimize2 size={16} className="text-gray-400" />
                  ) : (
                    <Maximize2 size={16} className="text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className={`relative ${fullscreen ? 'h-[calc(100vh-80px)]' : 'h-[calc(100vh-280px)]'}`}>
              <div className="absolute inset-0">
                <iframe
                  src="http://localhost:16686"
                  className="w-full h-full"
                  title="Jaeger UI"
                />
              </div>

              {/* Fancy loading overlay */}
              <div className={`absolute inset-0 bg-${darkMode ? 'gray-900/90' : 'white/90'} flex items-center justify-center transition-opacity duration-500 ${isFrameLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-violet-400/20 border-t-violet-400 rounded-full animate-spin" />
                  <div className="mt-4 text-center text-violet-400">Loading Traces</div>
                  <div className="absolute -inset-4 bg-violet-400/10 rounded-full blur-xl animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        );

      case 'resources':
        return (
          <div className={`bg-${darkMode ? 'gray-800/70' : 'white'} border border-${darkMode ? 'gray-700' : 'gray-200'} rounded-xl shadow-lg backdrop-blur-sm overflow-hidden transition-all duration-300 ${resourceFullscreen ? 'fixed inset-0 z-50' : 'relative'
            }`}>
            <div className={`p-6 border-b border-${darkMode ? 'gray-700' : 'gray-200'} flex justify-between items-center`}>
              <div>
                <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} mb-2 flex items-center`}>
                  <Gauge className="mr-2 text-cyan-400" size={24} />
                  Resource Monitoring
                </h2>
                <p className={`text-${darkMode ? 'gray-400' : 'gray-600'}`}>
                  Real-time system resource usage and performance metrics
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => window.open('http://localhost:3000/dashboards', '_blank')}
                  className={`px-4 py-2 rounded-md bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 transition-colors flex items-center`}
                >
                  <ExternalLink size={16} className="mr-2" />
                  Open in Grafana
                </button>
                <button
                  onClick={() => setResourceFullscreen(!resourceFullscreen)}
                  className={`p-2 rounded-md bg-${darkMode ? 'gray-700/50' : 'gray-200'} hover:bg-${darkMode ? 'gray-700' : 'gray-300'} transition-colors`}
                >
                  {resourceFullscreen ? (
                    <Minimize2 size={16} className="text-gray-400" />
                  ) : (
                    <Maximize2 size={16} className="text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className={`relative ${resourceFullscreen ? 'h-[calc(100vh-80px)]' : 'h-[calc(100vh-280px)]'}`}>
              <div className="absolute inset-0">
                <iframe
                  src="http://localhost:3000"
                  className="w-full h-full"
                  title="Resource Monitoring"
                />
              </div>

              {/* Loading overlay */}
              <div className={`absolute inset-0 bg-${darkMode ? 'gray-900/90' : 'white/90'} flex items-center justify-center transition-opacity duration-500 ${isResourceFrameLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
                  <div className="mt-4 text-center text-cyan-400">Loading Metrics</div>
                  <div className="absolute -inset-4 bg-cyan-400/10 rounded-full blur-xl animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className={`p-8 text-center ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <AlertCircle className="mx-auto mb-4" size={24} />
            Select a management section from the sidebar
          </div>
        );
    }
  };

  useEffect(() => {
    if (currentTab === 'systemlogs') {
      setIsFrameLoading(true);
      const timer = setTimeout(() => setIsFrameLoading(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [currentTab]);

  useEffect(() => {
    if (currentTab === 'resources') {
      setIsResourceFrameLoading(true);
      const timer = setTimeout(() => setIsResourceFrameLoading(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [currentTab]);

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-white'} ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
      {/* Particles background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle, idx) => (
          <div
            key={idx}
            className="absolute rounded-full bg-violet-500/10"
            style={{
              width: particle.size + 'px',
              height: particle.size + 'px',
              left: particle.x + '%',
              top: particle.y + '%',
              filter: 'blur(1px)'
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Shield className="text-violet-400" size={28} />
            <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Admin Dashboard</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-full hover:bg-${darkMode ? 'gray-800' : 'gray-200'} transition-colors`}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('authToken');
                navigate('/');
              }}
              className={`flex items-center space-x-2 px-4 py-2 bg-${darkMode ? 'red-600/20' : 'red-200'} hover:bg-${darkMode ? 'red-600/30' : 'red-300'} text-${darkMode ? 'red-400' : 'red-600'} rounded-md transition-colors`}
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6">
          {['dashboard', 'users', 'repositories', 'systemlogs', 'resources'].map(tab => (
            <button
              key={tab}
              onClick={() => setCurrentTab(tab)}
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${currentTab === tab
                  ? 'bg-violet-600/20 text-violet-400'
                  : `hover:bg-${darkMode ? 'gray-800/50' : 'gray-200'} text-${darkMode ? 'gray-400' : 'gray-600'}`
                }`}
            >
              {tab === 'dashboard' && <Activity size={16} />}
              {tab === 'users' && <Users size={16} />}
              {tab === 'repositories' && <Database size={16} />}
              {tab === 'systemlogs' && <Activity size={16} />}
              {tab === 'resources' && <Gauge size={16} />}
              <span className="capitalize">
                {tab === 'systemlogs' ? 'System Logs' :
                  tab === 'resources' ? 'Resources' : tab}
              </span>
            </button>
          ))}
        </div>

        {/* Search and stats */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex-1 max-w-lg">
            <div className={`flex items-center bg-${darkMode ? 'gray-800/50' : 'gray-200'} rounded-lg px-4 py-2`}>
              <Search size={18} className={`text-${darkMode ? 'gray-500' : 'gray-600'}`} />
              <input
                type="text"
                placeholder="Search users, repositories..."
                className={`w-full ml-2 bg-transparent focus:outline-none ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Content area */}
        {renderContent()}
      </div>

      {/* Transfer modal */}
      <TransferModal
        show={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        repository={selectedRepo}
        users={users}
        onTransfer={handleTransferRepository}
        darkMode={darkMode}
      />

      {/* Notification Modal */}
      <NotificationModal
        show={showNotificationModal}
        message={notificationMessage}
        type={notificationType}
        darkMode={darkMode}
      />

      {/* Remove the old action notifications section */}
    </div>
  );
};

export default AdminInterface;

// Add these CSS animations to your global CSS or styled-components
const style = document.createElement('style');
style.textContent = `
  @keyframes scale-in {
    0% {
      transform: scale(0.8) translateY(20px);
      opacity: 0;
    }
    100% {
      transform: scale(1) translateY(0);
      opacity: 1;
    }
  }

  @keyframes scale-out {
    0% {
      transform: scale(1) translateY(0);
      opacity: 1;
    }
    100% {
      transform: scale(0.8) translateY(-20px);
      opacity: 0;
    }
  }

  @keyframes fade-in {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }

  @keyframes bounce-gentle {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  @keyframes check-mark {
    0% { transform: scale(0); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }

  @keyframes progress-bar {
    0% { width: 0%; }
    100% { width: 100%; }
  }

  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  @keyframes float-1 {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    33% { transform: translateY(-20px) rotate(120deg); }
    66% { transform: translateY(-10px) rotate(240deg); }
  }

  @keyframes float-2 {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-15px) rotate(180deg); }
  }

  @keyframes float-3 {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    25% { transform: translateY(-25px) rotate(90deg); }
    75% { transform: translateY(-5px) rotate(270deg); }
  }

  .animate-scale-in { animation: scale-in 0.5s ease-out forwards; }
  .animate-scale-out { animation: scale-out 0.3s ease-in forwards; }
  .animate-fade-in { animation: fade-in 0.3s ease-out; }
  .animate-bounce-gentle { animation: bounce-gentle 2s ease-in-out infinite; }
  .animate-check-mark { animation: check-mark 0.6s ease-out; }
  .animate-progress-bar { animation: progress-bar 2s ease-out; }
  .animate-shimmer { animation: shimmer 2s ease-in-out infinite; }
  .animate-float-1 { animation: float-1 3s ease-in-out infinite; }
  .animate-float-2 { animation: float-2 2.5s ease-in-out infinite; }
  .animate-float-3 { animation: float-3 3.5s ease-in-out infinite; }
`;
document.head.appendChild(style);
