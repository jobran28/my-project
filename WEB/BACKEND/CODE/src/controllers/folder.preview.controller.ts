import { Request, Response } from 'express';
import { FolderPreviewService } from '../services/folder.preview.service';
import { ApiResponse, ResponseStatus } from '../DTO/apiResponse.DTO';
import { injectable, inject } from 'inversify'; // Added imports
import { TYPES } from '../di/types'; // Added import (assuming types file exists)
import * as fs from 'fs'; // Added import for file system
import mime from 'mime'; // Changed import for mime types
import path from 'path'; // Added import for path

// Helper to determine HTTP status code based on API response
const getStatusCode = (response: ApiResponse<any>, successCode: number = 200, createdCode: number = 201): number => {
    if (response.status === ResponseStatus.FAILED) {
        // Basic mapping based on common error types/messages
        const msg = response.message?.toLowerCase() || '';
        const err = response.error?.toLowerCase() || '';

        if (msg.includes('not found') || err.includes('not found') || err.includes('enoent')) return 404;
        if (msg.includes('required') || msg.includes('invalid path') || msg.includes('parameter')) return 400;
        if (msg.includes('access denied') || msg.includes('outside the allowed directory')) return 403;
        if (msg.includes('already exists') || err.includes('exists')) return 409; // 409 Conflict
        if (msg.includes('authentication required') || err.includes('unauthorized')) return 401;
        if (msg.includes('not a file') || msg.includes('not a directory')) return 400; // Bad request if wrong type
        return 500; // Default server error for other failures
    }
    // Use 201 for successful creation, 200 otherwise
    return response.message?.toLowerCase().includes('created') ? createdCode : successCode;
};

@injectable() // Added decorator
export class FolderPreviewController {
    private folderPreviewService: FolderPreviewService;

    // Inject FolderPreviewService via the constructor using TYPES
    constructor(@inject(TYPES.FolderPreviewService) folderPreviewService: FolderPreviewService) {
        this.folderPreviewService = folderPreviewService;
        // Bind methods to ensure 'this' context is correct when used as route handlers
        this.cloneGitFolder = this.cloneGitFolder.bind(this);
        this.getPathContent = this.getPathContent.bind(this);
        this.modifyFileContent = this.modifyFileContent.bind(this);
        this.createItem = this.createItem.bind(this);
        this.removeItem = this.removeItem.bind(this);
        this.renameItem = this.renameItem.bind(this);
        this.pushGitFolder = this.pushGitFolder.bind(this);
        this.serveFile = this.serveFile.bind(this); // Bind the new method
    }

    /**
     * Handles cloning a Git repository.
 /preview/clone/:repoName?ownername=...
     */
    public async cloneGitFolder(req: Request, res: Response): Promise<void> {
        // Authentication check (assuming middleware adds 'user' to req)
        if (!req.user || !req.user.username) {
            const apiResponse: ApiResponse<null> = { status: ResponseStatus.FAILED, message: 'Authentication required or username missing in token', error: 'Unauthorized' };
            res.status(401).json(apiResponse);
            return;
        }
        const username = req.user.username; // User performing the action
        const { repoName } = req.params;
        const { ownername } = req.query; // Extract optional ownername from query

        // Basic input validation
        if (!repoName) {
            const apiResponse: ApiResponse<null> = { status: ResponseStatus.FAILED, message: 'Repository name is required in the URL path', error: 'Missing parameter' };
            res.status(400).json(apiResponse);
            return;
        }

        // Validate ownername if provided (must be a string)
        if (ownername !== undefined && typeof ownername !== 'string') {
             const apiResponse: ApiResponse<null> = { status: ResponseStatus.FAILED, message: 'Optional ownername query parameter must be a string if provided', error: 'Invalid query parameter type' };
             res.status(400).json(apiResponse);
             return;
        }

        // Determine the effective owner/user for the clone operation
        const effectiveOwner = (ownername && typeof ownername === 'string') ? ownername : username;

        // Call service, passing the effective owner and repo name.
        const serviceResponse = await this.folderPreviewService.cloneRepo(
            effectiveOwner,
            repoName
        );

        // Send response based on service result
        const statusCode = getStatusCode(serviceResponse, 200); // 200 OK for successful clone
        res.status(statusCode).json(serviceResponse);
    }

