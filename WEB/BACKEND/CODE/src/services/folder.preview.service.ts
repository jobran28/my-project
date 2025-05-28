import { injectable, inject } from 'inversify'; // Updated import
import { exec } from 'child_process';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as util from 'util';
import { ApiResponse, ResponseStatus } from '../DTO/apiResponse.DTO';
import { UserRepository } from '../repositories/user.repository';
import { TYPES } from '../di/types';

const execPromise = util.promisify(exec);

interface PathValidationSuccess {
    fullPath: string;
    normalizedPath: string;
    userTempWorkdirPath: string;
}

interface FileDetails {
    name: string;
    type: 'folder' | 'file';
    size: number;
    lastModified: Date;
}

interface FolderContent {
    type: 'folder';
    path: string;
    content: FileDetails[];
}

interface FileContent {
    type: 'file';
    path: string;
    content: string | null; // Modified to allow null for binary files
    size: number;
    lastModified: Date;
    isBinary?: boolean; // Added flag to indicate if the file is binary
}

interface RenameResult {
    oldPath: string;
    newPath: string;
}

@injectable() // Added decorator
export class FolderPreviewService {
    private readonly sourceGitPathRoot = '/srv/git/';

    constructor(@inject(TYPES.UserRepository) private userRepository: UserRepository) {
        // Initialization logic for the service, if any, would go here.
    }

    /**
     * Get user-specific source git path
     */
    private getUserSourceGitPath(username: string): string {
        return path.join(this.sourceGitPathRoot, username);
    }

    /**
     * Get user-specific temporary workdir path
     */
    private getUserTempWorkdirPath(username: string): string {
        const userSourcePath = this.getUserSourceGitPath(username);
        return path.join(userSourcePath, 'temp-working-directory');
    }

    /**
     * Helper to resolve and validate path within user's temp workdir.
     * Returns an ApiResponse indicating success or failure.
     */
    private async resolveAndValidatePath(username: string, relativePath: string | undefined | null): Promise<ApiResponse<PathValidationSuccess | null>> {
        const userTempWorkdirPath = this.getUserTempWorkdirPath(username);
        console.log(`User temp wo------------------------------------------------------rkdir path: ${userTempWorkdirPath}`);

        // Ensure the user's temp directory exists before proceeding
        try {
            await fsp.access(userTempWorkdirPath);
        } catch (error) {
            // If the directory doesn't exist, it might be okay if we are cloning,
            // but for other operations, it's an error. We'll handle this contextually.
            return { status: ResponseStatus.FAILED, message: `User temporary directory not found for ${username}`, error: 'User directory missing' };
        }

        if (!relativePath || typeof relativePath !== 'string') {
            return { status: ResponseStatus.FAILED, message: 'Path parameter is required and must be a string', error: 'Invalid path parameter' };
        }

        // Ensure path is relative and safe (no path traversal)
        const normalizedPath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
        // Construct full path within the user's temp directory
        const fullPath = path.resolve(userTempWorkdirPath, normalizedPath);
        console.log("===========================================================================================================");
        console.log(`Resolved full path: ${fullPath}`);

        // Verification Step: Check if the resolved path is still within the user's allowed directory
        const resolvedUserTempWorkdirPath = path.resolve(userTempWorkdirPath);
        // Allow access to the workdir itself, not just subdirectories
        if (!fullPath.startsWith(resolvedUserTempWorkdirPath + path.sep) && fullPath !== resolvedUserTempWorkdirPath) {
            return { status: ResponseStatus.FAILED, message: 'Access denied: Path is outside the allowed directory.', error: 'Path traversal attempt' };
        }

        return { status: ResponseStatus.SUCCESS, message: 'Path validated successfully', data: { fullPath, normalizedPath, userTempWorkdirPath } };
    }

