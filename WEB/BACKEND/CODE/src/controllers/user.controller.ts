import { Request, Response } from 'express';
import { injectable, inject } from 'inversify';
import { UserService } from '../services/user.service'; // Keep UserService import
import { Prisma } from '@prisma/client'; // Import Prisma
import { ResponseStatus } from '../DTO/apiResponse.DTO'; // Import ResponseStatus
import { UpdateUserDto } from '../DTO/user.dto'; // <-- Add this import
import { TYPES } from '../di/types';          // ← add this


@injectable()
export class UserController {

    constructor(
        @inject(TYPES.UserService) private userService: UserService
    ) { }

    /**
     * Get all users
     * @param req Express request object
     * @param res Express response object
     */
    getAllUsers = async (req: Request, res: Response): Promise<void> => {
        try {
            // Extract optional relations from query parameters
            let relations: string[] | undefined;
            if (req.query.relations && typeof req.query.relations === 'string') {
                relations = req.query.relations.split(',');
            }

            const usersResponse = await this.userService.getAllUsers(relations);

            // Check the status from the service response
            if (usersResponse.status === ResponseStatus.SUCCESS) {
                res.status(200).json(usersResponse);
            } else {
                // Use the message and error from the service response
                res.status(500).json({
                    status: usersResponse.status,
                    message: usersResponse.message,
                    error: usersResponse.error
                });
            }
        } catch (error) {
            console.error('Error in UserController.getAllUsers:', error);
            // Generic fallback error
            res.status(500).json({
                status: ResponseStatus.FAILED,
                message: 'Failed to retrieve users',
                error: (error instanceof Error) ? error.message : 'Unknown error'
            });
        }
    };

    /**
     * Get a user by ID
     * @param req Express request object
     * @param res Express response object
     */
    getUserById = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = parseInt(req.params.id, 10);

            // Check if ID is a valid number
            if (isNaN(userId)) {
                res.status(400).json({ error: 'Invalid user ID' });
                return;
            }

            // Extract optional relations from query parameters
            let relations: string[] | undefined;
            if (req.query.relations && typeof req.query.relations === 'string') {
                relations = req.query.relations.split(',');
            }

            const user = await this.userService.getUserById(userId, relations);

            if (!user) {
                res.status(404).json({ error: 'User not found' });
                return;
            }