    /**
     * Handles getting content of a file or directory.
     * GET /preview/content?relativePath=...
     */
    public async getPathContent(req: Request, res: Response): Promise<void> {
        if (!req.user || !req.user.username) {
            const apiResponse: ApiResponse<null> = { status: ResponseStatus.FAILED, message: 'Authentication required or username missing in token', error: 'Unauthorized' };
            res.status(401).json(apiResponse);
            return;
        }
        const username = req.user.username;
        const { relativePath, ownername } = req.query;

        if (!relativePath || typeof relativePath !== 'string') {
            const apiResponse: ApiResponse<null> = { status: ResponseStatus.FAILED, message: 'Relative path query parameter is required', error: 'Missing query parameter' };
            res.status(400).json(apiResponse);
            return;
        }

        // Validate ownername if provided (must be a string)
        if (ownername !== undefined && typeof ownername !== 'string') {
            const apiResponse: ApiResponse<null> = { status: ResponseStatus.FAILED, message: 'Optional ownername query parameter must be a string if provided', error: 'Invalid query parameter type' };
            res.status(400).json(apiResponse);
            return;
        }

        // Use ownername if provided, otherwise use username
        const effectiveOwner = (ownername && typeof ownername === 'string') ? ownername : username;

        const serviceResponse = await this.folderPreviewService.getPathContent(effectiveOwner, relativePath);
        const statusCode = getStatusCode(serviceResponse); // 200 OK for success
        res.status(statusCode).json(serviceResponse);
    }

    /**
     * Handles modifying file content.
     * PUT /preview/content
     * Body: { "relativePath": "...", "newContent": "..." }
     */
    public async modifyFileContent(req: Request, res: Response): Promise<void> {
        if (!req.user || !req.user.username) {
            const apiResponse: ApiResponse<null> = { status: ResponseStatus.FAILED, message: 'Authentication required or username missing in token', error: 'Unauthorized' };
            res.status(401).json(apiResponse);
            return;
        }
        const username = req.user.username;
        const { relativePath, newContent } = req.body;
        const { ownername } = req.query; // <-- add this

        // Basic input validation
        if (!relativePath) {
             const apiResponse: ApiResponse<null> = { status: ResponseStatus.FAILED, message: 'Relative path is required in the request body', error: 'Missing body parameter: relativePath' };
             res.status(400).json(apiResponse);
             return;
         }
        // Note: Allow empty string for newContent, but check for undefined/null
        if (newContent === undefined || newContent === null) {
            const apiResponse: ApiResponse<null> = { status: ResponseStatus.FAILED, message: 'New content is required in the request body', error: 'Missing body parameter: newContent' };
            res.status(400).json(apiResponse);
            return;
        }


        // Use ownername if provided, otherwise use username
        const effectiveOwner = (ownername && typeof ownername === 'string') ? ownername : username;

        const serviceResponse = await this.folderPreviewService.modifyFile(effectiveOwner, relativePath, newContent);
        const statusCode = getStatusCode(serviceResponse); // 200 OK for success
        res.status(statusCode).json(serviceResponse);
    }

