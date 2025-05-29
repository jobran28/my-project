import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula, prism } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { MessageSquare, Code, Bot, ChevronDown, X, Send, Zap, Play, CheckCircle2, FileCode2, File, Plus } from 'lucide-react';
import { jwtDecode } from 'jwt-decode';

// Add the ApiResponse interface
interface ApiResponse {
  conversation_id?: string;
  message: string;
  tool_calls?: ToolCall[];
}

// Add types for tool calls
interface ToolCall {
  name: string;
  args: {
    changes: Array<{
      file_name: string;
      insertions?: Array<{ insert_line: number; code: string }>;
      edits?: Array<{ line_start: number; line_end: number; new_content: string }>;
    }>;
  };
  id: string;
  type: string;
}

interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
}

interface ShareCodeAgentProps {
  darkMode: boolean;
  onClose: () => void;
  repoOwner: string;
  authToken: string;
  onApplyChanges: (fileName: string, newContent: string, agentEdit: boolean) => void;
  width?: number;
}

// Add user profile interface
interface UserProfile {
  id: number;
  username: string;
  email: string;
  bio: string | null;
  avatar_path: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

interface JwtPayload {
  userId: string;
}

// Add this type for Markdown components
interface MarkdownComponents {
  [nodeType: string]: React.ElementType;
}

const convertToLineFormat = (content: string) => {
  return content.split('\n').reduce((acc, line, index) => {
    acc[index + 1] = line;
    return acc;
  }, {} as Record<number, string>);
};

// Add FilePreview component before the ShareCodeAgent component
const FilePreview = ({ files, onRemove, darkMode, currentFileContents }: {
  files: Array<{ name: string; content: string }>;
  onRemove: (index: number) => void;
  darkMode: boolean;
  currentFileContents: Record<string, string>;
}) => {
  if (files.length === 0) return null;

  return (
    <div className="mb-3 space-y-2">
      <p className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
        DROPPED FILES ({files.length})
      </p>
      {files.map((file, index) => {
        // Use current file contents if available, otherwise use original content
        const currentContent = currentFileContents[file.name] || file.content;
        const lineCount = currentContent.split('\n').length;

        return (
          <div
            key={index}
            className={`flex items-center justify-between p-2 lg:p-2.5 rounded-lg ${
              darkMode ? 'bg-gray-800/70' : 'bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <FileCode2 size={16} className={darkMode ? 'text-blue-400' : 'text-blue-600'} />
              <span className={`text-xs lg:text-sm truncate ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {file.name}
              </span>
              <span className={`text-xs ${
                darkMode ? 'text-gray-500' : 'text-gray-500'
              }`}>
                ({lineCount} lines)
              </span>
            </div>
            <button
              onClick={() => onRemove(index)}
              className={`p-1 rounded-md ${
                darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-600'
              }`}
              title="Remove file"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

const ShareCodeAgent = ({ darkMode, onClose, repoOwner, authToken, onApplyChanges, width }: ShareCodeAgentProps) => {
  const [mode, setMode] = useState('ask');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [askConversation, setAskConversation] = useState<Message[]>([]);
  const [editConversation, setEditConversation] = useState<Message[]>([]);
  const [editPrompt, setEditPrompt] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<Array<{ name: string; content: string }>>([]);
  const [askConversationId, setAskConversationId] = useState<string | null>(null);
  const [suggestions] = useState([
    "Générer des tests pour ce code",
    "Générer la documentation pour ce code",
    "Générer un rapport détaillé sur les tests pour ce code"
  ]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [currentFileContents, setCurrentFileContents] = useState<Record<string, string>>({});
  const [originalFileContents, setOriginalFileContents] = useState<Record<string, string>>({});
  const [editAppliedMessage, setEditAppliedMessage] = useState<string | null>(null);

  // Add responsive state
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = authToken;
        if (!token) return;

        const decoded = jwtDecode<JwtPayload>(token);
        const response = await fetch(`http://localhost:5000/v1/api/users/${decoded.userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) throw new Error('Failed to fetch user data');
        const userData = await response.json();
        setUser(userData.data);
      } catch (err) {
        console.error('Error fetching user data:', err);
      }
    };

    fetchUserData();
  }, [authToken]);

  const isBinaryFile = (fileName: string): boolean => {
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'ico', 'pdf'];
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv'];
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return imageExtensions.includes(ext) || videoExtensions.includes(ext);
  };

  const handleNewChat = () => {
    setAskConversation([]);
    setEditConversation([]);
    setAskConversationId(null);
    setPrompt('');
    setEditPrompt('');
    // Only clear dropped files in ask mode, keep them in edit mode for better UX
    if (mode === 'ask') {
      setDroppedFiles([]);
      setCurrentFileContents({});
      setOriginalFileContents({});
    }
  };

  const handleLeaveRepo = () => {
    // Clear all sessionStorage entries for this repo
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.includes(`_${repoOwner}_`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));

    // Clear component state
    setDroppedFiles([]);
    setCurrentFileContents({});
    setOriginalFileContents({});
    setAskConversation([]);
    setEditConversation([]);
    setPrompt('');
    setEditPrompt('');
  };

  const handleSendPrompt = async () => {
    if ((!prompt.trim() && mode === 'ask') || (!editPrompt.trim() && mode === 'edit')) return;

    try {
      setIsGenerating(true);
      let newMessage: Message;
      let apiResponse: ApiResponse;

      if (mode === 'ask') {
        newMessage = { role: 'user', content: prompt };

        const response = await fetch('http://localhost:8000/ask', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            message: prompt,
            ...(askConversationId && { conversation_id: askConversationId })
          })
        });

        apiResponse = await response.json();
        console.info('API Response:', apiResponse);
        setAskConversationId(apiResponse.conversation_id || null);
        setAskConversation(prev => [
          ...prev,
          newMessage,
          { role: 'assistant', content: apiResponse.message }
        ]);

      } else {
        const files = droppedFiles.reduce((acc, file) => {
          // Use current file contents (modified version) not the original dropped content
          const currentContent = currentFileContents[file.name] || originalFileContents[file.name] || file.content;
          acc[file.name] = convertToLineFormat(currentContent);
          return acc;
        }, {} as Record<string, Record<number, string>>);

        const response = await fetch('http://localhost:8000/edit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            prompt: editPrompt,
            files,
            ...(askConversationId && { conversation_id: askConversationId })
          })
        });

        apiResponse = await response.json();

        // Extract and display only the message
        const assistantMessage = apiResponse.message;
        setAskConversationId(apiResponse.conversation_id || null);

        // --- Fix: Always show a message after changes are applied ---
        let changesApplied = false;
        if (apiResponse.tool_calls && apiResponse.tool_calls.length > 0) {
          processToolCalls(apiResponse.tool_calls, files);
          changesApplied = true;
        }

        setEditConversation(prev => [
          ...prev,
          { role: 'user', content: editPrompt },
          {
            role: 'assistant',
            content:
              (assistantMessage && assistantMessage.trim()) ?
                assistantMessage :
                (changesApplied
                  ? "✅ Changes applied. If you need further assistance feel free to ask. Happy coding 🚀"
                  : "No changes were applied. If you need further assistance feel free to ask. Happy coding 🚀"),
            //tool_calls: apiResponse.tool_calls
          }
        ]);

        if (changesApplied) {
          setEditAppliedMessage("Changes applied. If you need further assistance feel free to ask. Happy coding 🚀");
          setTimeout(() => setEditAppliedMessage(null), 3500);
        }
      }

      setPrompt('');
      setEditPrompt('');
      // Don't clear dropped files in edit mode - keep them for better UX
      if (mode === 'ask') {
        setDroppedFiles([]);
      }

    } catch (error) {
      console.error('API Error:', error);

      // Update the appropriate conversation state based on the current mode
      if (mode === 'ask') {
        setAskConversation(prev => [
          ...prev,
          { role: 'assistant', content: 'Error processing your request. Please try again.' }
        ]);
      } else {
        setEditConversation(prev => [
          ...prev,
          { role: 'assistant', content: 'Error processing your request. Please try again.' }
        ]);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const processToolCalls = (toolCalls: ToolCall[], files: Record<string, Record<number, string>>) => {
    toolCalls.forEach(toolCall => {
      console.info(`Processing tool call: ${toolCall.name}`);

      if (toolCall.name === 'edit_file_lines') {
        console.info('Handling edit_file_lines tool call');
        toolCall.args.changes.forEach(change => {
          console.info(`Processing change for file: ${change.file_name}`);
          const fileName = change.file_name;
          // Use current file contents if available, otherwise fall back to original
          const sessionKey = `file_content_${repoOwner}_${fileName}`;
          const currentContent = sessionStorage.getItem(sessionKey) ||
                                currentFileContents[fileName] ||
                                originalFileContents[fileName] ||
                                Object.values(files[fileName] || {}).join('\n');
          const fileContent = convertToLineFormat(currentContent);

          console.info(`File content retrieved: ${!!fileContent}`);
          if (fileContent && change.edits) {
            console.info(`Processing ${change.edits.length} edits`);

            // Process edits in reverse order to handle line shifts
            const sortedEdits = [...change.edits].sort((a, b) => b.line_start - a.line_start);
            sortedEdits.forEach(edit => {
              console.info(`Processing edit from line ${edit.line_start} to ${edit.line_end}`);

              // Determine if we're replacing a single line or a range
              const isSingleLine = edit.line_start === edit.line_end;
              console.info(`Edit type: ${isSingleLine ? 'single line' : 'range'}`);

              // Remove original lines
              console.info(`Removing lines from ${edit.line_start} to ${edit.line_end}`);
              const removedLinesCount = edit.line_end - edit.line_start + 1;
              const removedLines = [];

              for (let line = edit.line_start; line <= edit.line_end; line++) {
                if (fileContent[line] !== undefined) {
                  removedLines.push(fileContent[line]);
                  console.info(`Deleting line ${line}: ${fileContent[line]}`);
                  delete fileContent[line];
                }
              }

              // Insert new content
              console.info(`Inserting new content: ${edit.new_content}`);
              const newLines = edit.new_content.split('\n');
              const newLinesCount = newLines.length;
              const lineDifference = newLinesCount - removedLinesCount;

              // Store lines after the edit range to shift them later
              const linesToShift = [];
              let firstLineToShift = edit.line_start;

              // For single line replacement, we don't need to shift
              if (!isSingleLine) {
                // Collect lines after the edit range
                const allLines = Object.entries(fileContent)
                  .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

                for (const [key, value] of allLines) {
                  const lineNum = parseInt(key);
                  if (lineNum > edit.line_end) {
                    linesToShift.push({ lineNum, value });
                  } else if (lineNum > edit.line_start) {
                    firstLineToShift = Math.min(firstLineToShift, lineNum);
                  }
                }
              }

              // Insert new lines
              newLines.forEach((content, index) => {
                const lineNum = edit.line_start + index;
                console.info(`Inserting line ${lineNum}: ${content}`);
                fileContent[lineNum] = content;
              });

              // Shift subsequent lines if needed (only for range edits)
              if (!isSingleLine && lineDifference !== 0) {
                console.info(`Shifting ${linesToShift.length} lines by ${lineDifference}`);

                // First, remove the lines that will be shifted
                linesToShift.forEach(({ lineNum }) => {
                  delete fileContent[lineNum];
                });

                // Then insert them at their new positions
                linesToShift.forEach(({ lineNum, value }) => {
                  const newLineNum = lineNum + lineDifference;
                  console.info(`Moving line ${lineNum} to ${newLineNum}`);
                  fileContent[newLineNum] = value;
                });
              }
            });

            // Update editor
            console.info('Updating editor with new content');
            const sortedLines = Object.entries(fileContent)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([_, value]) => value);
            const updatedContent = sortedLines.join('\n');
            // Update sessionStorage with new content
            sessionStorage.setItem(sessionKey, updatedContent);
            onApplyChanges(fileName, updatedContent, true);
            setCurrentFileContents(prev => ({
              ...prev,
              [fileName]: updatedContent
            }));
          }
        });
      }
      else if (toolCall.name === 'insert_code_at_lines') {
        console.info('Handling insert_code_at_lines tool call');
        toolCall.args.changes.forEach(change => {
          console.info(`Processing change for file: ${change.file_name}`);
          const fileName = change.file_name;
          // Get current content from sessionStorage or fallback to state
          const sessionKey = `file_content_${repoOwner}_${fileName}`;
          const currentContent = sessionStorage.getItem(sessionKey) ||
                                currentFileContents[fileName] ||
                                originalFileContents[fileName] ||
                                Object.values(files[fileName] || {}).join('\n');

          if (change.insertions) {
            console.info(`Processing ${change.insertions.length} insertions`);

            // Process insertions in reverse order to handle line shifts
            const sortedInsertions = [...change.insertions].sort((a, b) => b.insert_line - a.insert_line);

            // Convert current content to array of lines for easier manipulation
            let contentLines = currentContent.split('\n');

            sortedInsertions.forEach(insertion => {
              console.info(`Inserting code at line ${insertion.insert_line}`);

              // Split the new code into lines
              const newLines = insertion.code.split('\n');

              // Insert the new lines at the specified position
              // insert_line is 1-based, so we need to adjust for 0-based array indexing
              const insertIndex = insertion.insert_line - 1;

              // Insert new lines without removing existing ones
              contentLines.splice(insertIndex, 0, ...newLines);
            });

            // Update the file content
            const updatedContent = contentLines.join('\n');

            // Update sessionStorage with new content
            sessionStorage.setItem(sessionKey, updatedContent);

            onApplyChanges(fileName, updatedContent, true);
            setCurrentFileContents(prev => ({
              ...prev,
              [fileName]: updatedContent
            }));
          }
        });
      }
    });
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt();
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    const filePath = e.dataTransfer.getData('text/plain') || '';
    const fileName = filePath.split('/').pop() || '';

    if (isBinaryFile(fileName)) {
      alert('Binary files (images, videos, PDFs) cannot be dropped here.');
      return;
    }

    // Check if file is already dropped to avoid duplicates
    if (droppedFiles.some(file => file.name === fileName)) {
      return; // File already exists, don't add duplicate
    }

    try {
      const response = await fetch(
        `http://localhost:5000/v1/api/preview/content?relativePath=${encodeURIComponent(filePath)}&ownername=${encodeURIComponent(repoOwner)}`,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );

      if (!response.ok) throw new Error('Failed to fetch file content');
      const data = await response.json();
      if (data.data.type !== 'file') throw new Error('Dropped item is not a file');

      const fetchedContent = data.data.content;

      // Check if this is the first time dropping this file in this session
      const originalKey = `original_file_content_${repoOwner}_${fileName}`;
      const currentKey = `file_content_${repoOwner}_${fileName}`;

      // If no original content exists in sessionStorage, this is first time - store backend content
      if (!sessionStorage.getItem(originalKey)) {
        sessionStorage.setItem(originalKey, fetchedContent);
        sessionStorage.setItem(currentKey, fetchedContent);

        setDroppedFiles(prev => [...prev, {
          name: fileName,
          content: fetchedContent
        }]);

        setOriginalFileContents(prev => ({
          ...prev,
          [fileName]: fetchedContent
        }));

        setCurrentFileContents(prev => ({
          ...prev,
          [fileName]: fetchedContent
        }));
      } else {
        // File was previously dropped, use current content from sessionStorage
        const storedCurrentContent = sessionStorage.getItem(currentKey) || fetchedContent;
        const storedOriginalContent = sessionStorage.getItem(originalKey) || fetchedContent;

        setDroppedFiles(prev => [...prev, {
          name: fileName,
          content: storedCurrentContent
        }]);

        setOriginalFileContents(prev => ({
          ...prev,
          [fileName]: storedOriginalContent
        }));

        setCurrentFileContents(prev => ({
          ...prev,
          [fileName]: storedCurrentContent
        }));
      }

    } catch (err) {
      console.error('Error fetching file content:', err);
      alert('Failed to load file content. Please try again.');
    }
  };

  const handleRemoveFile = (index: number) => {
    const fileToRemove = droppedFiles[index];
    if (fileToRemove) {
      // Remove from sessionStorage when explicitly removed
      const originalKey = `original_file_content_${repoOwner}_${fileToRemove.name}`;
      const currentKey = `file_content_${repoOwner}_${fileToRemove.name}`;
      sessionStorage.removeItem(originalKey);
      sessionStorage.removeItem(currentKey);

      // Remove from state
      setDroppedFiles(prev => prev.filter((_, i) => i !== index));
      setCurrentFileContents(prev => {
        const newContents = { ...prev };
        delete newContents[fileToRemove.name];
        return newContents;
      });
      setOriginalFileContents(prev => {
        const newContents = { ...prev };
        delete newContents[fileToRemove.name];
        return newContents;
      });
    }
  };

  // Add style for bouncing dots animation
  const bounceAnimation = `
    @keyframes bounce {
      0%, 100% { transform: translateY(0); opacity: 0.75; }
      50% { transform: translateY(-3px); opacity: 1; }
    }
  `;

  const renderHeader = () => (
    <div className={`p-3 lg:p-4 flex items-center justify-between border-b ${
      darkMode ? 'border-gray-800' : 'border-gray-200'
    }`}>
      <div className="flex items-center gap-2">
        <div className={`w-6 h-6 lg:w-8 lg:h-8 rounded-full flex items-center justify-center ${
          darkMode ? 'bg-violet-600' : 'bg-cyan-600'
        }`}>
          <Bot size={isMobile ? 14 : 16} className="text-white" />
        </div>
        <h3 className={`font-medium text-sm lg:text-base ${
          darkMode ? 'text-white' : 'text-gray-800'
        }`}>
          {isMobile ? 'AI Assistant' : 'ShareCode Agent'}
        </h3>
        {isGenerating && (
          <div className="flex items-center space-x-1 ml-2">
            {[0.1, 0.2, 0.3].map((delay, i) => (
              <span
                key={i}
                className={`inline-block w-1 h-1 lg:w-1.5 lg:h-1.5 rounded-full ${
                  darkMode ? 'bg-violet-400' : 'bg-cyan-500'
                } animate-bounce`}
                style={{ animationDelay: `${delay}s` }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={handleNewChat}
          className={`p-1 lg:p-1.5 rounded-md ${
            darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
          }`}
          title="New chat"
        >
          <Plus size={isMobile ? 16 : 18} />
        </button>
        {!isMobile && (
          <button
            className={`p-1 lg:p-1.5 rounded-md ${
              darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <ChevronDown size={18} />
          </button>
        )}
        <button
          onClick={onClose}
          className={`p-1 lg:p-1.5 rounded-md ${
            darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
          }`}
        >
          <X size={isMobile ? 16 : 18} />
        </button>
      </div>
    </div>
  );

  // Modified generate button content
  const generateButtonContent = isGenerating ? (
    <div className="flex items-center gap-2">
      <div className="flex space-x-1">
        <span className={`w-1.5 h-1.5 rounded-full ${darkMode ? 'bg-violet-400' : 'bg-cyan-500'} animate-bounce`} />
        <span className={`w-1.5 h-1.5 rounded-full ${darkMode ? 'bg-violet-400' : 'bg-cyan-500'} animate-bounce`}
          style={{ animationDelay: '0.15s' }} />
        <span className={`w-1.5 h-1.5 rounded-full ${darkMode ? 'bg-violet-400' : 'bg-cyan-500'} animate-bounce`}
          style={{ animationDelay: '0.3s' }} />
      </div>
      Generating...
    </div>
  ) : (
    <>
      <CheckCircle2 size={14} />
      Generate Changes
    </>
  );

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [prompt, editPrompt]);

  // Responsive breakpoint detection
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const renderConversation = (currentConversation: Message[]) => {
    const markdownComponents: MarkdownComponents = {
      code({ node, inline, className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || '');
        return !inline && match ? (
          <div className="my-2 overflow-hidden">
            <SyntaxHighlighter
              style={darkMode ? dracula : prism}
              language={match[1]}
              PreTag="div"
              className="!text-xs lg:!text-sm overflow-x-auto rounded-md"
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          </div>
        ) : (
          <code
            className={`${className} ${
              darkMode ? 'bg-gray-800 text-gray-100' : 'bg-gray-100 text-gray-800'
            } px-1 lg:px-1.5 py-0.5 rounded text-xs lg:text-sm`}
            {...props}
          >
            {children}
          </code>
        );
      },
      pre({ node, children, ...props }) {
        return <div className="my-2">{children}</div>;
      },
    };

    return currentConversation.map((message, index) => (
      <div
        key={index}
        className={`mb-3 lg:mb-4 ${message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}
      >
        <div className={`flex items-start gap-2 lg:gap-3 ${
          message.role === 'user' ? 'flex-row-reverse' : ''
        } max-w-[95%] lg:max-w-[90%]`}>
          {/* Responsive Avatar */}
          {message.role === 'assistant' && (
            <div className={`flex-shrink-0 w-6 h-6 lg:w-8 lg:h-8 rounded-full ${
              darkMode ? 'bg-violet-600' : 'bg-cyan-600'
            } flex items-center justify-center`}>
              <Bot size={isMobile ? 12 : 16} className="text-white" />
            </div>
          )}

          {message.role === 'user' && (
            <div className="flex-shrink-0 w-6 h-6 lg:w-8 lg:h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center overflow-hidden">
              {user?.avatar_path ? (
                <img
                  src={`http://localhost:5000${user.avatar_path}`}
                  alt={user.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white text-xs font-medium">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </span>
              )}
            </div>
          )}

          {/* Responsive Message Bubble */}
          <div
            className={`p-2 lg:p-3 rounded-lg w-full ${
              message.role === 'user'
                ? darkMode
                  ? 'bg-gray-800 text-white'
                  : 'bg-white text-gray-800 border border-gray-200'
                : darkMode
                  ? 'bg-violet-600/20 text-gray-100'
                  : 'bg-cyan-50 text-gray-800'
            }`}
          >
            {message.tool_calls && (
              <div className="mb-3 lg:mb-4">
                <h4 className="text-xs lg:text-sm font-medium mb-2">Suggested Changes:</h4>
                {message.tool_calls.map((toolCall, tcIndex) => (
                  <div key={tcIndex} className="mb-3">
                    <div className={`p-2 lg:p-3 rounded-md ${
                      darkMode ? 'bg-gray-900' : 'bg-gray-100'
                    }`}>
                      <pre className="text-xs whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(toolCall, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="prose prose-sm lg:prose max-w-none overflow-x-auto">
              <ReactMarkdown
                components={markdownComponents}
                remarkPlugins={[remarkGfm]}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    ));
  };

  return (
    <div
      className={`h-full flex flex-col ${darkMode ? 'bg-gray-900' : 'bg-white'} ${
        isDraggingOver ? (darkMode ? 'border-2 border-violet-500' : 'border-2 border-cyan-500') : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
    >
      <style>{bounceAnimation}</style>

      {renderHeader()}

      {/* Responsive Mode Selector */}
      <div className={`flex border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
        <button
          onClick={() => setMode('ask')}
          className={`flex-1 py-2 lg:py-2.5 text-xs lg:text-sm font-medium flex items-center justify-center gap-1 lg:gap-1.5 ${
            mode === 'ask'
              ? darkMode
                ? 'bg-gray-800 text-violet-400 border-b-2 border-violet-500'
                : 'bg-gray-50 text-cyan-600 border-b-2 border-cyan-500'
              : darkMode
                ? 'text-gray-400 hover:bg-gray-800/50'
                : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <MessageSquare size={isMobile ? 14 : 16} />
          Ask
        </button>
        <button
          onClick={() => setMode('edit')}
          className={`flex-1 py-2 lg:py-2.5 text-xs lg:text-sm font-medium flex items-center justify-center gap-1 lg:gap-1.5 ${
            mode === 'edit'
              ? darkMode
                ? 'bg-gray-800 text-violet-400 border-b-2 border-violet-500'
                : 'bg-gray-50 text-cyan-600 border-b-2 border-cyan-500'
              : darkMode
                ? 'text-gray-400 hover:bg-gray-800/50'
                : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Code size={isMobile ? 14 : 16} />
          Edit
        </button>
      </div>

      {/* Responsive Content Area */}
      <div className="flex-1 overflow-y-auto">
        {mode === 'ask' && askConversation.length === 0 && (
          <div className="space-y-4 lg:space-y-6 py-3 lg:py-4">
            <div className="text-center">
              <div className={`mx-auto w-10 h-10 lg:w-12 lg:h-12 flex items-center justify-center rounded-full ${
                darkMode ? 'bg-violet-600/20' : 'bg-cyan-50'
              } mb-2 lg:mb-3`}>
                <Zap size={isMobile ? 18 : 20} className={darkMode ? 'text-violet-400' : 'text-cyan-600'} />
              </div>
              <h3 className={`font-medium text-base lg:text-lg ${
                darkMode ? 'text-white' : 'text-gray-800'
              }`}>
                {isMobile ? 'AI Assistant' : 'ShareCode Assistant'}
              </h3>
              <p className={`mt-1 text-xs lg:text-sm ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Ask questions or get help with your code
              </p>
            </div>

            <div className="space-y-2 px-3 lg:px-4">
              <p className={`text-xs font-medium ${
                darkMode ? 'text-gray-500' : 'text-gray-500'
              }`}>
                SUGGESTED PROMPTS
              </p>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => setPrompt(suggestion)}
                  className={`w-full text-left p-2 lg:p-2.5 rounded-lg text-xs lg:text-sm flex items-center gap-2 ${
                    darkMode
                      ? 'bg-gray-800/70 text-gray-300 hover:bg-gray-800'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  } transition-colors`}
                >
                  <Play size={isMobile ? 12 : 14} className={darkMode ? 'text-violet-400' : 'text-cyan-600'} />
                  <span className="truncate">{suggestion}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'edit' && editConversation.length === 0 && (
          <div className="space-y-4 lg:space-y-6 py-3 lg:py-4">
            <div className="text-center">
              <div className={`mx-auto w-10 h-10 lg:w-12 lg:h-12 flex items-center justify-center rounded-full ${
                darkMode ? 'bg-violet-600/20' : 'bg-cyan-50'
              } mb-2 lg:mb-3`}>
                <FileCode2 size={isMobile ? 18 : 20} className={darkMode ? 'text-violet-400' : 'text-cyan-600'} />
              </div>
              <h3 className={`font-medium text-base lg:text-lg ${
                darkMode ? 'text-white' : 'text-gray-800'
              }`}>
                Code Edit Mode
              </h3>
              <p className={`mt-1 text-xs lg:text-sm ${
                darkMode ? 'text-gray-400' : 'text-gray-600'
              } px-2`}>
                {isMobile ? 'Drop files and describe changes' : 'Paste code below and describe how you want to modify it'}
              </p>
            </div>
          </div>
        )}

        {/* Responsive Conversation Messages */}
        <div className="px-2 lg:px-4">
          {mode === 'ask' && askConversation.length > 0 && (
            <div>
              {renderConversation(askConversation)}
              <div ref={chatEndRef} />
            </div>
          )}

          {mode === 'edit' && editConversation.length > 0 && (
            <div>
              {renderConversation(editConversation)}
              <div ref={chatEndRef} />
              {/* Show changes applied message after edit tool call */}
              {editAppliedMessage && (
                <div className={`mt-4 flex items-center gap-2 p-3 rounded-lg font-medium text-sm ${
                  darkMode
                    ? 'bg-violet-700/20 text-violet-200'
                    : 'bg-cyan-100 text-cyan-700'
                }`}>
                  <span>✅</span>
                  <span>{editAppliedMessage}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Responsive Input Area */}
      <div className={`p-3 lg:p-4 border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
        {mode === 'ask' ? (
          <div className="relative">
            <FilePreview
              files={droppedFiles}
              onRemove={handleRemoveFile}
              darkMode={darkMode}
              currentFileContents={currentFileContents}
            />
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask ShareCode Agent..."
              className={`w-full px-3 lg:px-4 py-2 lg:py-3 pr-10 lg:pr-12 rounded-lg resize-none overflow-y-auto text-xs lg:text-sm ${
                darkMode
                  ? 'bg-gray-800 text-gray-100 placeholder-gray-500 border-gray-700'
                  : 'bg-gray-50 text-gray-800 placeholder-gray-400 border-gray-200'
              } border focus:outline-none focus:ring-1 ${
                darkMode ? 'focus:ring-violet-500' : 'focus:ring-cyan-500'
              } transition-all duration-200`}
              style={{
                minHeight: isMobile ? '2.5rem' : '3rem',
                maxHeight: isMobile ? '10rem' : '15rem'
              }}
            />
            <button
              onClick={handleSendPrompt}
              disabled={!prompt.trim() || isGenerating}
              className={`absolute right-2 ${isMobile ? 'bottom-1.5' : 'bottom-2'} p-1.5 lg:p-2 rounded-md ${
                prompt.trim() && !isGenerating
                  ? darkMode
                    ? 'text-violet-400 hover:bg-gray-700'
                    : 'text-cyan-600 hover:bg-gray-100'
                  : darkMode
                    ? 'text-gray-600'
                    : 'text-gray-400'
              } transition-colors`}
            >
              <Send size={isMobile ? 14 : 16} />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <FilePreview
              files={droppedFiles}
              onRemove={handleRemoveFile}
              darkMode={darkMode}
              currentFileContents={currentFileContents}
            />
            {droppedFiles.length === 0 && (
              <div className={`text-center py-4 px-3 border-2 border-dashed rounded-lg ${
                darkMode
                  ? 'border-gray-700 text-gray-500'
                  : 'border-gray-300 text-gray-400'
              }`}>
                <File size={24} className={`mx-auto mb-2 ${
                  darkMode ? 'text-gray-600' : 'text-gray-400'
                }`} />
                <p className="text-xs lg:text-sm">
                  {isMobile ? 'Drag files here' : 'Drag and drop files here to start editing'}
                </p>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              placeholder={isMobile ?
                "Describe the changes you want..." :
                "Describe what changes you want to make to the files above..."
              }
              className={`w-full p-2 lg:p-3 rounded-lg resize-none text-xs lg:text-sm ${
                darkMode
                  ? 'bg-gray-800 text-gray-100 placeholder-gray-500 border-gray-700'
                  : 'bg-gray-50 text-gray-800 placeholder-gray-400 border-gray-200'
              } border focus:outline-none focus:ring-1 ${
                darkMode ? 'focus:ring-violet-500' : 'focus:ring-cyan-500'
              } transition-all duration-200`}
              style={{
                minHeight: isMobile ? '6rem' : '8rem',
                maxHeight: isMobile ? '12rem' : '20rem'
              }}
            />
            <div className="flex justify-end">
              <button
                onClick={handleSendPrompt}
                disabled={!editPrompt.trim() || isGenerating || droppedFiles.length === 0}
                className={`px-3 lg:px-4 py-2 rounded-md flex items-center gap-1 lg:gap-1.5 text-xs lg:text-sm ${
                  editPrompt.trim() && !isGenerating && droppedFiles.length > 0
                    ? darkMode
                      ? 'bg-violet-600 hover:bg-violet-700 text-white'
                      : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                    : darkMode
                      ? 'bg-gray-800 text-gray-500'
                      : 'bg-gray-100 text-gray-400'
                } transition-colors font-medium`}
              >
                {isGenerating ? (
                  <div className="flex items-center gap-1 lg:gap-2">
                    <div className="flex space-x-1">
                      {[0, 0.15, 0.3].map((delay, i) => (
                        <span
                          key={i}
                          className={`w-1 h-1 lg:w-1.5 lg:h-1.5 rounded-full ${
                            darkMode ? 'bg-violet-400' : 'bg-cyan-500'
                          } animate-bounce`}
                          style={{ animationDelay: `${delay}s` }}
                        />
                      ))}
                    </div>
                    {!isMobile && 'Generating...'}
                  </div>
                ) : (
                  <>
                    <CheckCircle2 size={isMobile ? 12 : 14} />
                    <span>{isMobile ? 'Generate' : 'Generate Changes'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareCodeAgent;