    /**
     * Clones a Git repository from source location to temp workdir.
     */
    public async cloneRepo(username: string, repoName: string): Promise<ApiResponse<string | null>> {
        const userSourceGitPath = this.getUserSourceGitPath(username);
        const userTempWorkdirPath = this.getUserTempWorkdirPath(username);
        const sourcePath = path.join(userSourceGitPath, repoName);
        const targetPath = path.join(userTempWorkdirPath, repoName);

        try {
            // Check if source exists
            try {
                await fsp.access(sourcePath);
            } catch (error) {
                console.error('Error in source existence check:', error);
                return { status: ResponseStatus.FAILED, message: `Repository ${repoName} not found for user ${username}`, error: 'Source repository not found' };
            }

            // Create user-specific target directory (temp-working-directory) if it doesn't exist
            await fsp.mkdir(userTempWorkdirPath, { recursive: true });

            // Remove existing target repository directory if it exists, before cloning
            try {
                await fsp.rm(targetPath, { recursive: true, force: true });
            } catch (error: any) {
                console.error('Error while removing existing target directory:', error);
                if (error.code !== 'ENOENT') throw error;
            }

            // Clone the repository using Git
            try {
                const exists = await fsp.access(targetPath).then(() => true).catch(() => false);
                console.log(`Source path: ${sourcePath}`);
                console.log(`User source git path: ${userSourceGitPath}`);
                console.log(`Target path: ${targetPath}`);
                console.log(`11111111111122222222222222Target path exists: ${exists}`);

                if (exists) {
                    return {
                        status: ResponseStatus.SUCCESS,
                        message: `Repository ${repoName} already exists at ${targetPath}`,
                        data: path.join('temp-working-directory', repoName)
                    };
                }
                // First, remove the target directory if it exists
                const rmResult = await execPromise(`rm -rf "${targetPath}"`).catch(err => {
                    console.log('Remove directory output:', err.stdout);
                    return { stdout: '', stderr: '' }; // Continue even if directory doesn't exist
                });
                console.log('Remove directory output:', rmResult.stdout);

                // Then perform the clone operation
                const cloneResult = await execPromise(`git clone "${sourcePath}" "${targetPath}"`);
                console.log('Clone operation output:', cloneResult.stdout);
            } catch (error) {
                console.error('Error during git clone operation:', error);
                throw error;
            }

            return {
                status: ResponseStatus.SUCCESS,
                message: `Repository ${repoName} successfully cloned to ${targetPath}`,
                data: path.join('temp-working-directory', repoName)
            };
        } catch (error: any) {
            console.error('Error in main cloneRepo try block:', error);
            return { status: ResponseStatus.FAILED, message: 'Failed to clone repository error from service ', error: error.stderr || error.message || 'Unknown error during clone' };
        }
    }

    /**
     * Pushes changes from the temp workdir back to the source repository.
     */
    public async pushRepo(username: string, repoName: string, commitMessage: string = 'Update from web editor'): Promise<ApiResponse<string | null>> {
        const userSourceGitPath = this.getUserSourceGitPath(username);
        const userTempWorkdirPath = this.getUserTempWorkdirPath(username);
        const tempRepoPath = path.join(userTempWorkdirPath, repoName);
        const sourceRepoPath = path.join(userSourceGitPath, repoName);

        try {
            // Get user's email from repository
            const userResult = await this.userRepository.findByUsername2(username);
            if (userResult.status === ResponseStatus.FAILED || !userResult.data) {
                return { 
                    status: ResponseStatus.FAILED, 
                    message: `User ${username} not found`, 
                    error: 'User not found' 
                };
            }
            const userEmail = userResult.data.email;

            // Check if the temp repo directory exists
            try {
                await fsp.access(tempRepoPath);
            } catch (error) {
                return { 
                    status: ResponseStatus.FAILED, 
                    message: `Temporary repository ${repoName} not found for user ${username}`, 
                    error: 'Temporary repository not found' 
                };
            }

            // Check if the source repo directory exists
            try {
                await fsp.access(sourceRepoPath);
            } catch (error) {
                return { 
                    status: ResponseStatus.FAILED, 
                    message: `Source repository ${repoName} not found for user ${username}`, 
                    error: 'Source repository not found' 
                };
            }

            // Configure Git user for this commit (Optional but good practice, keep it)
            await execPromise(`cd "${tempRepoPath}" && git config user.name "${username}" && git config user.email "${userEmail}"`);

            // Stage all changes
            await execPromise(`cd "${tempRepoPath}" && git add --all`);

            // Commit changes with specific author and provided message
            const authorInfo = `${username} <${userEmail}>`;
            try {
                await execPromise(`cd "${tempRepoPath}" && git commit --author="${authorInfo.replace(/"/g, '\\"')}" -m "${commitMessage.replace(/"/g, '\\"')}"`);
            } catch (err: any) {
                // Log full error output for debugging
                console.error('Git commit failed:', {
                    message: err.message,
                    stdout: err.stdout,
                    stderr: err.stderr,
                    code: err.code
                });
                // If no changes to commit, we can still try to push (in case of unpushed commits)
                if (err.stderr && err.stderr.includes('nothing to commit')) {
                    // Proceed to push
                } else {
                    // Return full error output
                    return {
                        status: ResponseStatus.FAILED,
                        message: 'Failed to commit changes',
                        error: `message: ${err.message}\nstdout: ${err.stdout}\nstderr: ${err.stderr}\ncode: ${err.code}`
                    };
                }
            }

            // Push changes back to the source repository
            try {
                await execPromise(`cd "${tempRepoPath}" && git push origin HEAD:master --force`);
            } catch (err: any) {
                // Log full error output for debugging
                console.error('Git push failed:', {
                    message: err.message,
                    stdout: err.stdout,
                    stderr: err.stderr,
                    code: err.code
                });
                return {
                    status: ResponseStatus.FAILED,
                    message: 'Failed to push repository',
                    error: `message: ${err.message}\nstdout: ${err.stdout}\nstderr: ${err.stderr}\ncode: ${err.code}`
                };
            }

            return {
                status: ResponseStatus.SUCCESS,
                message: `Repository ${repoName} successfully pushed to source`,
                data: path.join('temp-working-directory', repoName)
            };
        } catch (error: any) {
            console.error('Error pushing repository in service:', error);
            return { 
                status: ResponseStatus.FAILED, 
                message: 'Failed to push repository', 
                error: error.stderr || error.message || 'Unknown error during push' 
            };
        }
    }