    /**
     * Handles creating a file or folder.
     * POST /preview/item
     * Body: { "relativePath": "...", "type": "file"|"folder", "content"?: "..." }
     */
    public async createItem(req: Request, res: Response): Promise<void> {
        if (!req.user || !req.user.username) {
            const apiResponse: ApiResponse<null> = { status: ResponseStatus.FAILED, message: 'Authentication required or username missing in token', error: 'Unauthorized' };
            res.status(401).json(apiResponse);
            return;
        }
        const username = req.user.username;
        const { relativePath, type, content } = req.body; // content is optional
        const { ownername } = req.query; // <-- add this

        if (!relativePath) {
            const apiResponse: ApiResponse<null> = { status: ResponseStatus.FAILED, message: 'Relative path is required in the request body', error: 'Missing body parameter: relativePath' };
            res.status(400).json(apiResponse);
            return;
        }
        if (!type || (type !== 'file' && type !== 'folder')) {
            const apiResponse: ApiResponse<null> = { status: ResponseStatus.FAILED, message: 'Type parameter (\'file\' or \'folder\') is required in the request body', error: 'Invalid or missing body parameter: type' };
            res.status(400).json(apiResponse);
            return;
        }

        // Use ownername if provided, otherwise use username
        const effectiveOwner = (ownername && typeof ownername === 'string') ? ownername : username;

        const serviceResponse = await this.folderPreviewService.createItem(effectiveOwner, relativePath, type, content);
        const statusCode = getStatusCode(serviceResponse, 200, 201); // Use 201 Created for success
        res.status(statusCode).json(serviceResponse);
    }

    /**
     * Handles removing a file or folder.
     * DELETE /preview/item?relativePath=...
     */
    public async removeItem(req: Request, res: Response): Promise<void> {
        if (!req.user || !req.user.username) {
            const apiResponse: ApiResponse<null> = { status: ResponseStatus.FAILED, message: 'Authentication required or username missing in token', error: 'Unauthorized' };
            res.status(401).json(apiResponse);
            return;
        }
        const username = req.user.username;
        const { relativePath, ownername } = req.query;

        if (!relativePath || typeof relativePath !== 'string') {
            const apiResponse: ApiResponse<null> = { status: ResponseStatus.FAILED, message: 'Relative path query parameter is required', error: 'Missing query parameter' };
            res.status(400).json(apiResponse);
            return;
        }

        // Use ownername if provided, otherwise use username
        const effectiveOwner = (ownername && typeof ownername === 'string') ? ownername : username;

        const serviceResponse = await this.folderPreviewService.removeItem(effectiveOwner, relativePath as string);
        const statusCode = getStatusCode(serviceResponse); // 200 OK for success
        res.status(statusCode).json(serviceResponse);
    }

    /**
     * Handles renaming/moving a file or folder.
     * PATCH /preview/item
     * Body: { "oldRelativePath": "...", "newRelativePath": "..." }
     */
    public async renameItem(req: Request, res: Response): Promise<void> {
        if (!req.user || !req.user.username) {
            const apiResponse: ApiResponse<null> = { status: ResponseStatus.FAILED, message: 'Authentication required or username missing in token', error: 'Unauthorized' };
            res.status(401).json(apiResponse);
            return;
        }
        const username = req.user.username;
        const { oldRelativePath, newRelativePath } = req.body;
        const { ownername } = req.query; // <-- add this

        if (!oldRelativePath) {
            const apiResponse: ApiResponse<null> = { status: ResponseStatus.FAILED, message: 'Old relative path is required in the request body', error: 'Missing body parameter: oldRelativePath' };
            res.status(400).json(apiResponse);
            return;
        }
        if (!newRelativePath) {
            const apiResponse: ApiResponse<null> = { status: ResponseStatus.FAILED, message: 'New relative path is required in the request body', error: 'Missing body parameter: newRelativePath' };
            res.status(400).json(apiResponse);
            return;
        }

        // Use ownername if provided, otherwise use username
        const effectiveOwner = (ownername && typeof ownername === 'string') ? ownername : username;

        const serviceResponse = await this.folderPreviewService.renameItem(effectiveOwner, oldRelativePath, newRelativePath);
        const statusCode = getStatusCode(serviceResponse); // 200 OK for success
        res.status(statusCode).json(serviceResponse);
    }

