import React, { useState, useEffect, useRef } from 'react';
import {Edit, Camera, Save, X, Key, Calendar, FileText, GitFork, AlertCircle, RefreshCw, Shield, Trash2, Sun, Moon, CheckCircle } from 'lucide-react';
import { z } from 'zod';
import { jwtDecode } from 'jwt-decode';
import QRCode from 'react-qr-code';

interface Particle {
    size: number;
    x: number;
    y: number;
    speedX: number;
    speedY: number;
}

interface UserProfile {
    id: number;
    username: string;
    email: string;
    bio: string | null;
    avatar_path: string | null;
    is_admin: boolean;
    created_at: string;
    updated_at: string;
    repositories?: any[];
    issues?: any[];
    pull_requests?: any[];
    twoFactorEnabled: boolean;
}

interface ProfileProps {
    darkMode: boolean;
    setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
}

interface JwtPayload {
    userId: number;
    email: string;
}

export default function ProfileInterface({ darkMode, setDarkMode }: ProfileProps) {
    const [editMode, setEditMode] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [is2FAEnabled, setIs2FAEnabled] = useState(false);
    const [show2FAModal, setShow2FAModal] = useState(false);
    const [qrCodeData, setQrCodeData] = useState('');
    const [twoFAToken, setTwoFAToken] = useState('');
    const [isGeneratingQR, setIsGeneratingQR] = useState(false);
    const [isVerifyingToken, setIsVerifyingToken] = useState(false);
    const [twoFAError, setTwoFAError] = useState('');

    const [user, setUser] = useState<UserProfile | null>(null);
    const [editForm, setEditForm] = useState({
        username: '',
        email: '',
        bio: '',
    });

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<z.ZodIssue[] | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [particles, setParticles] = useState<Particle[]>(Array(15).fill(null).map(() => ({
        size: Math.random() * 4 + 1,
        x: Math.random() * 100,
        y: Math.random() * 100,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3
    })));

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const token = localStorage.getItem('authToken');
                if (!token) {
                    throw new Error('No authentication token found');
                }

                const decoded = jwtDecode<JwtPayload>(token);
                const response = await fetch(`http://localhost:5000/v1/api/users/${decoded.userId}?relations=repositories,issues,pull_requests`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch user data');
                }

                const userData = await response.json();
                setUser({
                    ...userData.data,
                    repositories: userData.data.repository || [],
                    issues: userData.data.issue || [],
                    pull_requests: userData.data.pull_request || [],
                    twoFactorEnabled: userData.data.twoFactorEnabled,
                });
                setEditForm({
                    username: userData.data.username,
                    email: userData.data.email,
                    bio: userData.data.bio || '',
                });
                setIs2FAEnabled(userData.data.twoFactorEnabled);
            } catch (err) {
                console.error('Error fetching user data:', err);
                setError(err instanceof Error ? err.message : 'Failed to load profile');
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, []);

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

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const getTimeElapsed = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return "today";
        if (diffDays === 1) return "yesterday";
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) {
            const diffWeeks = Math.floor(diffDays / 7);
            return `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`;
        }
        if (diffDays < 365) {
            const diffMonths = Math.floor(diffDays / 30);
            return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
        }
        const diffYears = Math.floor(diffDays / 365);
        return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`;
    };

    const handleSaveProfile = async () => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error('No authentication token found');

            const decoded = jwtDecode<JwtPayload>(token);
            const userId = decoded.userId;

            const response = await fetch(`http://localhost:5000/v1/api/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(editForm)
            });

            const responseData = await response.json();

            if (!response.ok) {
                if (response.status === 409) {
                    setValidationErrors(responseData.details || [{
                        message: responseData.message || 'Conflict occurred',
                        path: [],
                        code: 'custom'
                    }]);
                }
                else if (response.status === 400 && responseData.details) {
                    setValidationErrors(responseData.details);
                }
                else {
                    setValidationErrors([{
                        message: responseData.message || 'Failed to update profile',
                        path: [],
                        code: 'custom'
                    }]);
                }
                return;
            }
            setUser(responseData.data);
            setEditMode(false);
            setSuccessMessage('Profile updated successfully!');
            setValidationErrors(null);

            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            console.error('Error saving profile:', err);
            setValidationErrors([{
                message: err instanceof Error ? err.message : 'An unknown error occurred',
                path: [],
                code: 'custom'
            }]);
        }
    };

    const handlePasswordChange = async () => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error('No authentication token found');

            const decoded = jwtDecode<JwtPayload>(token);
            const userId = decoded.userId;

            if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                setValidationErrors([{
                    message: 'New passwords do not match',
                    path: [],
                    code: 'custom'
                }]);
                return;
            }

            const response = await fetch(`http://localhost:5000/v1/api/users/${userId}/change-password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword,
                    confirmNewPassword: passwordForm.confirmPassword
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to change password');
            }

            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setShowPasswordModal(false);
            setSuccessMessage('Password updated successfully!');
            setValidationErrors(null);

            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            console.error('Error changing password:', err);
            setValidationErrors([{
                message: err instanceof Error ? err.message : 'An unknown error occurred',
                path: [],
                code: 'custom'
            }]);
        }
    };

    const handleEnable2FA = async () => {
        try {
            setIsGeneratingQR(true);
            setTwoFAError('');
            const token = localStorage.getItem('authToken');
            const response = await fetch('http://localhost:5000/v1/api/2fa/generate', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to generate QR code');

            setQrCodeData(data.data.otpauthUrl);
            setShow2FAModal(true);
        } catch (err) {
            setTwoFAError(err instanceof Error ? err.message : 'Failed to setup 2FA');
        } finally {
            setIsGeneratingQR(false);
        }
    };

    const handleVerify2FA = async () => {
        try {
            setIsVerifyingToken(true);
            setTwoFAError('');
            const token = localStorage.getItem('authToken');

            const response = await fetch('http://localhost:5000/v1/api/2fa/verify', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token: twoFAToken })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Verification failed');

            setIs2FAEnabled(true);
            setShow2FAModal(false);
            setSuccessMessage('Two-factor authentication enabled successfully!');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setTwoFAError(err instanceof Error ? err.message : 'Verification failed');
        } finally {
            setIsVerifyingToken(false);
        }
    };

    const handleDisable2FA = async () => {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('http://localhost:5000/v1/api/2fa', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to disable 2FA');

            setIs2FAEnabled(false);
            setSuccessMessage('Two-factor authentication disabled successfully!');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setTwoFAError(err instanceof Error ? err.message : 'Failed to disable 2FA');
        }
    };

    const handleCancelEdit = () => {
        if (!user) return;

        setEditForm({
            username: user.username,
            email: user.email,
            bio: user.bio || '',
        });
        setEditMode(false);
    };

    const handleAvatarClick = () => {
        if (editMode && fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('avatar', file);

        try {
            const token = localStorage.getItem('authToken');
            const decoded = jwtDecode<JwtPayload>(token!);
            const response = await fetch(`http://localhost:5000/v1/api/users/${decoded.userId}/avatar`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Failed to upload avatar');

            setUser({ ...user, avatar_path: data.data.avatar_path });
            setSuccessMessage('Avatar updated successfully!');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setValidationErrors([{
                message: err instanceof Error ? err.message : 'Failed to upload avatar',
                path: [],
                code: 'custom'
            }]);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteAccount = async () => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                throw new Error('No authentication token found');
            }

            const decoded = jwtDecode<JwtPayload>(token);
            const userId = decoded.userId;

            const response = await fetch(`http://localhost:5000/v1/api/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete account');
            }

            localStorage.removeItem('authToken');
            window.location.href = '/';
        } catch (err) {
            console.error('Error deleting account:', err);
            setDeleteError(err instanceof Error ? err.message : 'Failed to delete account');
        }
    };

    if (loading) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <div className={`p-6 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} text-red-500`}>
                    Error: {error}
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    const repositoriesCount = user.repositories?.length || 0;
    const issuesCount = user.issues?.length || 0;
    const pullRequestsCount = user.pull_requests?.length || 0;

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <div className="space-y-6">
                        {successMessage && (
                            <div className={`p-4 rounded-lg ${darkMode
                                ? 'bg-green-900/30 border-green-800 text-green-400'
                                : 'bg-green-100 border-green-200 text-green-800'} border`}>
                                <div className="flex items-center">
                                    <CheckCircle className="mr-2" size={20} />
                                    {successMessage}
                                </div>
                            </div>
                        )}

                        {validationErrors && (
                            <div className={`p-4 rounded-lg ${darkMode ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-red-100 border-red-200 text-red-800'} border`}>
                                <div className="flex items-center mb-2">
                                    <AlertCircle className="mr-2" size={20} />
                                    <span className="font-semibold">Update Error:</span>
                                </div>
                                <ul className="list-disc list-inside pl-4">
                                    {validationErrors.map((error, index) => (
                                        <li key={index} className="text-sm">
                                            {error.message}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className={`${darkMode ? 'bg-gray-800/70 border-gray-700' : 'bg-white/90 border-gray-200'} backdrop-blur-sm border rounded-xl p-6`}>
                            <div className="flex flex-col md:flex-row items-start md:items-center">
                                <div className="relative mb-4 md:mb-0">
                                    <div
                                        onClick={handleAvatarClick}
                                        className={`w-24 h-24 rounded-full ${darkMode ? 'bg-violet-600/20 text-violet-400 border-violet-600/30' : 'bg-cyan-50 text-cyan-600 border-cyan-200'} border-2 flex items-center justify-center text-3xl font-medium cursor-pointer`}
                                    >
                                        {user.avatar_path ? (
                                            <img
                                                src={`http://localhost:5000${user.avatar_path}`}
                                                alt={user.username}
                                                className="w-full h-full rounded-full object-cover"
                                            />
                                        ) : (
                                            user.username.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <input
                                        type="file"
                                        hidden
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                        accept="image/*"
                                    />
                                    {editMode && (
                                        <button
                                            onClick={handleAvatarClick}
                                            className={`absolute bottom-0 right-0 p-1.5 rounded-full ${darkMode
                                                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            disabled={isUploading}
                                        >
                                            {isUploading ? (
                                                <div className="animate-spin">
                                                    <RefreshCw size={16} />
                                                </div>
                                            ) : (
                                                <Camera size={16} />
                                            )}
                                        </button>
                                    )}
                                </div>

                                <div className="md:ml-6 flex-1">
                                    {editMode ? (
                                        <div className="space-y-4">
                                            <div>
                                                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                                                    Username
                                                </label>
                                                <input
                                                    type="text"
                                                    value={editForm.username}
                                                    disabled // <-- Make username field read-only
                                                    className={`w-full px-3 py-2 rounded-md ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border focus:outline-none ${darkMode ? 'focus:border-violet-500' : 'focus:border-cyan-500'} opacity-60 cursor-not-allowed`}
                                                />
                                            </div>
                                            <div>
                                                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                                                    Email
                                                </label>
                                                <input
                                                    type="email"
                                                    value={editForm.email}
                                                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                                    className={`w-full px-3 py-2 rounded-md ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border focus:outline-none ${darkMode ? 'focus:border-violet-500' : 'focus:border-cyan-500'}`}
                                                />
                                            </div>
                                            <div>
                                                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                                                    Bio
                                                </label>
                                                <textarea
                                                    value={editForm.bio}
                                                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                                                    rows={3}
                                                    className={`w-full px-3 py-2 rounded-md resize-none ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border focus:outline-none ${darkMode ? 'focus:border-violet-500' : 'focus:border-cyan-500'}`}
                                                />
                                            </div>
                                            <div className="flex space-x-3">
                                                <button
                                                    onClick={handleSaveProfile}
                                                    className={`flex items-center space-x-2 px-4 py-2 ${darkMode ? 'bg-violet-600 hover:bg-violet-500' : 'bg-cyan-600 hover:bg-cyan-500'} text-white rounded-lg transition-all duration-300 hover:shadow-lg ${darkMode ? 'hover:shadow-violet-500/30' : 'hover:shadow-cyan-500/30'}`}
                                                >
                                                    <Save size={16} />
                                                    <span>Save Changes</span>
                                                </button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className={`flex items-center space-x-2 px-4 py-2 ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} ${darkMode ? 'text-gray-300' : 'text-gray-700'} rounded-lg transition-colors`}
                                                >
                                                    <X size={16} />
                                                    <span>Cancel</span>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-between">
                                                <h2 className={`text-2xl font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                                                    {user.username}
                                                    {user.is_admin && (
                                                        <span className={`ml-2 text-xs font-medium px-2 py-1 rounded-full ${darkMode ? 'bg-violet-600/20 text-violet-400' : 'bg-cyan-100 text-cyan-800'}`}>
                                                            Admin
                                                        </span>
                                                    )}
                                                </h2>
                                                <button
                                                    onClick={() => setEditMode(true)}
                                                    className={`flex items-center space-x-2 px-3 py-1.5 ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} rounded-lg transition-colors`}
                                                >
                                                    <Edit size={16} />
                                                    <span>Edit Profile</span>
                                                </button>
                                            </div>
                                            <p className={`mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                {user.email}
                                            </p>
                                            <p className={`mt-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                {user.bio || 'No bio provided'}
                                            </p>
                                            <div className="mt-4 flex flex-wrap items-center text-sm gap-y-2 gap-x-4">
                                                <div className="flex items-center">
                                                    <Calendar size={16} className={`mr-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                                                    <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                                                        Joined {formatDate(user.created_at)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center">
                                                    <RefreshCw size={16} className={`mr-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                                                    <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                                                        Updated {getTimeElapsed(user.updated_at)}
                                                    </span>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { label: 'Repositories', value: repositoriesCount, icon: <FileText size={20} /> },
                                { label: 'Issues', value: issuesCount, icon: <AlertCircle size={20} /> },
                                { label: 'Pull Requests', value: pullRequestsCount, icon: <GitFork size={20} /> }
                            ].map((stat, idx) => (
                                <div
                                    key={idx}
                                    className={`${darkMode ? 'bg-gray-800/70 border-gray-700' : 'bg-white/90 border-gray-200'} backdrop-blur-sm border rounded-lg p-4 flex items-center`}
                                >
                                    <div className={`p-3 rounded-lg ${darkMode ? 'bg-violet-600/20 text-violet-400' : 'bg-cyan-50 text-cyan-600'}`}>
                                        {stat.icon}
                                    </div>
                                    <div className="ml-4">
                                        <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                                            {stat.value}
                                        </h3>
                                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {stat.label}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'settings':
                return (
                    <div className="space-y-6">
                        {successMessage && (
                            <div className={`p-4 rounded-lg ${darkMode
                                ? 'bg-green-900/30 border-green-800 text-green-400'
                                : 'bg-green-100 border-green-200 text-green-800'} border`}>
                                <div className="flex items-center">
                                    <CheckCircle className="mr-2" size={20} />
                                    {successMessage}
                                </div>
                            </div>
                        )}
                        <div className="mb-6">
                            <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-800'} mb-1`}>Settings</h2>
                            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Manage your preferences</p>
                        </div>

                        <div className={`${darkMode ? 'bg-gray-800/70 border-gray-700' : 'bg-white/90 border-gray-200'} backdrop-blur-sm border rounded-lg p-6`}>
                            <h3 className={`text-lg font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Security</h3>
                            <div className="space-y-6">
                                <div>
                                    <h4 className={`text-md font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Password</h4>
                                    <p className={`text-sm mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Change your account password</p>
                                    <button
                                        onClick={() => {
                                            setShowPasswordModal(true);
                                            setSuccessMessage(null);
                                        }}
                                        className={`flex items-center space-x-2 px-4 py-2 ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} ${darkMode ? 'text-gray-300' : 'text-gray-700'} rounded-lg transition-colors`}
                                    >
                                        <Key size={16} />
                                        <span>Change Password</span>
                                    </button>
                                </div>
                                <div>
                                    <h4 className={`text-md font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Two-Factor Authentication</h4>
                                    <p className={`text-sm mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {is2FAEnabled
                                            ? 'Enhanced security is enabled for your account'
                                            : 'Add an extra layer of security to your account'}
                                    </p>
                                    {is2FAEnabled ? (
                                        <button
                                            onClick={handleDisable2FA}
                                            className={`flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors`}
                                        >
                                            <Shield size={16} />
                                            <span>Disable 2FA</span>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleEnable2FA}
                                            disabled={isGeneratingQR}
                                            className={`flex items-center space-x-2 px-4 py-2 ${
                                                darkMode ? 'bg-violet-600 hover:bg-violet-500' : 'bg-cyan-600 hover:bg-cyan-500'
                                                } text-white rounded-lg transition-colors`}
                                        >
                                            {isGeneratingQR ? (
                                                <RefreshCw className="animate-spin" size={16} />
                                            ) : (
                                                <Shield size={16} />
                                            )}
                                            <span>{isGeneratingQR ? 'Generating...' : 'Enable 2FA'}</span>
                                        </button>
                                    )}
                                    {twoFAError && (
                                        <p className={`mt-2 text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                                            {twoFAError}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className={`${darkMode ? 'bg-gray-800/70 border-gray-700' : 'bg-white/90 border-gray-200'} backdrop-blur-sm border rounded-lg p-6`}>
                            <h3 className={`text-lg font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>App Preferences</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className={`font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Dark Mode</h4>
                                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Switch between dark and light mode</p>
                                    </div>
                                    <div
                                        onClick={() => setDarkMode(!darkMode)}
                                        className={`relative w-12 h-6 rounded-full cursor-pointer transition-colors ${darkMode ? 'bg-violet-600' : 'bg-gray-300'}`}
                                    >
                                        <div className={`absolute w-5 h-5 rounded-full top-0.5 transition-all ${darkMode ? 'right-0.5 bg-white' : 'left-0.5 bg-white'}`}></div>
                                    </div>
                                </div>
                                {/* Notification section removed */}
                            </div>
                        </div>

                        <div className={`${darkMode ? 'bg-gray-800/70 border-gray-700' : 'bg-white/90 border-gray-200'} backdrop-blur-sm border rounded-lg p-6`}>
                            <h3 className={`text-lg font-medium mb-4 ${darkMode ? 'text-white/80' : 'text-gray-800'}`}>Danger Zone</h3>
                            <div className="space-y-4">
                                <div>
                                    <h4 className={`font-medium text-red-500`}>Delete Account</h4>
                                    <p className={`text-sm mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                        Once you delete your account, there is no going back. Please be certain.
                                    </p>
                                    <button
                                        onClick={() => setShowDeleteConfirmation(true)}
                                        className={`flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors`}
                                    >
                                        <Trash2 size={16} />
                                        <span>Delete Account</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-transparent">
                    {particles.map((particle, idx) => (
                        <div
                            key={idx}
                            style={{
                                position: 'absolute',
                                left: `${particle.x}%`,
                                top: `${particle.y}%`,
                                width: `${particle.size}px`,
                                height: `${particle.size}px`,
                                borderRadius: '50%',
                                backgroundColor: darkMode
                                    ? `rgba(139, 92, 246, ${0.2 * (particle.size / 5)})`
                                    : `rgba(6, 182, 212, ${0.2 * (particle.size / 5)})`,
                                transition: 'background-color 0.5s ease'
                            }}
                        />
                    ))}
                </div>
            </div>

            <div className="p-6">
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Profile</h1>
                            <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Manage your account and preferences</p>
                        </div>
                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className={`p-2 rounded-lg transition-colors ${darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                    </div>

                    <div className={`flex border-b mb-6 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        {[
                            { id: 'overview', label: 'Overview' },
                            { id: 'settings', label: 'Settings' }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === tab.id
                                    ? darkMode
                                        ? 'border-violet-500 text-violet-400'
                                        : 'border-cyan-500 text-cyan-600'
                                    : darkMode
                                        ? 'border-transparent text-gray-400 hover:text-gray-300'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {renderTabContent()}
                </div>
            </div>

            {showPasswordModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl shadow-xl p-6 w-full max-w-md`}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Change Password</h3>
                            <button
                                onClick={() => setShowPasswordModal(false)}
                                className={`p-1.5 rounded-lg ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        {validationErrors && (
                            <div className={`p-4 rounded-lg ${darkMode ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-red-100 border-red-200 text-red-800'} border`}>
                                <div className="flex items-center mb-2">
                                    <AlertCircle className="mr-2" size={20} />
                                    <span className="font-semibold">Password Change Error:</span>
                                </div>
                                <ul className="list-disc list-inside pl-4">
                                    {validationErrors.map((error, index) => (
                                        <li key={index} className="text-sm">
                                            {error.message}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <div className="space-y-4">
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                                    Current Password
                                </label>
                                <input
                                    type="password"
                                    value={passwordForm.currentPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                    className={`w-full px-3 py-2 rounded-md ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border focus:outline-none ${darkMode ? 'focus:border-violet-500' : 'focus:border-cyan-500'}`}
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                                    New Password
                                </label>
                                <input
                                    type="password"
                                    value={passwordForm.newPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                    className={`w-full px-3 py-2 rounded-md ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border focus:outline-none ${darkMode ? 'focus:border-violet-500' : 'focus:border-cyan-500'}`}
                                />
                            </div>
                            <div>
                                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                                    Confirm New Password
                                </label>
                                <input
                                    type="password"
                                    value={passwordForm.confirmPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                    className={`w-full px-3 py-2 rounded-md ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border focus:outline-none ${darkMode ? 'focus:border-violet-500' : 'focus:border-cyan-500'}`}
                                />
                            </div>
                            <div className="flex space-x-3 pt-2">
                                <button
                                    onClick={handlePasswordChange}
                                    className={`flex-1 flex items-center justify-center space-x-2 py-2 ${darkMode ? 'bg-violet-600 hover:bg-violet-500' : 'bg-cyan-600 hover:bg-cyan-500'} text-white rounded-lg transition-all duration-300 hover:shadow-lg ${darkMode ? 'hover:shadow-violet-500/30' : 'hover:shadow-cyan-500/30'}`}
                                >
                                    <Key size={16} />
                                    <span>Update Password</span>
                                </button>
                                <button
                                    onClick={() => setShowPasswordModal(false)}
                                    className={`px-4 py-2 ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} rounded-lg transition-colors`}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {showDeleteConfirmation && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl shadow-xl p-6 w-full max-w-md`}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Delete Account</h3>
                            <button
                                onClick={() => setShowDeleteConfirmation(false)}
                                className={`p-1.5 rounded-lg ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                Are you sure you want to delete your account? This action cannot be undone.
                            </p>
                            {deleteError && (
                                <p className="text-red-500 text-sm">{deleteError}</p>
                            )}
                            <div className="flex space-x-3 pt-2">
                                <button
                                    onClick={handleDeleteAccount}
                                    className={`flex-1 flex items-center justify-center space-x-2 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all duration-300 hover:shadow-lg ${darkMode ? 'hover:shadow-red-500/30' : 'hover:shadow-red-500/30'}`}
                                >
                                    <Trash2 size={16} />
                                    <span>Delete Account</span>
                                </button>
                                <button
                                    onClick={() => setShowDeleteConfirmation(false)}
                                    className={`px-4 py-2 ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} rounded-lg transition-colors`}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {show2FAModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl shadow-xl p-6 w-full max-w-md`}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                                Enable Two-Factor Authentication
                            </h3>
                            <button
                                onClick={() => setShow2FAModal(false)}
                                className={`p-1.5 rounded-lg ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="text-center">
                                <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                    Scan this QR code with your authenticator app
                                </p>
                                <div className="flex justify-center p-4 bg-white rounded-lg">
                                    <QRCode
                                        value={qrCodeData}
                                        size={200}
                                        level="M"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                                    Verification Code
                                </label>
                                <input
                                    type="text"
                                    value={twoFAToken}
                                    onChange={(e) => setTwoFAToken(e.target.value)}
                                    placeholder="Enter 6-digit code"
                                    className={`w-full px-3 py-2 rounded-md ${
                                        darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                                        } border focus:outline-none ${darkMode ? 'focus:border-violet-500' : 'focus:border-cyan-500'}`}
                                />
                            </div>

                            {twoFAError && (
                                <p className={`text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                                    {twoFAError}
                                </p>
                            )}

                            <button
                                onClick={handleVerify2FA}
                                disabled={isVerifyingToken || !twoFAToken}
                                className={`w-full py-2 rounded-lg flex items-center justify-center space-x-2 ${
                                    darkMode ? 'bg-violet-600 hover:bg-violet-500' : 'bg-cyan-600 hover:bg-cyan-500'
                                    } text-white transition-colors ${(isVerifyingToken || !twoFAToken) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isVerifyingToken ? (
                                    <RefreshCw className="animate-spin" size={16} />
                                ) : (
                                    <Shield size={16} />
                                )}
                                <span>{isVerifyingToken ? 'Verifying...' : 'Verify and Enable'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