            res.status(200).json(user);
        } catch (error) {
            console.error('Error in UserController.getUserById:', error);
            res.status(500).json({ error: 'Failed to retrieve user' });
        }
    };

    /**
     * Create a new user
     * @param req Express request object
     * @param res Express response object
     */
    createUser = async (req: Request, res: Response): Promise<void> => {
        try {
            // Expect username, email, password in the body
            // The type here reflects the expected input structure, not necessarily the final DB structure
            const userData = req.body;

            // Basic validation for required fields including raw password
            if (!userData.username || !userData.email || !userData.password) { // Check for raw password
                res.status(400).json({ error: 'Username, email, and password are required' });
                return;
            }

            // Pass the raw userData (containing password) to the service.
            // The service is responsible for validation (e.g., with Zod) and hashing.
            const serviceResponse = await this.userService.createUser(userData);

            if (serviceResponse.status === ResponseStatus.SUCCESS) {
                res.status(201).json(serviceResponse);
            } else {
                // Choose status code based on error message, default to 400
                let statusCode = 400;
                if (
                    serviceResponse.message?.toLowerCase().includes('already exists') ||
                    serviceResponse.message?.toLowerCase().includes('already in use')
                ) {
                    statusCode = 409;
                }
                res.status(statusCode).json({
                    status: serviceResponse.status,
                    message: serviceResponse.message,
                    error: serviceResponse.error
                });
            }
        } catch (error) {
            console.error('Error in UserController.createUser:', error);
            res.status(500).json({ error: 'Failed to create user' });
        }
    };

    /**
     * Update a user by ID
     * @param req Express request object
     * @param res Express response object
     */
    updateUser = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = parseInt(req.params.id, 10);
            if (isNaN(userId)) {
                res.status(400).json({ error: 'Invalid user ID' });
                return;
            }

            // Use Prisma.usersUpdateInput type - this is likely correct for updates
            // as we usually don't update the password directly here or expect raw password for updates
            const userData: Prisma.usersUpdateInput = req.body;

            // Check if there is any data to update
            if (Object.keys(userData).length === 0) {
                res.status(400).json({ error: 'No update data provided' });
                return;
            }

            // Service call returns ApiResponse
            const serviceResponse = await this.userService.updateUser(userId, userData);

            if (serviceResponse.status === ResponseStatus.SUCCESS) {
                res.status(200).json(serviceResponse);
            } else {
                // Choose status code based on error message, default to 400
                let statusCode = 400;
                if (
                    serviceResponse.message?.toLowerCase().includes('already exists') ||
                    serviceResponse.message?.toLowerCase().includes('already in use')
                ) {
                    statusCode = 409;
                } else if (
                    serviceResponse.message?.toLowerCase().includes('not found')
                ) {
                    statusCode = 404;
                }
                res.status(statusCode).json({
                    status: serviceResponse.status,
                    message: serviceResponse.message,
                    error: serviceResponse.error
                });
            }
        } catch (error) {
            console.error('Error in UserController.updateUser:', error);
            res.status(500).json({ 
                status: 'failed',
                message: 'Failed to update user',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    /**
     * Delete a user by ID
     * @param req Express request object
     * @param res Express response object
     */
    deleteUser = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = parseInt(req.params.id, 10);

            // Check if ID is a valid number
            if (isNaN(userId)) {
                res.status(400).json({ error: 'Invalid user ID' });
                return;
            }

            const deletedUser = await this.userService.deleteUser(userId);

            if (!deletedUser) {
                res.status(404).json({ error: 'User not found or deletion failed' });
                return;
            }

            res.status(200).json({ message: 'User deleted successfully', user: deletedUser });
        } catch (error) {
            console.error('Error in UserController.deleteUser:', error);
            res.status(500).json({ error: 'Failed to delete user' });
        }
    };
    public changePassword = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = parseInt(req.params.id, 10);
            if (isNaN(userId)) {
                res.status(400).json({ error: 'Invalid user ID' });
                return;
            }

            const { currentPassword, newPassword, confirmNewPassword } = req.body;

            if (!currentPassword || !newPassword || !confirmNewPassword) {
                res.status(400).json({ error: 'All password fields are required' });
                return;
            }

            if (newPassword !== confirmNewPassword) {
                res.status(400).json({ error: 'New passwords do not match' });
                return;
            }

            const passwordSchema = UpdateUserDto.pick({ password: true });
            const validationResult = passwordSchema.safeParse({ password: newPassword });
            if (!validationResult.success) {
                res.status(400).json({
                    error: 'Validation error',
                    details: validationResult.error.errors
                });
                return;
            }

            await this.userService.changePassword(userId, currentPassword, newPassword);
            res.status(200).json({ message: 'Password updated successfully' });
        } catch (error) {
            console.error('Error in UserController.changePassword:', error);
            if (error instanceof Error) {
                if (error.message === 'Current password is incorrect') {
                    res.status(401).json({ error: error.message });
                } else {
                    res.status(500).json({ error: error.message });
                }
            } else {
                res.status(500).json({ error: 'Failed to change password' });
            }
        }
    };
    // Add to UserController
    public uploadAvatar = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = parseInt(req.params.id, 10);
            if (isNaN(userId)) {
                res.status(400).json({ error: 'Invalid user ID' });
                return;
            }

            if (!req.file) {
                res.status(400).json({ error: 'No file uploaded' });
                return;
            }

            const avatarPath = `/uploads/avatars/${req.file.filename}`;
            const updatedUser = await this.userService.updateUser(userId, {
                avatar_path: avatarPath
            });

            res.status(200).json(updatedUser);
        } catch (error) {
            console.error('Error in UserController.uploadAvatar:', error);
            if (error instanceof Error) {
                if (error.message === 'Only image files are allowed') {
                    res.status(400).json({ error: error.message });
                } else {
                    res.status(500).json({ error: 'Failed to upload avatar' });
                }
            } else {
                res.status(500).json({ error: 'Failed to upload avatar' });
            }
        }
    }

    /**
     * Get a user by email
     * @param req Express request object
     * @param res Express response object
     */
    getUserByEmail = async (req: Request, res: Response): Promise<void> => {
        try {
            const email = req.params.email;
            if (!email) {
                res.status(400).json({ error: 'Email is required' });
                return;
            }
            const userResponse = await this.userService.getUserByEmail(email);
            if (userResponse.status === ResponseStatus.SUCCESS) {
                res.status(200).json(userResponse);
            } else {
                res.status(404).json({
                    status: userResponse.status,
                    message: userResponse.message,
                    error: userResponse.error
                });
            }
        } catch (error) {
            console.error('Error in UserController.getUserByEmail:', error);
            res.status(500).json({
                status: ResponseStatus.FAILED,
                message: 'Failed to retrieve user by email',
                error: (error instanceof Error) ? error.message : 'Unknown error'
            });
        }
    };

    /**
     * Suspend or unsuspend a user by ID
     * @param req Express request object
     * @param res Express response object
     */
    suspendUnsuspendUser = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = parseInt(req.params.id, 10);
            if (isNaN(userId)) {
                res.status(400).json({ error: 'Invalid user ID' });
                return;
            }
            const { suspend } = req.body;
            if (typeof suspend !== 'boolean') {
                res.status(400).json({ error: 'suspend field must be boolean' });
                return;
            }
            const response = await this.userService.suspendUnsuspendUser(userId, suspend);
            let statusCode = 200;
            if (response.status === ResponseStatus.FAILED) statusCode = 404;
            res.status(statusCode).json(response);
        } catch (error) {
            console.error('Error in UserController.suspendUnsuspendUser:', error);
            res.status(500).json({
                status: 'failed',
                message: 'Failed to update user suspejhion status',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}