    /**
     * Handles pushing changes from the temporary working directory back to the source repository.
     * POST /preview/push/:repoName
     */
    public async pushGitFolder(req: Request, res: Response): Promise<void> {
        // Authentication check
        if (!req.user || !req.user.username) {
            const apiResponse: ApiResponse<null> = { 
                status: ResponseStatus.FAILED, 
                message: 'Authentication required or username missing in token', 
                error: 'Unauthorized' 
            };
            res.status(401).json(apiResponse);
            return;
        }
        const username = req.user.username;
        const { repoName } = req.params;
        const { commitMessage } = req.body; // Optional commit message
        const { ownername } = req.query; // <-- get ownername from query

        // Basic input validation
        if (!repoName) {
            const apiResponse: ApiResponse<null> = { 
                status: ResponseStatus.FAILED, 
                message: 'Repository name is required in the URL path', 
                error: 'Missing parameter' 
            };
            res.status(400).json(apiResponse);
            return;
        }

        // Validate ownername if provided (must be a string)
        if (ownername !== undefined && typeof ownername !== 'string') {
            const apiResponse: ApiResponse<null> = { 
                status: ResponseStatus.FAILED, 
                message: 'Optional ownername query parameter must be a string if provided', 
                error: 'Invalid query parameter type' 
            };
            res.status(400).json(apiResponse);
            return;
        }

        // Use ownername if provided, otherwise use username
        const effectiveOwner = (ownername && typeof ownername === 'string') ? ownername : username;

        // Call service
        const serviceResponse = await this.folderPreviewService.pushRepo(
            effectiveOwner, 
            repoName, 
            commitMessage || 'Update from web editor'
        );

        const statusCode = getStatusCode(serviceResponse, 200); // 200 OK for successful push
        res.status(statusCode).json(serviceResponse);
    }

    /**
     * Handles serving a raw file from a repository.
     * GET /preview/files?path=repoName/path/to/file.jpg
     */
    public async serveFile(req: Request, res: Response): Promise<void> {
        if (!req.user || !req.user.username) {
            const apiResponse: ApiResponse<null> = { status: ResponseStatus.FAILED, message: 'Authentication required or username missing in token', error: 'Unauthorized' };
            res.status(401).json(apiResponse);
            return;
        }
        console.log('serveFile ++++++++++++++++++++++++++++++++++++++++++++++++++00+0+0+++++++++++°987642345678987654345678909876');
        const username = req.user.username;
        const { path: filePathFromQuery } = req.query; // e.g., "myRepoName/path/to/file.jpg"

        if (!filePathFromQuery || typeof filePathFromQuery !== 'string' || filePathFromQuery.trim() === '') {
            const apiResponse: ApiResponse<null> = { status: ResponseStatus.FAILED, message: 'Path query parameter is required and must be a non-empty string.', error: 'Missing or invalid query parameter: path' };
            res.status(400).json(apiResponse);
            return;
        }

        // Construct the path with the /git/ prefix, username, and temp-working-directory
        const pathForService = `/srv/git/${username}/temp-working-directory/${filePathFromQuery}`;

        // Pass this constructed path to the service
        const fileStreamPathResult = await this.folderPreviewService.getFilePathForStreaming(username, pathForService);

        if (fileStreamPathResult.status === ResponseStatus.SUCCESS && fileStreamPathResult.data) {
            const absoluteFilePath = fileStreamPathResult.data;
            const contentType = mime.getType(absoluteFilePath) || 'application/octet-stream';
            res.setHeader('Content-Type', contentType);

            // Optional: Add Content-Disposition header to suggest filename for downloads
            // res.setHeader('Content-Disposition', `inline; filename="${path.basename(absoluteFilePath)}"`);

            const fileStream = fs.createReadStream(absoluteFilePath);
            fileStream.on('error', (err) => {
                console.error('Error streaming file:', err);
                if (!res.headersSent) {
                    const errorResponse = { status: 'FAILED', message: 'Error streaming file from server.', error: 'File stream error' };
                    res.status(500).json(errorResponse);
                }
            });
            fileStream.pipe(res);
        } else {
            const statusCode = getStatusCode(fileStreamPathResult); // Relies on fileStreamPathResult being ApiResponse<any>
            res.status(statusCode).json(fileStreamPathResult);
        }
    }
}