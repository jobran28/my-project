import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Folder, File, X, Moon, Sun, Plus, Edit, Trash, GitBranch, GitCommit, Search, Terminal, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Rocket } from 'lucide-react';
import Confetti from 'react-dom-confetti';
import Editor from '@monaco-editor/react';
import ShareCodeAgent from './sharecodeagent';
import { diffLines } from 'diff';
import { set as idbSet, get as idbGet } from 'idb-keyval';
import * as monaco from 'monaco-editor';

interface Repository {
    id: number;
    name: string;
    description: string;
    is_private: boolean;
    created_at: string;
    updated_at: string;
    language: string;
    owner: {
        username: string;
    }
    actualName?: string;
    parent_id?: number;
}

interface DirectoryItem {
    name: string;
    type: 'file' | 'folder';
    size?: number;
    lastModified?: string;
}

interface TreeNode {
    name: string;
    type: 'file' | 'folder';
    path: string;
    isExpanded: boolean;
    children: TreeNode[];
    loaded: boolean;
    parentPath?: string;
    isEditing?: boolean;
    isNew?: boolean;
}

interface UserOwnRepoPreviewProps {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

declare module 'monaco-editor' {
  namespace editor {
    export interface IModelDeltaDecoration {
      range: IRange;
      options: IModelDecorationOptions;
    }
  }
}

const UserOwnRepoPreview = ({ darkMode, setDarkMode }: UserOwnRepoPreviewProps) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [repo, setRepo] = useState<Repository | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPath, setCurrentPath] = useState<string>('');
    const [displayPath, setDisplayPath] = useState<string>('');
    const [directoryContents, setDirectoryContents] = useState<DirectoryItem[]>([]);
    const [directoryLoading, setDirectoryLoading] = useState(true);
    const [directoryError, setDirectoryError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<{ path: string; content: string } | null>(null);
    const [newItemName, setNewItemName] = useState<string>('');
    const [newItemType, setNewItemType] = useState<'file' | 'folder'>('folder');
    const [newFileContent, setNewFileContent] = useState<string>('');
    const [renameItem, setRenameItem] = useState<{ oldPath: string; newPath: string } | null>(null);
    const [commitMessage, setCommitMessage] = useState<string>('');
    const [isCreating, setIsCreating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [headerScrolled, setHeaderScrolled] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [showCommitSuccess, setShowCommitSuccess] = useState(false);
    const [sidebarTree, setSidebarTree] = useState<TreeNode[]>([]);
    const [selectedLanguage, setSelectedLanguage] = useState<string>('plaintext');
    const [terminalOpen, setTerminalOpen] = useState(false);
    const [initialRootPath, setInitialRootPath] = useState<string>('');
    const [newItemParentPath, setNewItemParentPath] = useState<string>('');
    const [isTypeFixed, setIsTypeFixed] = useState(false);
    const [selectedBinaryFile, setSelectedBinaryFile] = useState<{ url: string; type: string } | null>(null);
    const [showShareCodeAgent, setShowShareCodeAgent] = useState(false);
    const [editorRef, setEditorRef] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
    const [repoOwnerUsername, setRepoOwnerUsername] = useState<string>('');
    const [showAgentButtons, setShowAgentButtons] = useState(false);
    const [agentOriginalContent, setAgentOriginalContent] = useState<string | null>(null);
    const [currentDecorations, setCurrentDecorations] = useState<string[]>([]); // Track current decorations
    const [recentlyEditedFiles, setRecentlyEditedFiles] = useState<Set<string>>(new Set());
    const [recentlyEditedFolders, setRecentlyEditedFolders] = useState<Set<string>>(new Set());

    // Helper to store and retrieve previous file versions in IndexedDB
    const getPreviousVersion = async (fileKey: string): Promise<string | null> => {
      try {
        const result = await idbGet(fileKey);
        return result === undefined ? null : result;
      } catch (e) {
        console.warn('Failed to get previous version from IndexedDB', e);
        return null;
      }
    };

    // Inside the UserOwnRepoPreview component
    const [agentWidth, setAgentWidth] = useState(384); // Default width 384px (w-96)
    const [isResizing, setIsResizing] = useState(false);
    const [initialX, setInitialX] = useState(0);
    const [initialWidth, setInitialWidth] = useState(384);

    const handleResizeStart = useCallback((e: React.MouseEvent) => {
      setIsResizing(true);
      setInitialX(e.clientX);
      setInitialWidth(agentWidth);
    }, [agentWidth]);

    const handleResize = useCallback((e: MouseEvent) => {
      if (isResizing) {
        const widthDelta = initialX - e.clientX;
        const newWidth = Math.min(Math.max(initialWidth + widthDelta, 300), 800); // Min 300px, max 800px
        setAgentWidth(newWidth);
      }
    }, [isResizing, initialX, initialWidth]);

    const handleResizeEnd = useCallback(() => {
      setIsResizing(false);
    }, []);

    useEffect(() => {
      if (isResizing) {
        window.addEventListener('mousemove', handleResize);
        window.addEventListener('mouseup', handleResizeEnd);
      }
      return () => {
        window.removeEventListener('mousemove', handleResize);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }, [isResizing, handleResize, handleResizeEnd]);

    const handleApplyChanges = async (fileName: string, newContent: string, agentEdit?: boolean) => {
      try {
        const token = localStorage.getItem('authToken');
        // Always construct the relativePath exactly as in handleFileClick (including subfolders)
        let relativePath = '';
        if (selectedFile) {
          // Use the full path of the selected file, removing temp-working-directory/
          relativePath = selectedFile.path.replace('temp-working-directory/', '');
        } else {
          // If editor is closed, construct the path from currentPath and fileName
          // currentPath may already be relative (after removing temp-working-directory/)
          const cleanCurrentPath = currentPath.replace('temp-working-directory/', '');
          relativePath = `${cleanCurrentPath}/${fileName}`;
        }

        // When it's an agent edit, store original content in sessionStorage
        if (agentEdit) {
          if (selectedFile) {
            // Editor is open - store original for undo
            const actualFileName = selectedFile.path.split('/').pop()!;
            const oKey = `agent_original_${repoOwnerUsername}_${actualFileName}`;
            sessionStorage.setItem(oKey, selectedFile.content);
            setAgentOriginalContent(selectedFile.content);
            setShowAgentButtons(true);
          } else {
            // Editor is closed - store original content for later undo and auto-open editor
            const actualFileName = fileName;
            const oKey = `agent_original_${repoOwnerUsername}_${actualFileName}`;
            
            // First, get the current content from server to store as original
            try {
              const currentResponse = await fetch(
                `http://localhost:5000/v1/api/preview/content?relativePath=${encodeURIComponent(relativePath)}&ownername=${encodeURIComponent(repoOwnerUsername)}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
              );
              if (currentResponse.ok) {
                const currentData = await currentResponse.json();
                if (currentData.data.type === 'file') {
                  sessionStorage.setItem(oKey, currentData.data.content);
                }
              }
            } catch (err) {
              console.warn('Failed to get current content for undo:', err);
            }
          }
        }

        // If it's an agent edit and editor is not open, trigger visual notifications
        if (agentEdit && !selectedFile) {
          const editedFilePath = `${currentPath}/${fileName}`.replace('temp-working-directory/', '');
          const editedFileName = fileName;
          
          // Add the file to recently edited files for visual effects
          setRecentlyEditedFiles(prev => new Set([...prev, editedFileName]));
          
          // Add parent folders to recently edited folders
          const pathParts = editedFilePath.split('/');
          for (let i = 1; i < pathParts.length; i++) {
            const folderPath = pathParts.slice(0, i).join('/');
            setRecentlyEditedFolders(prev => new Set([...prev, folderPath]));
          }
          
          // Remove the visual effects after animation completes
          setTimeout(() => {
            setRecentlyEditedFiles(prev => {
              const newSet = new Set(prev);
              newSet.delete(editedFileName);
              return newSet;
            });
            setRecentlyEditedFolders(prev => {
              const newSet = new Set(prev);
              const pathParts = editedFilePath.split('/');
              for (let i = 1; i < pathParts.length; i++) {
                const folderPath = pathParts.slice(0, i).join('/');
                newSet.delete(folderPath);
              }
              return newSet;
            });
          }, 4000); // Remove after 4 seconds
        }

        // Strip leading newlines for agent edits to prevent blank first lines
        const cleanedContent = agentEdit ? newContent.replace(/^\n+/, '') : newContent;

        // If editor is closed, update the file on server directly
        if (!selectedFile) {
          await fetch(
            `http://localhost:5000/v1/api/preview/content?ownername=${encodeURIComponent(repoOwnerUsername)}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ relativePath, newContent: cleanedContent })
            }
          );
          
          // Update session storage with the new content
          sessionStorage.setItem(`file_content_${repoOwnerUsername}_${fileName}`, cleanedContent);
          
          // If it's an agent edit, automatically open the editor after a brief delay for visual effects
          if (agentEdit) {
            setTimeout(() => {
              // Construct the full file path
              const fullFilePath = `${currentPath}/${fileName}`;
              
              // Set up the file data for the editor
              setSelectedLanguage(getLanguageFromExtension(fileName));
              setSelectedFile({ path: fullFilePath, content: cleanedContent });
              setNewFileContent(cleanedContent);
              
              // Set agent original content and show buttons
              const agentOriginalKey = `agent_original_${repoOwnerUsername}_${fileName}`;
              const agentOriginal = sessionStorage.getItem(agentOriginalKey);
              setAgentOriginalContent(agentOriginal);
              setShowAgentButtons(true);
              
            }, 2000); // Wait 2 seconds for visual effects to be noticeable
          }
        } else {
          // Editor is open - update editor preview (temporary)
          setSelectedFile(sf => sf && { ...sf, content: cleanedContent });
          setNewFileContent(cleanedContent);
          editorRef?.setValue(cleanedContent);
        }

        // If this was an agent edit and editor is open, highlight changes
        if (agentEdit && editorRef && selectedFile) {
          const fileKey = `agent_prev_${repoOwnerUsername}_${fileName}`;
          const prevContent = await getPreviousVersion(fileKey) || '';
          const diffs = diffLines(prevContent, cleanedContent);

          let decorations: monaco.editor.IModelDeltaDecoration[] = [];
          let oldLine = 1;
          let newLine = 1;

          for (let i = 0; i < diffs.length; i++) {
            const part = diffs[i];
            const lines = part.value.split('\n');
            if (lines[lines.length - 1] === '') lines.pop();

            if (part.added && i > 0 && diffs[i - 1].removed) {
              // Updated lines (removed + added in sequence)
              const removedLines = diffs[i - 1].value.split('\n');
              if (removedLines[removedLines.length - 1] === '') removedLines.pop();
              const count = Math.max(removedLines.length, lines.length);
              for (let j = 0; j < count; j++) {
                decorations.push({
                  range: new monaco.Range(newLine, 1, newLine, 1),
                  options: {
                    isWholeLine: true,
                    className: 'agent-updated-line',
                  },
                });
                newLine++;
              }
              // Already handled removed, so skip incrementing oldLine here
            } else if (part.added) {
              // New lines (green)
              lines.forEach(() => {
                decorations.push({
                  range: new monaco.Range(newLine, 1, newLine, 1),
                  options: {
                    isWholeLine: true,
                    className: 'agent-added-line',
                  },
                });
                newLine++;
              });
            } else if (part.removed) {
              // Deleted lines (red) - show as decoration on next line if possible
              lines.forEach(() => {
                decorations.push({
                  range: new monaco.Range(newLine, 1, newLine, 1),
                  options: {
                    isWholeLine: true,
                    className: 'agent-removed-line',
                  },
                });
                oldLine++;
              });
            } else {
              // Unchanged lines
              lines.forEach(() => {
                oldLine++;
                newLine++;
              });
            }
          }

          // Clear existing decorations and apply new ones
          const newDecorationIds = editorRef.deltaDecorations(currentDecorations, decorations);
          setCurrentDecorations(newDecorationIds);
        }

        fetchDirectoryContents();
      } catch (err) {
        setDirectoryError('Failed to apply changes: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    };

    const handleKeepChanges = async () => {
      if (!selectedFile) return;
      // now use the full path of the selected file
      const relativePath = selectedFile.path.replace('temp-working-directory/', '');
      const fileName = selectedFile.path.split('/').pop()!;
      const token = localStorage.getItem('authToken');
      await fetch(
        `http://localhost:5000/v1/api/preview/content?ownername=${encodeURIComponent(repoOwnerUsername)}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ relativePath, newContent: newFileContent })
        }
      );
      // now update original and clear all change tracking
      const origKey = `original_file_content_${repoOwnerUsername}_${fileName}`;
      sessionStorage.setItem(origKey, newFileContent);
      sessionStorage.removeItem(`agent_original_${repoOwnerUsername}_${fileName}`);
      sessionStorage.removeItem(`manual_changes_${repoOwnerUsername}_${fileName}`);
      setShowAgentButtons(false);
      setAgentOriginalContent(null);
      await handlePushChanges(commitMessage);
    };

    const handleUndoChanges = () => {
      if (!selectedFile) return;
      const filename = selectedFile.path.split('/').pop()!;
      const origKey = `original_file_content_${repoOwnerUsername}_${filename}`;
      const original = sessionStorage.getItem(origKey) || '';
      // revert session and state to original
      sessionStorage.setItem(`file_content_${repoOwnerUsername}_${filename}`, original);
      setSelectedFile(sf => sf && ({ ...sf, content: original }));
      setNewFileContent(original);
      editorRef?.setValue(original);
      // clear all change tracking
      sessionStorage.removeItem(`agent_original_${repoOwnerUsername}_${filename}`);
      sessionStorage.removeItem(`manual_changes_${repoOwnerUsername}_${filename}`);
      // Clear all decorations completely
      if (editorRef) {
          const clearedDecorations = editorRef.deltaDecorations(currentDecorations, []);
          setCurrentDecorations([]);
      }
      setShowAgentButtons(false);
      setAgentOriginalContent(null);
    };

    // Add this helper function to check name existence on the server
    const checkNameExists = async (parentPath: string, name: string): Promise<boolean> => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error('Authentication required');

            const response = await fetch(
                `http://localhost:5000/v1/api/preview/content?relativePath=${encodeURIComponent(parentPath)}&ownername=${encodeURIComponent(repoOwnerUsername)}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (!response.ok) return false;
            const data = await response.json();

            return data.data.content?.some((item: DirectoryItem) => item.name === name) || false;
        } catch (err) {
            console.error('Error checking name existence:', err);
            return false;
        }
    };

    // Helper function to determine if a file is a binary (image/video)
    const isBinaryFile = (fileName: string): boolean => {
        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'ico','pdf'];
        const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv'];
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        return imageExtensions.includes(ext) || videoExtensions.includes(ext);
    };

    const filteredContents = directoryContents
        .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()) && !item.name.endsWith('.git'))
        .sort((a, ) => a.type === 'folder' ? -1 : 1);

    const handleScroll = useCallback(() => {
        setHeaderScrolled(window.scrollY > 50);
    }, []);

    useEffect(() => {
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    useEffect(() => {
        const fetchRepo = async () => {
            try {
                const token = localStorage.getItem('authToken');
                if (!token) throw new Error('No authentication token found');

                const repoResponse = await fetch(`http://localhost:5000/v1/api/repositories/${id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!repoResponse.ok) throw new Error('Failed to fetch repository');
                const repoData = await repoResponse.json();

                const userResponse = await fetch(
                    `http://localhost:5000/v1/api/users/${repoData.data.owner_user_id}`,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                if (!userResponse.ok) throw new Error('Failed to fetch user details');
                const userData = await userResponse.json();

                setRepoOwnerUsername(userData.data.username); // set the owner username

                let originalOwner = "";
                let originalRepoName = "";
                if (repoData.data.parent_id) {
                    const parentRepoResponse = await fetch(
                        `http://localhost:5000/v1/api/repositories/${repoData.data.parent_id}`,
                        { headers: { 'Authorization': `Bearer ${token}` } }
                    );
                    if (!parentRepoResponse.ok) throw new Error('Failed to fetch parent repository');
                    const parentRepoData = await parentRepoResponse.json();

                    const parentUserResponse = await fetch(
                        `http://localhost:5000/v1/api/users/${parentRepoData.data.owner_user_id}`,
                        { headers: { 'Authorization': `Bearer ${token}` } }
                    );
                    if (!parentUserResponse.ok) throw new Error('Failed to fetch parent user details');
                    const parentUserData = await parentUserResponse.json();

                    originalOwner = parentUserData.data.username;
                    originalRepoName = parentRepoData.data.name;
                }

                setRepo({
                    ...repoData.data,
                    owner: {
                        username: userData.data.username
                    },
                    originalOwner: originalOwner,
                    originalRepoName: originalRepoName
                });

                // Clear previous sessionStorage for this owner before cloning
                clearRepoSessionStorage(userData.data.username);

                const cloneResponse = await fetch(
                    `http://localhost:5000/v1/api/preview/clone/${encodeURIComponent(repoData.data.name)}.git?ownername=${encodeURIComponent(userData.data.username)}`,
                    { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }
                );

                const cloneResult = await cloneResponse.json();
                if (cloneResult.status === 'success') {
                    setCurrentPath(cloneResult.data);
                    setDisplayPath(cloneResult.data.replace('temp-working-directory/', ''));
                    setInitialRootPath(cloneResult.data);
                } else if (cloneResult.error?.includes('File exists')) {
                    const path = `temp-working-directory/${repoData.data.name}.git`;
                    setCurrentPath(path);
                    setDisplayPath(path.replace('temp-working-directory/', ''));
                    setInitialRootPath(path);
                } else {
                    throw new Error(cloneResult.message || 'Clone failed');
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load repository');
            } finally {
                setLoading(false);
            }
        };

        fetchRepo();
    }, [id]);

    const SIDEBAR_WIDTH = 320;

    useEffect(() => {
        if (!repo || !initialRootPath) return;

        const loadInitialTree = async () => {
            const cleanPath = initialRootPath.replace('temp-working-directory/', '');
            const rootNode: TreeNode = {
                name: cleanPath.split('/').pop() || cleanPath,
                type: 'folder',
                path: cleanPath,
                isExpanded: true,
                children: [],
                loaded: false,
                parentPath: ''
            };
            setSidebarTree([rootNode]);
        };

        loadInitialTree();
    }, [repo, initialRootPath]);

    const toggleFolder = async (path: string) => {
        const node = findNode(sidebarTree, path);
        if (!node) return;

        if (!node.loaded) {
            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch(
                    `http://localhost:5000/v1/api/preview/content?relativePath=${encodeURIComponent(path)}&ownername=${encodeURIComponent(repoOwnerUsername)}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                if (response.ok) {
                    const data = await response.json();
                    const children = data.data.content
                        .filter((item: DirectoryItem) => item.name !== '.git') // Filter out .git folder
                        .map((item: DirectoryItem) => ({
                            name: item.name,
                            type: item.type,
                            path: `${path}/${item.name}`,
                            isExpanded: false,
                            children: [],
                            loaded: false,
                            parentPath: path
                        }));

                    setSidebarTree(prev => updateTree(prev, path, n => ({
                        ...n,
                        children,
                        loaded: true
                    })));
                }
            } catch (err) {
                console.error('Error loading folder contents:', err);
            }
        }

        setSidebarTree(prev => updateTree(prev, path, n => ({
            ...n,
            isExpanded: !n.isExpanded
        })));
    };

    const findNode = (nodes: TreeNode[], targetPath: string): TreeNode | undefined => {
        for (const node of nodes) {
            if (node.path === targetPath) return node;
            const found = findNode(node.children, targetPath);
            if (found) return found;
        }
        return undefined;
    };

    const updateTree = (nodes: TreeNode[], targetPath: string, updater: (node: TreeNode) => TreeNode): TreeNode[] => {
        return nodes.map(node => {
            if (node.path === targetPath) return updater(node);
            return { ...node, children: updateTree(node.children, targetPath, updater) };
        });
    };

    const addChildNode = (nodes: TreeNode[], parentPath: string, newNode: TreeNode): TreeNode[] => {
        return nodes.map(node => {
            if (node.path === parentPath) {
                return { ...node, children: [newNode, ...node.children] };
            }
            return { ...node, children: addChildNode(node.children, parentPath, newNode) };
        });
    };

    const removeNode = (nodes: TreeNode[], targetPath: string): TreeNode[] => {
        return nodes.filter(node => node.path !== targetPath).map(node => ({
            ...node,
            children: removeNode(node.children, targetPath)
        }));
    };

    const handleAddItem = (parentNode: TreeNode, type: 'file' | 'folder') => {
        const tempPath = `${parentNode.path}/new-${type}-${Date.now()}`;
        const tempNode: TreeNode = {
            name: '',
            type,
            path: tempPath,
            isExpanded: false,
            children: [],
            loaded: false,
            parentPath: parentNode.path,
            isEditing: true,
            isNew: true,
        };
        setSidebarTree(prev => addChildNode(prev, parentNode.path, tempNode));
    };

    const handleRenameStart = (node: TreeNode) => {
        setSidebarTree(prev =>
            updateTree(prev, node.path, n => ({ ...n, isEditing: true }))
        );
    };

    const handleNameChange = (node: TreeNode, newName: string) => {
        setSidebarTree(prev =>
            updateTree(prev, node.path, n => ({ ...n, name: newName }))
        );
    };

    // Add handleFileDragStart function
    const handleFileDragStart = (e: React.DragEvent, node: TreeNode) => {
        e.dataTransfer.setData('text/plain', node.path);
        e.dataTransfer.effectAllowed = 'copy';
    };

    // Updated handleKeyDown function for TreeView items
    const handleKeyDown = async (e: React.KeyboardEvent, node: TreeNode) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const newName = node.name.trim();
            if (!newName) {
                setSidebarTree(prev => removeNode(prev, node.path));
                return;
            }

            // Validate name
            if (!/^[a-zA-Z0-9_\-\. ]+$/.test(newName)) {
                setDirectoryError('Invalid name');
                return;
            }

            const parentPath = node.parentPath;
            if (!parentPath) {
                setDirectoryError('Invalid location');
                return;
            }

            // Server-side duplicate check
            try {
                const nameExists = await checkNameExists(parentPath, newName);
                if (nameExists) {
                    setDirectoryError('Name already exists');
                    return;
                }
            } catch (err) {
                setDirectoryError('Failed to verify name availability');
                return;
            }

            // Create/rename item
            try {
                const token = localStorage.getItem('authToken');
                if (!token) throw new Error('Authentication required');

                const newPath = `${parentPath}/${newName}`;
                const isNewItem = node.isNew;

                if (isNewItem) {
                    // API call to create new item
                    await fetch(`http://localhost:5000/v1/api/preview/item?ownername=${encodeURIComponent(repoOwnerUsername)}`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            relativePath: newPath,
                            type: node.type,
                            ...(node.type === 'file' && { content: '' })
                        })
                    });
                } else {
                    // API call to rename item
                    await fetch(`http://localhost:5000/v1/api/preview/item?ownername=${encodeURIComponent(repoOwnerUsername)}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            oldRelativePath: node.path,
                            newRelativePath: newPath
                        })
                    });
                }

                // Update the tree
                setSidebarTree(prev =>
                    updateTree(prev, node.path, n => ({
                        ...n,
                        path: newPath,
                        name: newName,
                        isEditing: false,
                        isNew: false
                    }))
                );

                // Refresh directory if in current path
                if (currentPath === parentPath) {

                }

                // Enable push button when creating new file via tree
                if (isNewItem && node.type === 'file') {
                    setHasChanges(true);
                }
            } catch (err) {
                setDirectoryError(err instanceof Error ? err.message : 'Operation failed');
                if (node.isNew) setSidebarTree(prev => removeNode(prev, node.path));
            }
        } else if (e.key === 'Escape') {
            if (node.isNew) {
                setSidebarTree(prev => removeNode(prev, node.path));
            } else {
                setSidebarTree(prev =>
                    updateTree(prev, node.path, n => ({ ...n, isEditing: false }))
                );
            }
        }
    };

    // Updated handleCreateItem function for modal creation
    const handleCreateItem = async () => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error('No authentication token found');

            const cleanParentPath = newItemParentPath.replace('temp-working-directory/', '');

            // Server-side duplicate check
            const nameExists = await checkNameExists(cleanParentPath, newItemName);
            if (nameExists) {
                setDirectoryError('Name already exists');
                return;
            }

            const rawPath = `${cleanParentPath}/${newItemName}`;

            const response = await fetch(`http://localhost:5000/v1/api/preview/item?ownername=${encodeURIComponent(repoOwnerUsername)}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    relativePath: rawPath,
                    type: newItemType,
                    ...(newItemType === 'file' && { content: newFileContent })
                })
            });

            if (!response.ok) throw new Error('Failed to create item');

            setNewItemName('');
            setNewFileContent('');
            setIsCreating(false);
            setNewItemParentPath('');
            setIsTypeFixed(false);

            const newItemPath = rawPath;
            const newTreeNode: TreeNode = {
                name: newItemName,
                type: newItemType,
                path: newItemPath,
                isExpanded: newItemType === 'folder',
                children: [],
                loaded: false,
                parentPath: cleanParentPath
            };

            if (currentPath === newItemParentPath) {
                setDirectoryContents([{ name: newItemName, type: newItemType }, ...directoryContents]);
            }

            setSidebarTree(prev => addChildNode(prev, cleanParentPath, newTreeNode));

            if (newItemType === 'file') {
                setHasChanges(true);
            }
        } catch (err) {
            setDirectoryError(err instanceof Error ? err.message : 'Failed to create item');
        }
    };

    // Update the TreeView component to include visual effects for edited files
    const TreeView = ({ nodes, onToggle, onFileClick }: { nodes: TreeNode[], onToggle: (path: string) => void, onFileClick: (path: string) => void }) => (
        <div className="pl-2">
            {nodes.map(node => {
                const isRecentlyEditedFile = recentlyEditedFiles.has(node.name);
                const isRecentlyEditedFolder = recentlyEditedFolders.has(node.path);
                
                return (
                    <div key={node.path}>
                        <div className="flex items-center">
                            {node.type === 'folder' && (
                                <button
                                    onClick={() => onToggle(node.path)}
                                    className="mr-1 p-1 hover:bg-gray-700 rounded text-sm"
                                >
                                    {node.isExpanded ? '▼' : '▶'}
                                </button>
                            )}
                            <motion.div
                                className={`group flex items-center flex-1 p-2 rounded-lg ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-200'} ${
                                    isRecentlyEditedFile || isRecentlyEditedFolder 
                                        ? `relative ${darkMode ? 'bg-gradient-to-r from-violet-900/40 to-purple-900/40' : 'bg-gradient-to-r from-cyan-100/60 to-blue-100/60'}`
                                        : ''
                                }`}
                                animate={isRecentlyEditedFile || isRecentlyEditedFolder ? {
                                    scale: [1, 1.05, 1],
                                    x: [0, 3, -3, 0],
                                } : {}}
                                transition={{
                                    duration: 2,
                                    repeat: 1,
                                    ease: "easeInOut"
                                }}
                            >
                                {(isRecentlyEditedFile || isRecentlyEditedFolder) && (
                                    <>
                                        {/* Glow effect */}
                                        <motion.div
                                            className={`absolute inset-0 rounded-lg ${
                                                darkMode 
                                                    ? 'bg-gradient-to-r from-violet-500/30 to-purple-500/30' 
                                                    : 'bg-gradient-to-r from-cyan-400/30 to-blue-400/30'
                                            }`}
                                            animate={{
                                                opacity: [0, 0.8, 0],
                                                scale: [0.95, 1.05, 0.95],
                                            }}
                                            transition={{
                                                duration: 1.5,
                                                repeat: 2,
                                                ease: "easeInOut"
                                            }}
                                        />
                                        {/* Sparkle effect */}
                                        <motion.div
                                            className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                                                darkMode ? 'bg-violet-400' : 'bg-cyan-500'
                                            }`}
                                            animate={{
                                                opacity: [0, 1, 0],
                                                scale: [0, 1, 0],
                                                rotate: [0, 180, 360],
                                            }}
                                            transition={{
                                                duration: 0.8,
                                                repeat: 3,
                                                ease: "easeInOut"
                                            }}
                                        />
                                    </>
                                )}
                                
                                {node.isEditing ? (
                                    <input
                                        autoFocus
                                        value={node.name}
                                        onChange={(e) => handleNameChange(node, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(e, node)}
                                        className="ml-2 bg-transparent border-b border-blue-500 outline-none"
                                    />
                                ) : (
                                    <>
                                        <motion.div
                                            animate={isRecentlyEditedFile || isRecentlyEditedFolder ? {
                                                rotate: [0, 5, -5, 0],
                                                scale: [1, 1.1, 1],
                                            } : {}}
                                            transition={{
                                                duration: 0.6,
                                                repeat: 2,
                                                ease: "easeInOut"
                                            }}
                                        >
                                            <FileIcon type={node.type} name={node.name} />
                                        </motion.div>
                                        <motion.span
                                            className={`ml-2 cursor-pointer ${
                                                isRecentlyEditedFile || isRecentlyEditedFolder
                                                    ? `font-semibold ${darkMode ? 'text-violet-300' : 'text-cyan-700'}`
                                                    : ''
                                            }`}
                                            onDoubleClick={node.type === 'folder' ? () => handleRenameStart(node) : undefined}
                                            onClick={() => {
                                                if (node.type === 'file') {
                                                    onFileClick(node.path);
                                                }
                                            }}
                                            draggable={node.type === 'file'}
                                            // Move onDragStart to the underlying span, not the motion.span
                                            // (framer-motion's animate/transition props remain)
                                            animate={isRecentlyEditedFile ? {
                                                color: darkMode 
                                                    ? ['#c4b5fd', '#a78bfa', '#7c3aed', '#c4b5fd']
                                                    : ['#0891b2', '#06b6d4', '#0284c7', '#0891b2']
                                            } : {}}
                                            transition={{
                                                duration: 1.2,
                                                repeat: 2,
                                                ease: "easeInOut"
                                            }}
                                        >
                                            <span
                                                draggable={node.type === 'file'}
                                                onDragStart={(e: React.DragEvent) => handleFileDragStart(e, node)}
                                            >
                                                {node.name}
                                            </span>
                                        </motion.span>
                                    </>
                                )}
                                {!node.isEditing && node.type === 'folder' && (
                                    <div className="flex space-x-1 ml-2 opacity-0 group-hover:opacity-100">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleAddItem(node, 'folder');
                                            }}
                                            className={`p-1 rounded ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                                        >
                                            <Folder size={16} className={darkMode ? 'text-amber-400' : 'text-amber-600'} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleAddItem(node, 'file');
                                            }}
                                            className={`p-1 rounded ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                                        >
                                            <File size={16} className={darkMode ? 'text-blue-400' : 'text-blue-600'} />
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        </div>
                        {node.isExpanded && (
                            <TreeView
                                nodes={node.children}
                                onToggle={onToggle}
                                onFileClick={onFileClick}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );

    const fetchDirectoryContents = async () => {
        if (!repo || !currentPath) return;

        setDirectoryLoading(true);
        setDirectoryError(null);

        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error('No authentication token found');

            const cleanPath = currentPath.replace('temp-working-directory/', '');
            const response = await fetch(
                `http://localhost:5000/v1/api/preview/content?relativePath=${encodeURIComponent(cleanPath)}&ownername=${encodeURIComponent(repoOwnerUsername)}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch directory contents');
            }

            const responseData = await response.json();

            if (responseData.data.type === 'folder') {
                setDirectoryContents(responseData.data.content.filter((item: DirectoryItem) => !(item.type === 'folder' && item.name.endsWith('.git'))));
            } else {
                throw new Error('Expected folder content');
            }
        } catch (err) {
            setDirectoryError(err instanceof Error ? err.message : 'Failed to load directory contents');
        } finally {
            setDirectoryLoading(false);
        }
    };

    useEffect(() => {
        fetchDirectoryContents();
    }, [currentPath, repo]);

    const handleFolderClick = (folderName: string) => {
        const newPath = `${currentPath}/${folderName}`;
        setCurrentPath(newPath);
        setDisplayPath(newPath.replace('temp-working-directory/', ''));
    };

    const getLanguageFromExtension = (fileName: string): string => {
        const extension = fileName.split('.').pop();
        switch (extension) {
            // Popular languages
            case 'js':
                return 'javascript';
            case 'ts':
                return 'typescript';
            case 'py':
                return 'python';
            case 'java':
                return 'java';
            case 'cs':
                return 'csharp';
            case 'cpp':
                return 'cpp';
            case 'c':
                return 'c';
            case 'h':
                return 'cpp';
            case 'html':
                return 'html';
            case 'css':
                return 'css';
            case 'json':
                return 'json';
            case 'md':
                return 'markdown';
            case 'php':
                return 'php';
            case 'go':
                return 'go';
            case 'rb':
                return 'ruby';
            case 'rs':
                return 'rust';
            case 'swift':
                return 'swift';
            case 'kt':
                return 'kotlin';
            case 'scala':
                return 'scala';
            case 'sh':
                return 'shell';
            case 'pl':
                return 'perl';
            case 'lua':
                return 'lua';
            case 'r':
                return 'r';
            case 'dart':
                return 'dart';
            case 'jl':
                return 'julia';
            case 'haskell':
                return 'haskell';
            case 'elm':
                return 'elm';
            case 'clj':
                return 'clojure';
            case 'scm':
                return 'scheme';
            case 'erl':
                return 'erlang';
            case 'fsharp':
                return 'fsharp';
            case 'ex':
                return 'elixir';
            case 'exs':
                return 'elixir';
            case 'groovy':
                return 'groovy';
            case 'sql':
                return 'sql';
            case 'yaml':
                return 'yaml';
            case 'yml':
                return 'yaml';
            case 'xml':
                return 'xml';
            case 'toml':
                return 'toml';
            case 'ini':
                return 'ini';
            case 'm':
                return 'objective-c';
            case 'mm':
                return 'objective-c';
            case 'vb':
                return 'vb';
            case 'ps1':
                return 'powershell';
            case 'coffee':
                return 'coffeescript';
            case 'fsx':
                return 'fsharp';
            case 'sc':
                return 'scala';
            case 'lisp':
                return 'lisp';
            case 'asm':
                return 'assembly';
            case 's':
                return 'assembly';
            case 'pas':
                return 'pascal';
            case 'd':
                return 'd';
            case 'v':
                return 'verilog';
            case 'sv':
                return 'systemverilog';
            case 'vhdl':
                return 'vhdl';
            case 'tcl':
                return 'tcl';
            case 'awk':
                return 'awk';
            case 'sed':
                return 'sed';
            case 'bat':
                return 'batch';
            case 'cmd':
                return 'batch';
            case 'ps':
                return 'postscript';
            case 'tex':
                return 'latex';
            case 'bib':
                return 'bibtex';
            case 'make':
                return 'makefile';
            case 'mk':
                return 'makefile';
            case 'cmake':
                return 'cmake';
            case 'dockerfile':
                return 'dockerfile';
            case 'graphql':
                return 'graphql';
            case 'proto':
                return 'protobuf';
            case 'thrift':
                return 'thrift';
            case 'vue':
                return 'vue';
            case 'svelte':
                return 'svelte';
            case 'jsx':
                return 'javascriptreact';
            case 'tsx':
                return 'typescriptreact';
            // case 'vue': // Already defined
            //     return 'vue';
            // case 'svelte': // Already defined
            //     return 'svelte';

            // Additional languages and file types
            case 'f':
                return 'fortran';
            case 'f90':
                return 'fortran';
            case 'f95':
                return 'fortran';
            case 'adb':
                return 'ada';
            case 'ads':
                return 'ada';
            // case 'pl': // Already defined as perl, could be prolog
            case 'p':
                return 'pascal';
            case 'pp':
                return 'pascal';
            case 'lsp':
                return 'lisp';
            case 'cl':
                return 'commonlisp';
            // case 'sc': // Already defined as scala, could be supercollider
            //     return 'supercollider';
            case 'scd':
                return 'supercollider';
            case 'nut':
                return 'squirrel';
            case 'st':
                return 'smalltalk';
            case 't':
                return 'turing';
            case 'tu':
                return 'turing';
            case 'vhd':
                // return 'vhdl'; // Already defined
            // case 'vhdl': // Already defined
            //     return 'vhdl';
            // case 'vb': // Already defined
                return 'vbscript'; // More specific or another option for .vb
            case 'vbs':
                return 'vbscript';
            case 'xq':
                return 'xquery';
            case 'xql':
                return 'xquery';
            case 'xqm':
                return 'xquery';
            case 'xqy':
                return 'xquery';
            case 'zsh':
                return 'zsh';
            case 'fish':
                return 'fish';
            case 'nu':
                return 'nushell';
            case 'zig':
                return 'zig';
            case 'wren':
                return 'wren';
            case 'nim':
                return 'nim';
            case 'cr':
                return 'crystal';
            case 'ec':
                return 'ec';
            case 'ecl':
                return 'ecl';
            // case 'ex': // Already defined as elixir
                // return 'eiffel';
            case 'frt':
                return 'frege';
            case 'g':
                return 'gap';
            case 'gd':
                return 'gdscript';
            case 'glsl':
                return 'glsl';
            case 'gnu':
                return 'gnuplot';
            case 'gp':
                return 'gnuplot';
            case 'hx':
                return 'haxe';
            case 'hxsl':
                return 'hxsl';
            case 'idr':
                return 'idris';
            case 'lidr':
                return 'idris';
            case 'janet':
                return 'janet';
            // case 'jl': // Already defined
            //     return 'julia';
            case 'kts':
                return 'kotlin';
            case 'ktm':
                return 'kotlin';
            case 'lean':
                return 'lean';
            case 'hlean':
                return 'lean';
            case 'lagda':
                return 'agda';
            case 'litcoffee':
                return 'coffeescript';
            case 'ls':
                return 'livescript';
            case 'mumps':
                return 'mumps';
            // case 'm': // Already defined as objective-c
                // return 'mercury';
            case 'moo':
                return 'moocode';
            case 'n':
                return 'nemerle';
            case 'nl':
                return 'nl';
            case 'nix':
                return 'nix';
            case 'ocaml':
                return 'ocaml';
            case 'ml':
                return 'ocaml';
            case 'mli':
                return 'ocaml';
            case 'mll':
                return 'ocaml';
            case 'mly':
                return 'ocaml';
            case 'opa':
                return 'opa';
            case 'p6':
                return 'perl6';
            case 'pl6':
                return 'perl6';
            case 'pm6':
                return 'perl6';
            case 'pogo':
                return 'pogo';
            case 'pony':
                return 'pony';
            case 'psc':
                return 'papyrus';
            case 'pss':
                return 'powershell';
            case 'purs':
                return 'purescript';
            case 'pyw':
                return 'python';
            case 'pyi':
                return 'python';
            case 'pyx':
                return 'cython';
            case 'pxd':
                return 'cython';
            case 'pxi':
                return 'cython';
            case 'rkt':
                return 'racket';
            case 'rktl':
                return 'racket';
            case 'rl':
                return 'ragel';
            case 'rst':
                return 'restructuredtext';
            // case 'rs': // Already defined
            //     return 'rust';
            case 'sas':
                return 'sas';
            // case 'sc': // Already defined
            //     return 'scala';
            // case 'scm': // Already defined
            //     return 'scheme';
            // case 'scala': // Already defined
            //     return 'scala';
            // case 'sc': // Already defined
            //     return 'supercollider';
            // case 'scd': // Already defined
            //     return 'supercollider';
            case 'sls':
                return 'scheme';
            case 'sml':
                return 'sml';
            case 'sol':
                return 'solidity';
            // case 'st': // Already defined
            //     return 'smalltalk';
            case 'stan':
                return 'stan';
            case 'tac':
                return 'tac';
            case 'tcsh':
                return 'tcsh';
            case 'texi':
                return 'texinfo';
            case 'tf':
                return 'terraform';
            // case 'thrift': // Already defined
            //     return 'thrift';
            case 'tl':
                return 'tl';
            case 'tla':
                return 'tla';
            case 'tm':
                return 'tcl';
            // case 'tcl': // Already defined
            //     return 'tcl';
            // case 'toml': // Already defined
            //     return 'toml';
            case 'tp':
                return 'turing';
            // case 'tu': // Already defined
            //     return 'turing';
            case 'uc':
                return 'unrealscript';
            case 'upc':
                return 'upc';
            case 'urs':
                return 'urscript';
            // case 'v': // Already defined
            //     return 'verilog';
            // case 'vb': // Already defined
                // return 'vbnet';
            // case 'vbs': // Already defined
                // return 'vbscript';
            case 'vcl':
                return 'vcl';
            // case 'vhd': // Already defined
            //     return 'vhdl';
            // case 'vhdl': // Already defined
            //     return 'vhdl';
            // case 'vb': // Already defined
                // return 'visualbasic';
            // case 'vbs': // Already defined
            //     return 'vbscript';
            case 'wast':
                return 'webassembly';
            case 'wat':
                return 'webassembly';
            case 'wisp':
                return 'wisp';
            case 'wlk':
                return 'wollok';
            case 'wls':
                return 'wollok';
            // case 'wren': // Already defined
            //     return 'wren';
            case 'x10':
                return 'xten';
            case 'xpl':
                return 'xproc';
            // case 'xq': // Already defined
            //     return 'xquery';
            // case 'xql': // Already defined
            //     return 'xquery';
            // case 'xqm': // Already defined
            //     return 'xquery';
            // case 'xqy': // Already defined
            //     return 'xquery';
            // case 'xqy':
            //     return 'xquery';
            // case 'xqy':
            //     return 'xquery';
            // case 'xqy':
            //     return 'xquery';
            // case 'xqy':
            //     return 'xquery';
            // case 'xqy':
            //     return 'xquery';
            // case 'xqy':
            //     return 'xquery';
            // case 'xqy':
            //     return 'xquery';
            case 'xsl':
                return 'xsl';
            case 'xslt':
                return 'xslt';
            case 'y':
                return 'yacc';
            // case 'yaml': // Already defined
            //     return 'yaml';
            // case 'yml': // Already defined
            //     return 'yaml';
            case 'zep':
                return 'zephir';
            case 'zimpl':
                return 'zimpl';
            // case 'zsh': // Already defined
            //     return 'zsh';
            default:
                return 'plaintext';
        }
    };

    const handleFileClick = async (filePath: string) => {
        const fileName = filePath.split('/').pop() || '';
        
        // Clear any existing decorations before switching files
        if (editorRef && currentDecorations.length > 0) {
            editorRef.deltaDecorations(currentDecorations, []);
            setCurrentDecorations([]);
        }
        
        if (isBinaryFile(fileName)) {
            // Handle binary file using the /files route
            const cleanPath = filePath.replace('temp-working-directory/', '');
            const token = localStorage.getItem('authToken');
            if (!token) {
                setDirectoryError('Authentication required');
                return;
            }
            try {
                const url = `http://localhost:5000/v1/api/preview/files?path=${encodeURIComponent(cleanPath)}`;
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!response.ok) throw new Error('Failed to fetch file');
                const blob = await response.blob();
                const mimeType = response.headers.get('Content-Type') || '';
                const objectUrl = URL.createObjectURL(blob);
                setSelectedBinaryFile({ url: objectUrl, type: mimeType });
            } catch (err) {
                setDirectoryError(err instanceof Error ? err.message : 'Failed to load binary file');
            }
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error('No authentication token found');

            const cleanPath = filePath.replace('temp-working-directory/', '');
            const response = await fetch(
                `http://localhost:5000/v1/api/preview/content?relativePath=${encodeURIComponent(cleanPath)}&ownername=${encodeURIComponent(repoOwnerUsername)}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (!response.ok) throw new Error('Failed to fetch file content');
            const data = await response.json();

            if (data.data.type === 'file') {
                const fileName = cleanPath.split('/').pop()!;
                const originalKey = `original_file_content_${repoOwnerUsername}_${fileName}`;
                const sessionKey = `file_content_${repoOwnerUsername}_${fileName}`;
                const agentOriginalKey = `agent_original_${repoOwnerUsername}_${fileName}`;
                
                // Always save the original fetched content if not exists
                let originalContent = sessionStorage.getItem(originalKey);
                if (!originalContent) {
                  originalContent = data.data.content;
                  sessionStorage.setItem(originalKey, originalContent ?? '');
                }
                
                // Check if there's agent-modified content in session storage
                let fileContent = sessionStorage.getItem(sessionKey);
                if (!fileContent) {
                  // Use server content if no session content exists
                  fileContent = data.data.content;
                  sessionStorage.setItem(sessionKey, fileContent ?? '');
                }
                
                setSelectedLanguage(getLanguageFromExtension(fileName));
                setSelectedFile({ path: filePath, content: fileContent ?? '' });
                setNewFileContent(fileContent ?? '');

                // Check for agent edits that happened while editor was closed
                const agentOriginal = sessionStorage.getItem(agentOriginalKey);
                const manualChanges = sessionStorage.getItem(`manual_changes_${repoOwnerUsername}_${fileName}`);
                
                // Show buttons if there are agent changes OR manual changes
                const hasAnyChanges = !!agentOriginal || !!manualChanges;
                
                setAgentOriginalContent(agentOriginal);
                setShowAgentButtons(hasAnyChanges);
            }
        } catch (err) {
            setDirectoryError(err instanceof Error ? err.message : 'Failed to load file content');
        }
    };

    const clearRepoSessionStorage = (owner: string) => {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith(`file_content_${owner}_`) || key.startsWith(`original_file_content_${owner}_`))) {
          sessionStorage.removeItem(key);
        }
      }
    };

    const handleRenameItem = async () => {
        if (!renameItem) return;

        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error('No authentication token found');

            const oldCleanPath = renameItem.oldPath.replace('temp-working-directory/', '');
            const newCleanPath = renameItem.newPath.replace('temp-working-directory/', '');

            const response = await fetch(`http://localhost:5000/v1/api/preview/item?ownername=${encodeURIComponent(repoOwnerUsername)}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    oldRelativePath: oldCleanPath,
                    newRelativePath: newCleanPath
                })
            });

            if (!response.ok) throw new Error('Failed to rename item');

            setDirectoryContents(directoryContents.map(item =>
                item.name === renameItem.oldPath.split('/').pop()
                    ? { ...item, name: renameItem.newPath.split('/').pop() || item.name }
                    : item
            ));
            setRenameItem(null);
            setHasChanges(true);

            const oldPath = renameItem.oldPath.replace('temp-working-directory/', '');
            const newPath = renameItem.newPath.replace('temp-working-directory/', '');
            setSidebarTree(prev =>
                updateTree(prev, oldPath, n => ({
                    ...n,
                    name: newPath.split('/').pop() || n.name,
                    path: newPath,
                    children: n.children.map(child => ({
                        ...child,
                        path: child.path.replace(oldPath, newPath),
                        parentPath: newPath
                    }))
                }))
            );
        } catch (err) {
            setDirectoryError(err instanceof Error ? err.message : 'Failed to rename item');
        }
    };

    const handleDeleteItem = async (itemName: string) => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error('No authentication token found');

            const item = directoryContents.find(item => item.name === itemName);
            if (!item) throw new Error('Item not found');

            const cleanPath = `${currentPath}/${itemName}`.replace('temp-working-directory/', '');

            let containsFiles = false;
            if (item.type === 'file') {
                containsFiles = true;
            } else {
                containsFiles = await checkIfContainsFiles(cleanPath);
            }

            const response = await fetch(`http://localhost:5000/v1/api/preview/item?relativePath=${encodeURIComponent(cleanPath)}&ownername=${encodeURIComponent(repoOwnerUsername)}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to delete item');

            setDirectoryContents(directoryContents.filter(item => item.name !== itemName));

            const itemPath = `${currentPath}/${itemName}`.replace('temp-working-directory/', '');
            setSidebarTree(prev => removeNode(prev, itemPath));

            if (containsFiles) {
                setHasChanges(true);
            }
        } catch (err) {
            setDirectoryError(err instanceof Error ? err.message : 'Failed to delete item');
        }
    };

    const checkIfContainsFiles = async (path: string): Promise<boolean> => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error('No authentication token found');

            const response = await fetch(`http://localhost:5000/v1/api/preview/content?relativePath=${encodeURIComponent(path)}&ownername=${encodeURIComponent(repoOwnerUsername)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch directory contents');

            const data = await response.json();

            if (data.data.type === 'file') {
                return true;
            }

            if (data.data.type === 'folder') {
                for (const item of data.data.content) {
                    if (item.type === 'file' || await checkIfContainsFiles(`${path}/${item.name}`)) {
                        return true;
                    }
                }
            }

            return false;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    const handlePushChanges = async (message: string) => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error('No authentication token found');

            // Before pushing, write all updated file_content_ values to disk/server
            if (repo && repoOwnerUsername) {
              for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key?.startsWith(`file_content_${repoOwnerUsername}_`)) {
                  const fileName = key.replace(`file_content_${repoOwnerUsername}_`, '');
                  const updatedContent = sessionStorage.getItem(key);
                  if (updatedContent !== null) {
                    // Construct the full relative path as in handleFileClick
                    // Find the file in the directory tree to get its full path
                    let relativePath = '';
                    // Try to find the file in the sidebarTree
                    const findFilePath = (nodes: TreeNode[], name: string): string | null => {
                      for (const node of nodes) {
                        if (node.type === 'file' && node.name === name) return node.path;
                        const found = findFilePath(node.children, name);
                        if (found) return found;
                      }
                      return null;
                    };
                    const foundPath = findFilePath(sidebarTree, fileName);
                    if (foundPath) {
                      relativePath = foundPath.replace('temp-working-directory/', '');
                    } else {
                      // Fallback: use currentPath + fileName
                      const cleanCurrentPath = currentPath.replace('temp-working-directory/', '');
                      relativePath = `${cleanCurrentPath}/${fileName}`;
                    }
                    await fetch(
                      `http://localhost:5000/v1/api/preview/content?ownername=${encodeURIComponent(repoOwnerUsername)}`,
                      {
                        method: 'PUT',
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ relativePath, newContent: updatedContent })
                      }
                    );
                  }
                }
              }
            }

            // Log the username used for push
            console.log('Pushing with ownername:', repoOwnerUsername);

            const response = await fetch(
                `http://localhost:5000/v1/api/preview/push/${encodeURIComponent(repo?.name || '')}.git?ownername=${encodeURIComponent(repoOwnerUsername)}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ commitMessage: message })
                }
            );

            if (!response.ok) throw new Error('Failed to push changes');

            setShowCommitSuccess(true);
            setCommitMessage('');
            setHasChanges(false);

            setTimeout(() => setShowCommitSuccess(false), 3000);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to push changes';
            if (errorMessage.includes('nothing to commit') || errorMessage.includes('No changes')) {
                setDirectoryError('No changes to any files to push. Make file modifications to enable push.');
            } else {
                setDirectoryError(errorMessage);
            }
        }
    };

    // Add this effect to detect file changes in sessionStorage and enable push button
useEffect(() => {
    if (!repo || !repoOwnerUsername) return;
    // Check for any file_content_ changes for this repo owner
    let foundChange = false;
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (
            key &&
            key.startsWith(`file_content_${repoOwnerUsername}_`)
        ) {
            const originalKey = key.replace('file_content_', 'original_file_content_');
            const current = sessionStorage.getItem(key);
            const original = sessionStorage.getItem(originalKey);
            if (current !== null && original !== null && current !== original) {
                foundChange = true;
                break;
            }
        }
    }
    setHasChanges(foundChange);
    // Optionally, listen to storage events for multi-tab sync
    const handler = () => {
        let found = false;
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (
                key &&
                key.startsWith(`file_content_${repoOwnerUsername}_`)
            ) {
                const originalKey = key.replace('file_content_', 'original_file_content_');
                const current = sessionStorage.getItem(key);
                const original = sessionStorage.getItem(originalKey);
                if (current !== null && original !== null && current !== original) {
                    found = true;
                    break;
                }
            }
        }
        setHasChanges(found);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
}, [repo, repoOwnerUsername]);

    // Add session storage cleanup on page unload
    useEffect(() => {
        const handleBeforeUnload = () => {
            sessionStorage.clear();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    const FileIcon = ({ type, name }: { type: 'file' | 'folder', name: string }) => {
        const extension = name.split('.').pop();
        const getColor = () => {
            if (type === 'folder') return 'text-amber-400';
            switch (extension) {
                case 'js': return 'text-yellow-400';
                case 'ts': return 'text-blue-400';
                case 'css': return 'text-purple-400';
                case 'json': return 'text-green-400';
                case 'md': return 'text-pink-400';
                default: return 'text-gray-400';
            }
        };

        return (
            <motion.div whileHover={{ scale: 1.1 }} className="mr-2">
                {type === 'folder' ? (
                    <Folder className={`h-6 w-6 ${getColor()}`} />
                ) : (
                    <File className={`h-6 w-6 ${getColor()}`} />
                )}
            </motion.div>
        );
    };

    const DirectoryItemCard = ({ item }: { item: DirectoryItem }) => {
        const isRecentlyEdited = recentlyEditedFiles.has(item.name);
        
        return (
            <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ 
                    opacity: 1, 
                    x: 0,
                    ...(isRecentlyEdited ? {
                        scale: [1, 1.08, 1],
                        rotateY: [0, 5, -5, 0],
                    } : {})
                }}
                exit={{ opacity: 0, x: 10 }}
                transition={{
                    ...(isRecentlyEdited ? {
                        duration: 1.8,
                        repeat: 1,
                        ease: "easeInOut"
                    } : {})
                }}
                className={`group relative flex items-center p-3 rounded-xl ${
                    darkMode ? 'hover:bg-gray-800/50' : 'hover:bg-gray-200'
                } transition-all duration-200 shadow-sm ${
                    darkMode ? 'bg-gray-800/30' : 'bg-white'
                } ${
                    isRecentlyEdited 
                        ? `${darkMode ? 'bg-gradient-to-br from-violet-900/50 to-purple-900/50 shadow-violet-500/25' : 'bg-gradient-to-br from-cyan-100/80 to-blue-100/80 shadow-cyan-500/25'} shadow-xl`
                        : ''
                }`}
            >
                {isRecentlyEdited && (
                    <>
                        {/* Outer glow effect */}
                        <motion.div
                            className={`absolute -inset-1 rounded-xl ${
                                darkMode 
                                    ? 'bg-gradient-to-r from-violet-600/40 to-purple-600/40' 
                                    : 'bg-gradient-to-r from-cyan-500/40 to-blue-500/40'
                            } blur-sm`}
                            animate={{
                                opacity: [0, 1, 0],
                                scale: [0.9, 1.1, 0.9],
                            }}
                            transition={{
                                duration: 2,
                                repeat: 1,
                                ease: "easeInOut"
                            }}
                        />
                        {/* Floating particles */}
                        {[...Array(3)].map((_, i) => (
                            <motion.div
                                key={i}
                                className={`absolute w-1 h-1 rounded-full ${
                                    darkMode ? 'bg-violet-400' : 'bg-cyan-500'
                                }`}
                                style={{
                                    top: `${20 + i * 20}%`,
                                    right: `${10 + i * 15}%`,
                                }}
                                animate={{
                                    y: [-10, -20, -10],
                                    opacity: [0, 1, 0],
                                    scale: [0, 1, 0],
                                }}
                                transition={{
                                    duration: 1.5,
                                    repeat: 1,
                                    delay: i * 0.3,
                                    ease: "easeInOut"
                                }}
                            />
                        ))}
                    </>
                )}
                
                <div 
                    className="flex items-center flex-1 relative z-10" 
                    onClick={() => item.type === 'folder'
                        ? handleFolderClick(item.name)
                        : handleFileClick(`${currentPath}/${item.name}`)
                    }
                >
                    <motion.div
                        animate={isRecentlyEdited ? {
                            rotate: [0, 10, -10, 0],
                            scale: [1, 1.1, 1],
                        } : {}}
                        transition={{
                            duration: 1,
                            repeat: 2,
                            ease: "easeInOut"
                        }}
                    >
                        <FileIcon type={item.type} name={item.name} />
                    </motion.div>
                    <motion.span 
                        className={`font-mono text-sm ${
                            isRecentlyEdited 
                                ? `font-bold ${darkMode ? 'text-violet-200' : 'text-cyan-800'}`
                                : ''
                        }`}
                        animate={isRecentlyEdited ? {
                            color: darkMode 
                                ? ['#ddd6fe', '#c4b5fd', '#8b5cf6', '#ddd6fe']
                                : ['#164e63', '#0891b2', '#0e7490', '#164e63']
                        } : {}}
                        transition={{
                            duration: 1.5,
                            repeat: 1,
                            ease: "easeInOut"
                        }}
                    >
                        {item.name}
                    </motion.span>
                    {item.size && (
                        <span className="ml-2 text-xs opacity-60">
                            {(item.size / 1024).toFixed(2)} KB
                        </span>
                    )}
                </div>
                <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity relative z-10">
                    <button
                        onClick={() => setRenameItem({
                            oldPath: `${currentPath}/${item.name}`,
                            newPath: `${currentPath}/${item.name}`
                        })}
                        className={`p-1.5 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-300'
                            }`}
                    >
                        <Edit size={16} className={darkMode ? 'text-gray-300' : 'text-gray-600'} />
                    </button>
                    <button
                        onClick={() => handleDeleteItem(item.name)}
                        className={`p-1.5 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-300'
                            }`}
                    >
                        <Trash size={16} className={darkMode ? 'text-red-400' : 'text-red-600'} />
                    </button>
                </div>
            </motion.div>
        );
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
                    <h2 className="text-lg font-bold mb-2">Error Loading Repository</h2>
                    <p className="mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className={`px-4 py-2 ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} rounded`}
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Highlight styles for agent edits */}
            <style>
            {`
            .agent-added-line { background-color: #16a34a33 !important; }   /* green */
            .agent-removed-line { background-color: #dc262633 !important; } /* red */
            .agent-updated-line { background-color: #2563eb33 !important; } /* blue */
            
            @keyframes shimmer {
                0% { background-position: -1000px 0; }
                100% { background-position: 1000px 0; }
            }
            
            .shimmer-effect {
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                background-size: 1000px 100%;
                animation: shimmer 2s infinite;
            }
            `}
            </style>
            <div className={`min-h-screen flex flex-col ${darkMode ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white'
                : 'bg-gradient-to-br from-gray-50 to-white text-gray-800'
            } transition-all duration-300`}>
                <header className={`fixed top-0 left-0 right-0 z-50 ${darkMode ? 'bg-gray-900/90 border-gray-800' : 'bg-white/95 border-gray-200'
                    } backdrop-blur-xl border-b transition-all duration-300 ${headerScrolled ? 'py-3' : 'py-4'
                    }`}>
                    <div className="container mx-auto px-6 flex justify-between items-center">
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => navigate(-1)}
                                className={`p-2 rounded-xl ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                                    } transition-colors`}
                            >
                                <ChevronLeft size={24} className={darkMode ? 'text-gray-400' : 'text-gray-600'} />
                            </button>
                            <div className="flex items-center space-x-3">
                                <motion.div
                                    whileHover={{ rotate: 12, scale: 1.1 }}
                                    className={`p-2 rounded-lg ${darkMode ? 'bg-violet-600' : 'bg-cyan-600'
                                        }`}
                                >
                                    <GitBranch size={24} className="text-white" />
                                </motion.div>
                                <div className="flex flex-col">
                                    <h1 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'
                                        }`}>
                                        {repo?.owner.username}/<span className="text-violet-400">{repo?.actualName || repo?.name}</span>
                                    </h1>
                                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'
                                        }`}>
                                        {repo?.description || 'No description provided'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            <div className={`relative transition-all duration-300 ${headerScrolled ? 'w-64' : 'w-96'
                                }`}>
                                <input
                                    type="text"
                                    placeholder="Search files..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className={`w-full px-4 py-2 rounded-xl ${darkMode
                                            ? 'bg-gray-800 text-white placeholder-gray-500'
                                            : 'bg-gray-100 text-gray-800 placeholder-gray-400'
                                        } pr-10 transition-all`}
                                />
                                <Search size={18} className={`absolute right-3 top-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'
                                    }`} />
                            </div>

                            <div className="flex space-x-2">
                                <button
                                    onClick={() => setTerminalOpen(!terminalOpen)}
                                    className={`p-2 rounded-xl ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
                                        }`}
                                >
                                    <Terminal size={20} className={darkMode ? 'text-green-400' : 'text-green-600'} />
                                </button>
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    animate={{ rotate: showShareCodeAgent ? 360 : 0 }}
                                    onClick={() => setShowShareCodeAgent(!showShareCodeAgent)}
                                    className={`p-2 rounded-xl ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}
                                >
                                    <Bot size={20} className={darkMode ? 'text-purple-400' : 'text-purple-600'} />
                                </motion.button>
                                <button
                                    onClick={() => setDarkMode(!darkMode)}
                                    className={`p-2 rounded-xl ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
                                        }`}
                                >
                                    {darkMode ? (
                                        <Sun size={20} className="text-amber-400" />
                                    ) : (
                                        <Moon size={20} className="text-indigo-600" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex flex-1 pt-20">
                    <motion.aside
                        initial={{ x: 0 }}
                        className={`w-80 fixed left-0 h-full p-6 border-r z-60 ${darkMode ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-white/50'
                            } backdrop-blur-lg`}
                        style={{ width: `${SIDEBAR_WIDTH}px` }}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className={`text-lg font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-800'
                                }`}>
                            Repository Structure
                            </h2>
                        </div>
                        <div className="overflow-y-auto h-[calc(100vh-150px)]"> {/* Adjust the height as needed */}
                            <TreeView
                                nodes={sidebarTree}
                                onToggle={toggleFolder}
                                onFileClick={handleFileClick}
                            />
                        </div>
                    </motion.aside>

                    <main className={`flex-1 transition-all duration-300 ml-80`}>
                        <div className="container mx-auto px-8 py-6">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center space-x-4">
                                    <div className={`flex items-center space-x-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {displayPath.split('/').map((segment, index) => (
                                            <React.Fragment key={index}>
                                                <span
                                                    className="hover:text-violet-400 cursor-pointer"
                                                    onClick={() => {
                                                        const newPath = displayPath.split('/').slice(0, index + 1).join('/');
                                                        setCurrentPath(`temp-working-directory/${newPath}`);
                                                        setDisplayPath(newPath);
                                                    }}
                                                >
                                                    {segment}
                                                </span>
                                                {index < displayPath.split('/').length - 1 && (
                                                    <span className="mx-1">/</span>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        setNewItemParentPath(currentPath);
                                        setIsTypeFixed(false);
                                        setIsCreating(true);
                                    }}
                                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl ${darkMode
                                            ? 'bg-violet-600 hover:bg-violet-700 text-white'
                                            : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                                        } transition-colors`}
                                >
                                    <Plus size={18} />
                                    <span>New</span>
                                </button>
                            </div>

                            <AnimatePresence>
                                {isCreating && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        className={`mb-6 p-6 rounded-2xl ${darkMode ? 'bg-gray-800/50' : 'bg-white'
                                            } backdrop-blur-lg shadow-xl`}
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-semibold">Create New Item</h3>
                                            <button
                                                onClick={() => setIsCreating(false)}
                                                className={`p-1 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                                                    }`}
                                            >
                                                <X size={20} />
                                            </button>
                                        </div>
                                        <div className="space-y-4">
                                            <input
                                                type="text"
                                                placeholder="Item name"
                                                value={newItemName}
                                                onChange={(e) => setNewItemName(e.target.value)}
                                                className={`w-full px-4 py-2 rounded-lg ${darkMode
                                                        ? 'bg-gray-700 text-white placeholder-gray-500'
                                                        : 'bg-gray-100 text-gray-800 placeholder-gray-400'
                                                    }`}
                                            />
                                            <select
                                                value={newItemType}
                                                onChange={(e) => setNewItemType(e.target.value as 'file' | 'folder')}
                                                className={`w-full px-4 py-2 rounded-lg ${darkMode
                                                        ? 'bg-gray-700 text-white'
                                                        : 'bg-gray-100 text-gray-800'
                                                    }`}
                                                disabled={isTypeFixed}
                                            >
                                                <option value="folder">Folder</option>
                                                <option value="file">File</option>
                                            </select>
                                            <button
                                                onClick={handleCreateItem}
                                                className={`w-full py-2.5 rounded-lg ${darkMode
                                                        ? 'bg-violet-600 hover:bg-violet-700'
                                                        : 'bg-cyan-600 hover:bg-cyan-700'
                                                    } text-white transition-colors`}
                                            >
                                                Create Item
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {directoryLoading && (
                                <div className="flex justify-center p-8">
                                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-violet-500"></div>
                                </div>
                            )}

                            {directoryError && (
                                <div className={`p-4 mb-6 rounded-xl ${darkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
                                }`}>
                                {directoryError}
                                </div>
                            )}

                            {!directoryLoading && !directoryError && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <AnimatePresence>
                                        {filteredContents.length > 0 ? (
                                            filteredContents.map((item) => (
                                                <DirectoryItemCard key={item.name} item={item} />
                                            ))
                                        ) : (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className={`col-span-full p-8 text-center rounded-xl ${darkMode ? 'bg-gray-800/30' : 'bg-white'
                                                    }`}
                                            >
                                                <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                                                    {searchQuery
                                                        ? 'No files match your search'
                                                        : 'This directory is empty'}
                                                </p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}

                            <AnimatePresence>
                                {renameItem && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center`}
                                    >
                                        <motion.div
                                            initial={{ y: 50, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            exit={{ y: -50, opacity: 0 }}
                                            className={`w-full max-w-md rounded-2xl p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'
                                                }`}
                                        >
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg font-semibold">Rename Item</h3>
                                                <button
                                                    onClick={() => setRenameItem(null)}
                                                    className={`p-1 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                                                >
                                                    <X size={20} />
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                value={renameItem.newPath.split('/').pop() || ''}
                                                onChange={(e) => setRenameItem({
                                                    ...renameItem,
                                                    newPath: `${renameItem.newPath.split('/').slice(0, -1).join('/')}/${e.target.value}`
                                                })}
                                                className={`w-full px-4 py-2 rounded-lg ${darkMode
                                                        ? 'bg-gray-700 text-white'
                                                        : 'bg-gray-100 text-gray-800'
                                                    } mb-4`}
                                            />
                                            <div className="flex justify-end space-x-2">
                                                <button
                                                    onClick={() => setRenameItem(null)}
                                                    className={`px-4 py-2 rounded-lg ${darkMode
                                                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                                            : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                                                        }`}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleRenameItem}
                                                    className={`px-4 py-2 rounded-lg ${darkMode
                                                            ? 'bg-violet-600 hover:bg-violet-700 text-white'
                                                            : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                                                        }`}
                                                                                               >
                                                    Rename
                                                </button>
                                                                                       </div>
                                        </motion.div>
                                                                       </motion.div>
                                )}
                            </AnimatePresence>

                            <AnimatePresence>
                                {selectedFile && (
                                    <motion.div
                                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
                                        style={{ left: `${SIDEBAR_WIDTH}px`, width: `calc(100% - ${SIDEBAR_WIDTH}px)` }}
                                    >
                                        <div className="h-screen w-full flex flex-col">
                                            <div className={`flex justify-between items-center p-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                                                <div className="flex items-center space-x-4">
                                                    <select
                                                        value={selectedLanguage}
                                                        onChange={(e) => setSelectedLanguage(e.target.value)}
                                                        className={`px-3 py-2 rounded-lg ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100'}`}
                                                    >
                                                        <option value="plaintext">Plain Text</option>
                                                        <option value="javascript">JavaScript</option>
                                                        <option value="typescript">TypeScript</option>
                                                        <option value="python">Python</option>
                                                        <option value="java">Java</option>
                                                        <option value="csharp">C#</option>
                                                        <option value="cpp">C++</option>
                                                        <option value="c">C</option>
                                                        <option value="html">HTML</option>
                                                        <option value="css">CSS</option>
                                                        <option value="json">JSON</option>
                                                        <option value="markdown">Markdown</option>
                                                        <option value="php">PHP</option>
                                                        <option value="go">Go</option>
                                                        <option value="ruby">Ruby</option>
                                                        <option value="rust">Rust</option>
                                                        <option value="swift">Swift</option>
                                                        <option value="kotlin">Kotlin</option>
                                                        <option value="scala">Scala</option>
                                                        <option value="shell">Shell</option>
                                                        <option value="perl">Perl</option>
                                                        <option value="lua">Lua</option>
                                                        <option value="r">R</option>
                                                        <option value="dart">Dart</option>
                                                        <option value="julia">Julia</option>
                                                        <option value="haskell">Haskell</option>
                                                        <option value="elm">Elm</option>
                                                        <option value="clojure">Clojure</option>
                                                        <option value="scheme">Scheme</option>
                                                        <option value="erlang">Erlang</option>
                                                        <option value="fsharp">F#</option>
                                                        <option value="elixir">Elixir</option>
                                                        <option value="groovy">Groovy</option>
                                                        <option value="sql">SQL</option>
                                                        <option value="yaml">YAML</option>
                                                        <option value="xml">XML</option>
                                                        <option value="toml">TOML</option>
                                                        <option value="ini">INI</option>
                                                        <option value="objective-c">Objective-C</option>
                                                        <option value="vb">VB</option>
                                                        <option value="powershell">PowerShell</option>
                                                        <option value="coffeescript">CoffeeScript</option>
                                                        <option value="lisp">Lisp</option>
                                                        <option value="assembly">Assembly</option>
                                                        <option value="pascal">Pascal</option>
                                                        <option value="d">D</option>
                                                        <option value="verilog">Verilog</option>
                                                        <option value="systemverilog">SystemVerilog</option>
                                                        <option value="vhdl">VHDL</option>
                                                        <option value="tcl">Tcl</option>
                                                        <option value="awk">Awk</option>
                                                        <option value="sed">Sed</option>
                                                        <option value="batch">Batch</option>
                                                        <option value="postscript">PostScript</option>
                                                        <option value="latex">LaTeX</option>
                                                        <option value="bibtex">BibTeX</option>
                                                        <option value="makefile">Makefile</option>
                                                        <option value="cmake">CMake</option>
                                                        <option value="dockerfile">Dockerfile</option>
                                                        <option value="graphql">GraphQL</option>
                                                        <option value="protobuf">Protobuf</option>
                                                        <option value="thrift">Thrift</option>
                                                        <option value="vue">Vue</option>
                                                        <option value="svelte">Svelte</option>
                                                        <option value="javascriptreact">JavaScript React (JSX)</option>
                                                        <option value="typescriptreact">TypeScript React (TSX)</option>
                                                        {/* Add more as needed */}
                                                    </select>
                                                </div>
                                                <div className="flex space-x-2">
                                                    {showAgentButtons && (
                                                        <>
                                                            <button onClick={handleUndoChanges} className="px-3 py-1 bg-red-600 text-white rounded">Undo</button>
                                                            <button onClick={handleKeepChanges} className="px-3 py-1 bg-green-600 text-white rounded">Keep</button>
                                                        </>
                                                    )}
                                                    <button onClick={() => {
                                                        // Clear decorations when closing file
                                                        if (editorRef && currentDecorations.length > 0) {
                                                            editorRef.deltaDecorations(currentDecorations, []);
                                                            setCurrentDecorations([]);
                                                        }
                                                        setSelectedFile(null);
                                                    }} className={`p-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
                                                        <X size={24} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <Editor
                                                  height="100%"
                                                  language={selectedLanguage as string}
                                                  theme={darkMode ? 'vs-dark' : 'vs-light'}
                                                  value={newFileContent}
                                                  onChange={(value) => {
                                                    const content = value || '';
                                                    setNewFileContent(content);
                                                    setHasChanges(true);
                                                    
                                                    // Update session storage for current file
                                                    if (selectedFile) {
                                                      const fileName = selectedFile.path.split('/').pop()!;
                                                      const sessionKey = `file_content_${repoOwnerUsername}_${fileName}`;
                                                      const originalKey = `original_file_content_${repoOwnerUsername}_${fileName}`;
                                                      const originalContent = sessionStorage.getItem(originalKey) || '';
                                                      
                                                      sessionStorage.setItem(sessionKey, content);
                                                      
                                                      // Check if content has changed from original
                                                      if (content !== originalContent) {
                                                        // Mark as having manual changes and show buttons
                                                        sessionStorage.setItem(`manual_changes_${repoOwnerUsername}_${fileName}`, 'true');
                                                        setShowAgentButtons(true);
                                                      } else {
                                                        // Content is back to original, remove manual change marker
                                                        sessionStorage.removeItem(`manual_changes_${repoOwnerUsername}_${fileName}`);
                                                        // Only hide buttons if there are no agent changes either
                                                        const agentOriginal = sessionStorage.getItem(`agent_original_${repoOwnerUsername}_${fileName}`);
                                                        if (!agentOriginal) {
                                                          setShowAgentButtons(false);
                                                        }
                                                      }
                                                    }
                                    
                                                    // Clear decorations on manual edit
                                                    if (editorRef && currentDecorations.length > 0) {
                                                        editorRef.deltaDecorations(currentDecorations, []);
                                                        setCurrentDecorations([]);
                                                    }
                                                  }}
                                                  onMount={(editor) => {
                                                    setEditorRef(editor);
                                                    // Clear any existing decorations when editor mounts
                                                    setCurrentDecorations([]);
                                                  }}
                                                  options={{
                                                    minimap: { enabled: false },
                                                    automaticLayout: true,
                                                    scrollBeyondLastLine: false,
                                                  }}
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <AnimatePresence>
                                {terminalOpen && (
                                    <motion.div
                                        initial={{ y: 100, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        exit={{ y: 100, opacity: 0 }}
                                        className={`fixed bottom-0 left-0 right-0 ${darkMode ? 'bg-gray-800' : 'bg-white'
                                            } border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'
                                            } shadow-2xl rounded-t-2xl`}
                                    >
                                        <div className="flex items-center justify-between p-4">
                                            <div className="flex items-center space-x-2">
                                                <Terminal size={18} className="text-green-400" />
                                                <span className="font-mono text-sm">Terminal</span>
                                            </div>
                                            <button
                                                onClick={() => setTerminalOpen(false)}
                                                className={`p-1.5 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                        <div className={`h-48 p-4 font-mono text-sm overflow-auto ${darkMode ? 'bg-gray-900 text-green-400' : 'bg-gray-100 text-green-800'
                                            }`}>
                                            <div className="mb-2">$ git status</div>
                                            <div className="text-gray-400">On branch main</div>
                                            <div className="text-gray-400">Your branch is up to date.</div>
                                            <div className="mt-4 mb-2">$ git add .</div>
                                            <div className="mt-4 mb-2">$ git commit -m "{commitMessage || 'Update files'}"</div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className={`fixed bottom-6 right-6 p-4 rounded-2xl shadow-xl ${darkMode ? 'bg-gray-800' : 'bg-white'
                                }`}>
                                <div className="flex items-center space-x-4">
                                    <input
                                        type="text"
                                        placeholder="Commit message"
                                        value={commitMessage}
                                        onChange={(e) => setCommitMessage(e.target.value)}
                                        className={`px-4 py-2 rounded-xl ${darkMode
                                                ? 'bg-gray-700 text-white placeholder-gray-500'
                                                : 'bg-gray-100 text-gray-800 placeholder-gray-400'
                                            } w-64`}
                                    />
                                    <div className="relative group">
                                        <button
                                            onClick={() => handlePushChanges(commitMessage)}
                                            disabled={!hasChanges}
                                            className={`px-4 py-2 rounded-xl flex items-center space-x-2 ${
                                                darkMode
                                                    ? hasChanges
                                                        ? 'bg-violet-600 hover:bg-violet-700 text-white'
                                                        : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                                                    : hasChanges
                                                        ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            }`}
                                        >
                                            <GitCommit size={18} />
                                            <span>Push Changes</span>
                                        </button>
                                        {!hasChanges && (
                                            <div className={`absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-sm rounded-lg ${
                                                darkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-900 text-white'
                                            } opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none`}>
                                                Git tracks only file modifications. Make changes to files to enable push.
                                                <div className={`absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 ${
                                                    darkMode ? 'bg-gray-800' : 'bg-gray-900'
                                                } rotate-45`} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <AnimatePresence>
                                {showCommitSuccess && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        className={`fixed bottom-6 left-6 right-6 sm:left-auto sm:right-6 p-6 rounded-2xl backdrop-blur-lg ${
                                            darkMode
                                                ? 'bg-violet-700/30 border border-violet-600/50'
                                                : 'bg-cyan-500/20 border border-cyan-400/30'
                                            } shadow-xl overflow-hidden`}
                                    >
                                        <div className="flex items-center space-x-4">
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className={`p-3 rounded-full ${
                                                    darkMode ? 'bg-violet-600/80' : 'bg-cyan-500/80'
                                                }`}
                                            >
                                                <CheckCircle
                                                    size={32}
                                                    className="text-white animate-pop-in"
                                                />
                                            </motion.div>

                                            <div className="flex-1">
                                                <h3 className={`text-lg font-semibold ${
                                                    darkMode ? 'text-violet-100' : 'text-cyan-900'
                                                }`}>
                                                    Push Successful!
                                                </h3>
                                                <p className={`text-sm ${
                                                    darkMode ? 'text-violet-300/90' : 'text-cyan-800/90'
                                                }`}>
                                                    Changes to <span className="font-mono">{repo?.name}</span> have been securely stored
                                                </p>
                                                <div className={`mt-2 text-xs ${
                                                    darkMode ? 'text-violet-400' : 'text-cyan-700'
                                                }`}>
                                                    <span className="font-mono">"{commitMessage || 'Update files'}"</span>
                                                </div>
                                            </div>

                                            <Confetti
                                                active={showCommitSuccess}
                                                config={{
                                                    elementCount: 200,
                                                    spread: 90,
                                                    startVelocity: 30,
                                                    dragFriction: 0.12,
                                                    duration: 3000,
                                                    stagger: 3,
                                                    colors: darkMode
                                                        ? ['#7c3aed', '#a78bfa', '#c4b5fd']
                                                        : ['#0891b2', '#06b6d4', '#67e8f9']
                                                }}
                                            />
                                        </div>

                                        <motion.div
                                            initial={{ width: '100%' }}
                                            animate={{ width: '0%' }}
                                            transition={{ duration: 3, ease: 'linear' }}
                                            className={`absolute bottom-0 left-0 h-1 ${
                                                darkMode ? 'bg-violet-500/80' : 'bg-cyan-400/80'
                                            }`}
                                        />

                                        <Rocket
                                            size={20}
                                            className={`absolute -top-4 -right-4 opacity-20 ${
                                                darkMode ? 'text-violet-300' : 'text-cyan-400'
                                            } transform rotate-45`}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Add the binary file preview modal */}
                            <AnimatePresence>
                                {selectedBinaryFile && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center"
                                    >
                                        <div className={`p-6 rounded-2xl ${darkMode ? 'bg-gray-800' : 'bg-white'} max-w-4xl max-h-[90vh] overflow-auto`}>
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg font-semibold">File Preview</h3>
                                                <button
                                                    onClick={() => {
                                                        URL.revokeObjectURL(selectedBinaryFile.url);
                                                        setSelectedBinaryFile(null);
                                                    }}
                                                    className={`p-1 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                                                >
                                                    <X size={24} />
                                                </button>
                                            </div>
                                            {selectedBinaryFile.type.startsWith('image/') && (
                                                <img
                                                    src={selectedBinaryFile.url}
                                                    alt="Preview"
                                                    className="max-w-full max-h-[70vh] object-contain"
                                                />
                                            )}
                                            {selectedBinaryFile.type.startsWith('video/') && (
                                                <video
                                                    controls
                                                    className="max-w-full max-h-[70vh]"
                                                >
                                                    <source src={selectedBinaryFile.url} type={selectedBinaryFile.type} />
                                                    Your browser does not support the video tag.
                                                </video>
                                            )}
                                            {!selectedBinaryFile.type.startsWith('image/') && !selectedBinaryFile.type.startsWith('video/') && (
                                                <div className="text-center p-4">
                                                    <p className="mb-4">This file type cannot be previewed directly.</p>
                                                    <a
                                                        href={selectedBinaryFile.url}
                                                        download
                                                        className={`px-4 py-2 rounded-lg ${darkMode ? 'bg-violet-600 hover:bg-violet-700' : 'bg-cyan-600 hover:bg-cyan-700'} text-white transition-colors`}
                                                    >
                                                        Download File
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </main>
                </div>
                <AnimatePresence>
                    {showShareCodeAgent && (
                        <motion.div
                            initial={{ x: 300, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 300, opacity: 0 }}
                            className={`fixed right-0 top-0 h-[calc(100vh-4rem)] ${darkMode ? 'bg-gray-900' : 'bg-white'} border-l ${darkMode ? 'border-gray-800' : 'border-gray-200'} shadow-xl z-50`}
                            style={{
                                top: '4rem',
                                width: agentWidth,
                                cursor: isResizing ? 'col-resize' : 'auto'
                            }}
                            
                        >
                            {/* Resize handle */}
                            <div
                                className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize ${darkMode ? 'hover:bg-violet-500' : 'hover:bg-cyan-500'} transition-colors z-50`}
                                onMouseDown={handleResizeStart}
                            />
                            <ShareCodeAgent
                                darkMode={darkMode}
                                onClose={() => setShowShareCodeAgent(false)}
                                repoOwner={repoOwnerUsername}
                                authToken={localStorage.getItem('authToken') || ''}
                                onApplyChanges={handleApplyChanges}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
};

export default UserOwnRepoPreview;