    /**
     * Gets content of a file or directory within the user's temp workdir.
     */
    public async getPathContent(username: string, relativePath: string): Promise<ApiResponse<FolderContent | FileContent | null>> {
        const pathValidationResult = await this.resolveAndValidatePath(username, relativePath);
        console.log(`Checking existence ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++of path: ${relativePath}`);

        if (pathValidationResult.status === ResponseStatus.FAILED || !pathValidationResult.data) {
            return { status: ResponseStatus.FAILED, message: pathValidationResult.message, error: pathValidationResult.error };
        }
        const { fullPath, normalizedPath } = pathValidationResult.data;

        try {
            // Check existence first
             try {
                 await fsp.access(fullPath);
             } catch (error) {
                 return { status: ResponseStatus.FAILED, message: 'Path not found', error: 'ENOENT' };
             }

            const stats = await fsp.stat(fullPath);
            const fileExtension = path.extname(fullPath).toLowerCase();
            const binaryExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', // images
                                      '.mp4', '.mov', '.avi', '.wmv', '.mkv', '.flv', // videos
                                      '.mp3', '.wav', '.ogg', '.aac', '.flac','.ico','.pdf']; // audio

            if (stats.isDirectory()) {
                const items = await fsp.readdir(fullPath);
                const contentDetails = await Promise.all(
                    items.map(async (item) => {
                        const itemPath = path.join(fullPath, item);
                        let itemStat;
                        try {
                            itemStat = await fsp.stat(itemPath);
                            return {
                                name: item,
                                type: itemStat.isDirectory() ? 'folder' : 'file',
                                size: itemStat.size,
                                lastModified: itemStat.mtime,
                            } as FileDetails;
                        } catch (statError) {
                            console.warn(`Could not stat item ${itemPath}:`, statError);
                            return null; // Skip items that can't be stat-ed
                        }
                    })
                );

                const validContentDetails = contentDetails.filter(details => details !== null) as FileDetails[];

                return {
                    status: ResponseStatus.SUCCESS,
                    message: 'Folder content retrieved successfully',
                    data: {
                        type: 'folder',
                        path: normalizedPath,
                        content: validContentDetails
                    }
                };
            } else if (stats.isFile()) {
                if (binaryExtensions.includes(fileExtension)) {
                    return {
                        status: ResponseStatus.SUCCESS,
                        message: 'File is binary; returning path.',
                        data: {
                            type: 'file',
                            path: normalizedPath,
                            content: null, // Content is null for binary files
                            size: stats.size,
                            lastModified: stats.mtime,
                            isBinary: true
                        }
                    };
                } else {
                    const fileContent = await fsp.readFile(fullPath, 'utf8');
                    return {
                        status: ResponseStatus.SUCCESS,
                        message: 'File content retrieved successfully',
                        data: {
                            type: 'file',
                            path: normalizedPath,
                            content: fileContent,
                            size: stats.size,
                            lastModified: stats.mtime,
                            isBinary: false
                        }
                    };
                }
            } else {
                return { status: ResponseStatus.FAILED, message: 'Path is not a file or directory', error: 'Invalid path type' };
            }
        } catch (error: any) {
            console.error('Error fetching path content in service:', error);
            if (error.code === 'ENOENT') {
                return { status: ResponseStatus.FAILED, message: 'Path not found during content fetch', error: 'ENOENT' };
            }
            return { status: ResponseStatus.FAILED, message: 'Failed to fetch path content', error: error.message || 'Unknown error' };
        }
    }

    /**
     * Modifies file content within the user's temp workdir.
     */
    public async modifyFile(username: string, relativePath: string, newContent: string): Promise<ApiResponse<string | null>> {
        // Ensure the relativePath is handled safely (spaces, special chars)
        const pathValidationResult = await this.resolveAndValidatePath(username, relativePath);
        if (pathValidationResult.status === ResponseStatus.FAILED || !pathValidationResult.data) {
            return { status: ResponseStatus.FAILED, message: pathValidationResult.message, error: pathValidationResult.error };
        }
        const { fullPath, normalizedPath } = pathValidationResult.data;

        try {
            // Use fs.promises.stat with the absolute path (spaces are handled natively by Node.js)
            let stats;
            try {
                stats = await fsp.stat(fullPath);
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    return { status: ResponseStatus.FAILED, message: 'File not found', error: 'File not found', data: fullPath };
                }
                return { status: ResponseStatus.FAILED, message: 'Failed to stat file', error: error.message || 'Unknown error', data: fullPath };
            }

            if (!stats.isFile()) {
                return { status: ResponseStatus.FAILED, message: 'The specified path is not a file', error: 'Not a file', data: fullPath };
            }

            // Log the modification (absolute path, spaces preserved)
            const logMessage = [
                "===========================================================================================================================================================================",
                `Full path for modification: ${fullPath}`,
                "=============================================================================================================================================="
            ].join('\n');
            const logFilePath = path.resolve(__dirname, 'modification.log');
            await fsp.writeFile(logFilePath, logMessage + '\n', 'utf8');

            // Write the new content (spaces in path are handled by Node.js)
            await fsp.writeFile(fullPath, newContent, 'utf8');

            return {
                status: ResponseStatus.SUCCESS,
                message: 'File updated successfully',
                data: fullPath // Return absolute path here
            };

        } catch (error: any) {
            console.error('Error updating file in service:', error);
            return { status: ResponseStatus.FAILED, message: 'Failed to update file', error: error.message || 'Unknown error' };
        }
    }

    /**
     * Creates a file or folder within the user's temp workdir.
     */
    public async createItem(username: string, relativePath: string, type: 'file' | 'folder', content?: string): Promise<ApiResponse<{ path: string, type: 'file' | 'folder' } | null>> {
        const pathValidationResult = await this.resolveAndValidatePath(username, relativePath);
        if (pathValidationResult.status === ResponseStatus.FAILED || !pathValidationResult.data) {
            return { status: ResponseStatus.FAILED, message: pathValidationResult.message, error: pathValidationResult.error };
        }
        const { fullPath, normalizedPath } = pathValidationResult.data;

        try {
            // Check if item already exists using access (lighter than stat)
            try {
                await fsp.access(fullPath);
                // If access succeeds, the item exists
                return { status: ResponseStatus.FAILED, message: `Item already exists at path: ${normalizedPath}`, error: 'Item exists' };
            } catch (err: any) {
                if (err.code !== 'ENOENT') {
                    throw err; // Re-throw unexpected errors (e.g., permission issues)
                }
                // ENOENT means the path does not exist, which is good, continue creation
            }

            // Ensure parent directory exists
            const parentDir = path.dirname(fullPath);
            await fsp.mkdir(parentDir, { recursive: true });

            if (type === 'folder') {
                await fsp.mkdir(fullPath);
                return {
                    status: ResponseStatus.SUCCESS,
                    message: `Folder created successfully at ${normalizedPath}`,
                    data: { path: normalizedPath, type: 'folder' }
                };
            } else { // type === 'file'
                await fsp.writeFile(fullPath, content || '', 'utf8'); // Create file with optional content or empty
                return {
                    status: ResponseStatus.SUCCESS,
                    message: `File created successfully at ${normalizedPath}`,
                    data: { path: normalizedPath, type: 'file' }
                };
            }
        } catch (error: any) {
            console.error('Error creating item in service:', error);
            return { status: ResponseStatus.FAILED, message: 'Failed to create item', error: error.message || 'Unknown error' };
        }
    }

    /**
     * Removes a file or folder within the user's temp workdir.
     */
    public async removeItem(username: string, relativePath: string): Promise<ApiResponse<string | null>> {
        const pathValidationResult = await this.resolveAndValidatePath(username, relativePath);
        if (pathValidationResult.status === ResponseStatus.FAILED || !pathValidationResult.data) {
            return { status: ResponseStatus.FAILED, message: pathValidationResult.message, error: pathValidationResult.error };
        }
        const { fullPath, normalizedPath } = pathValidationResult.data;

        try {
            // Check if item exists before attempting removal using access
            try {
                await fsp.access(fullPath);
            } catch (error: any) {
                 if (error.code === 'ENOENT') {
                    return { status: ResponseStatus.FAILED, message: 'Item not found', error: 'Item not found' };
                 }
                 throw error; // Re-throw other access errors
            }


            // Remove file or directory (recursively)
            await fsp.rm(fullPath, { recursive: true, force: true });

            return {
                status: ResponseStatus.SUCCESS,
                message: `Item removed successfully from ${normalizedPath}`,
                data: normalizedPath
            };
        } catch (error: any) {
            console.error('Error removing item in service:', error);
            // ENOENT is handled above
            return { status: ResponseStatus.FAILED, message: 'Failed to remove item', error: error.message || 'Unknown error' };
        }
    }

    /**
     * Renames/moves a file or folder within the user's temp workdir.
     */
    public async renameItem(username: string, oldRelativePath: string, newRelativePath: string): Promise<ApiResponse<RenameResult | null>> {
        // Validate old path
        const oldPathValidation = await this.resolveAndValidatePath(username, oldRelativePath);
        if (oldPathValidation.status === ResponseStatus.FAILED || !oldPathValidation.data) {
            return { status: ResponseStatus.FAILED, message: `Old path error: ${oldPathValidation.message}`, error: oldPathValidation.error };
        }
        const { fullPath: oldFullPath, normalizedPath: normalizedOldPath } = oldPathValidation.data;

        // Validate new path
        const newPathValidation = await this.resolveAndValidatePath(username, newRelativePath);
        if (newPathValidation.status === ResponseStatus.FAILED || !newPathValidation.data) {
            return { status: ResponseStatus.FAILED, message: `New path error: ${newPathValidation.message}`, error: newPathValidation.error };
        }
        const { fullPath: newFullPath, normalizedPath: normalizedNewPath } = newPathValidation.data;

        try {
            // Check if old item exists using access
            try {
                await fsp.access(oldFullPath);
            } catch (err: any) {
                if (err.code === 'ENOENT') {
                    return { status: ResponseStatus.FAILED, message: `Source item not found at ${normalizedOldPath}`, error: 'Source not found' };
                }
                throw err; // Re-throw other errors
            }

            // Check if new path already exists using access
            try {
                await fsp.access(newFullPath);
                // If access succeeds, the target path exists
                return { status: ResponseStatus.FAILED, message: `Target path already exists at ${normalizedNewPath}`, error: 'Target exists' };
            } catch (err: any) {
                if (err.code !== 'ENOENT') {
                    throw err; // Re-throw unexpected errors
                }
                // ENOENT means the target path does not exist, which is good
            }

            // Ensure parent directory of the new path exists
            const newParentDir = path.dirname(newFullPath);
            await fsp.mkdir(newParentDir, { recursive: true });

            // Rename/move the item
            await fsp.rename(oldFullPath, newFullPath);

            return {
                status: ResponseStatus.SUCCESS,
                message: `Item successfully renamed/moved from ${normalizedOldPath} to ${normalizedNewPath}`,
                data: { oldPath: normalizedOldPath, newPath: normalizedNewPath }
            };
        } catch (error: any) {
            console.error('Error renaming item in service:', error);
            return { status: ResponseStatus.FAILED, message: 'Failed to rename item', error: error.message || 'Unknown error' };
        }
    }

    /**
     * Validates a path and returns the full file path if it's a valid file for streaming.
     */
    public async getFilePathForStreaming(username: string, relativePath: string): Promise<ApiResponse<string | null>> {
        const pathValidationResult = await this.resolveAndValidatePath(username, relativePath);
        if (pathValidationResult.status === ResponseStatus.FAILED || !pathValidationResult.data) {
            return { status: ResponseStatus.FAILED, message: pathValidationResult.message, error: pathValidationResult.error };
        }
        const { fullPath } = pathValidationResult.data;

        try {
            const stats = await fsp.stat(fullPath);
            if (!stats.isFile()) {
                return { status: ResponseStatus.FAILED, message: 'Path is not a file', error: 'Not a file' };
            }
            return { status: ResponseStatus.SUCCESS, message: 'File path retrieved for streaming', data: fullPath };
        } catch (error: any) {
            console.error('Error getting file path for streaming:', error);
            if (error.code === 'ENOENT') {
                return { status: ResponseStatus.FAILED, message: 'File not found for streaming', error: 'ENOENT' };
            }
            return { status: ResponseStatus.FAILED, message: 'Failed to get file path for streaming', error: error.message || 'Unknown error' };
        }
    }
}