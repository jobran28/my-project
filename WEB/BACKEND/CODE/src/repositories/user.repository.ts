import { Prisma, PrismaClient, users, repository, repository_access, RepositoryAccess } from '@prisma/client';
import { injectable, inject } from 'inversify';
import { TYPES } from '../di/types';
import { ApiResponse, ResponseStatus } from '../DTO/apiResponse.DTO';

// Type for repository with access information
type RepositoryWithAccess = repository & {
    access_level: RepositoryAccess | 'owner';
    is_owner: boolean;
};

// Type for user with included relations
type UserWithRelations = users & {
    repository?: repository[];
    repository_access?: (repository_access & { repository: repository })[];
    all_repositories?: RepositoryWithAccess[];
    [key: string]: any;
};

@injectable()
export class UserRepository {
    prisma: PrismaClient;

    private userRelationMap: { [tableName: string]: keyof Prisma.usersInclude } = {
        'repositories': 'repository',
        'all_repositories': 'repository', // Will be handled specially
        'repository_accesses': 'repository_access',
        'issues': 'issue',
        'pull_requests': 'pull_request',
        'issue_comments': 'issue_comment',
        'pull_request_comments': 'pull_request_comment',
    };

    constructor(@inject(TYPES.PrismaClient) prisma: PrismaClient) {
        console.log("user repo called");
        this.prisma = prisma;
    }

    async findById(
        id: number,
        tableNamesToInclude?: string[]
    ): Promise<ApiResponse<users | null>> {
        try {
            let includeRelations: Prisma.usersInclude | undefined = undefined;
            let hasAllRepositories = false;

            if (tableNamesToInclude && tableNamesToInclude.length > 0) {
                includeRelations = {};
                for (const tableName of tableNamesToInclude) {
                    if (tableName === 'all_repositories') {
                        hasAllRepositories = true;
                        // Include both repository and repository_access relations with archived filter
                        includeRelations['repository'] = {
                            where: { archived: false }
                        };
                        includeRelations['repository_access'] = {
                            where: {
                                repository: {
                                    archived: false
                                }
                            },
                            include: {
                                repository: true
                            }
                        };
                    } else if (tableName === 'repositories') {
                        // Also filter archived repositories for direct repository relation
                        includeRelations['repository'] = {
                            where: { archived: false }
                        };
                    } else {
                        const relationName = this.userRelationMap[tableName];
                        if (relationName) {
                            includeRelations[relationName] = true;
                        } else {
                            console.warn(`Warning: Table name "${tableName}" is not a valid relation for users model and will be ignored.`);
                        }
                    }
                }
            }

            const user = await this.prisma.users.findUnique({
                where: { id: id },
                include: includeRelations,
            }) as UserWithRelations | null;

            if (user) {
                // If all_repositories was requested, transform the data
                if (hasAllRepositories) {
                    const ownedRepos = user.repository || [];
                    const accessRepos = (user.repository_access || []).map((access: repository_access & { repository: repository }): RepositoryWithAccess => ({
                        ...access.repository,
                        access_level: access.access_level,
                        is_owner: false
                    }));
                    
                    const ownedReposWithFlag: RepositoryWithAccess[] = ownedRepos.map((repo: repository): RepositoryWithAccess => ({
                        ...repo,
                        access_level: 'owner' as const,
                        is_owner: true
                    }));

                    // Combine and remove duplicates (in case user owns and has access to same repo)
                    const allRepositories: RepositoryWithAccess[] = [...ownedReposWithFlag];
                    accessRepos.forEach((accessRepo: RepositoryWithAccess) => {
                        if (!ownedRepos.some((ownedRepo: repository) => ownedRepo.id === accessRepo.id)) {
                            allRepositories.push(accessRepo);
                        }
                    });

                    user.all_repositories = allRepositories;
                }

                return {
                    status: ResponseStatus.SUCCESS,
                    message: 'User found',
                    data: user,
                };
            } else {
                return {
                    status: ResponseStatus.FAILED,
                    message: 'User not found',
                    data: null,
                };
            }
        } catch (error) {
            console.error('Error in UserRepository.findById:', error);
            return {
                status: ResponseStatus.FAILED,
                message: 'Error fetching user',
                error: (error as Error).message,
            };
        }
    }

    async findByUsername2(
        username: string,
        tableNamesToInclude?: string[]
    ): Promise<ApiResponse<users | null>> {
        try {
            let includeRelations: Prisma.usersInclude | undefined = undefined;

            if (tableNamesToInclude && tableNamesToInclude.length > 0) {
                includeRelations = {};
                for (const tableName of tableNamesToInclude) {
                    const relationName = this.userRelationMap[tableName];
                    if (relationName) {
                        includeRelations[relationName] = true;
                    } else {
                        console.warn(`Warning: Table name "${tableName}" is not a valid relation for users model and will be ignored.`);
                    }
                }
            }

            const user = await this.prisma.users.findUnique({
                where: { username: username },
                include: includeRelations,
            });
            
            if (user) {
                return {
                    status: ResponseStatus.SUCCESS,
                    message: 'User found',
                    data: user,
                };
            } else {
                return {
                    status: ResponseStatus.FAILED,
                    message: 'User not found',
                    data: null,
                };
            }
        } catch (error) {
            console.error('Error in UserRepository.findByUsername:', error);
            return {
                status: ResponseStatus.FAILED,
                message: 'Error fetching user by username',
                error: (error as Error).message,
            };
        }
    }

    /**
     * Finds a user by ID and includes specified related data based on the userRelationMap.
     * @param id User ID
     * @param relationNames Array of relation names (keys from userRelationMap) to include.
     * @returns ApiResponse with the user data (including relations) or error.
     */
    async findByIdWithRelations(
        id: number,
        relationNames?: string[]
    ): Promise<ApiResponse<users | null>> {
        try {
            let includeRelations: Prisma.usersInclude | undefined = undefined;

            if (relationNames && relationNames.length > 0) {
                includeRelations = {};
                for (const name of relationNames) {
                    const relationKey = this.userRelationMap[name];
                    if (relationKey) {
                        includeRelations[relationKey] = true;
                    } else {
                        console.warn(`Warning: Relation name "${name}" is not valid for the users model and will be ignored.`);
                    }
                }
                // Ensure includeRelations is not an empty object if no valid names were provided
                if (Object.keys(includeRelations).length === 0) {
                    includeRelations = undefined;
                }
            }

            console.log(`Finding user ${id} with relations:`, includeRelations);

            const user = await this.prisma.users.findUnique({
                where: { id: id },
                include: includeRelations,
            });

            if (user) {
                return {
                    status: ResponseStatus.SUCCESS,
                    message: 'User found with specified relations',
                    data: user,
                };
            } else {
                return {
                    status: ResponseStatus.FAILED,
                    message: 'User not found',
                    data: null,
                };
            }
        } catch (error) {
            console.error(`Error in UserRepository.findByIdWithRelations (ID: ${id}):`, error);
            return {
                status: ResponseStatus.FAILED,
                message: 'Error fetching user with relations',
                error: (error as Error).message,
            };
        }
    }

    /**
     * Get all users with optional related data
     * @param tableNamesToInclude Optional array of related table names to include
     * @returns ApiResponse with array of user objects or error
     */
    async getAllUsers(
        tableNamesToInclude?: string[]
    ): Promise<ApiResponse<users[]>> {
        try {
            let includeRelations: Prisma.usersInclude | undefined = undefined;

            if (tableNamesToInclude && tableNamesToInclude.length > 0) {
                includeRelations = {};
                for (const tableName of tableNamesToInclude) {
                    const relationName = this.userRelationMap[tableName];
                    if (relationName) {
                        includeRelations[relationName] = true;
                    } else {
                        console.warn(`Warning: Table name "${tableName}" is not a valid relation for users model and will be ignored.`);
                    }
                }
            }

            const allUsers = await this.prisma.users.findMany({
                where: {
                    is_admin: {
                        not: true
                    }
                },
                include: includeRelations,
            });

            return {
                status: ResponseStatus.SUCCESS,
                message: 'Users retrieved successfully',
                data: allUsers,
            };
        } catch (error) {
            console.error('Error in UserRepository.getAllUsers:', error);
            return {
                status: ResponseStatus.FAILED,
                message: 'Error fetching users',
                error: (error as Error).message,
            };
        }
    }

    async createUser(data: Prisma.usersCreateInput): Promise<ApiResponse<users>> { 
        try {
            const newUser = await this.prisma.users.create({
                data,
            });
            return {
                status: ResponseStatus.SUCCESS,
                message: 'User created successfully',
                data: newUser,
            };
        } catch (error) {
            console.error('Error in UserRepository.createUser:', error);
            return {
                status: ResponseStatus.FAILED,
                message: 'Error creating user',
                error: (error as Error).message,
            };
        }
    }

    async updateUser(
        id: number,
        data: Prisma.usersUpdateInput
    ): Promise<ApiResponse<users | null>> { 
        try {
            const updatedUser = await this.prisma.users.update({
                where: { id: id },
                data,
            });
            return {
                status: ResponseStatus.SUCCESS,
                message: 'User updated successfully',
                data: updatedUser,
            };
        } catch (error) {
            console.error('Error in UserRepository.updateUser:', error);
            return {
                status: ResponseStatus.FAILED,
                message: 'Error updating user',
                error: (error as Error).message,
            };
        }
    }

    async deleteUser(id: number): Promise<ApiResponse<users | null>> { // Use ApiResponse as return type
        try {
            const deletedUser = await this.prisma.users.delete({
                where: { id: id },
            });
            return {
                status: ResponseStatus.SUCCESS,
                message: 'User deleted successfully',
                data: deletedUser,
            };
        } catch (error) {
            console.error('Error in UserRepository.deleteUser:', error);
            return {
                status: ResponseStatus.FAILED,
                message: 'Error deleting user',
                error: (error as Error).message,
            };
        }
    }
    // user.repository.ts

    async findByUsername(username: string): Promise<users | null> {
        return this.prisma.users.findUnique({
            where: { username }
        });
    }
    
    async findByEmail(email: string): Promise<users | null> {
        return this.prisma.users.findUnique({
            where: { email }
        });
    }

    async getUserByEmail(email: string): Promise<users | null> {
        return this.prisma.users.findUnique({
            where: { email }
        });
    }

    async suspendUnsuspendUser(id: number, suspend: boolean): Promise<ApiResponse<users | null>> {
        try {
            const updatedUser = await this.prisma.users.update({
                where: { id },
                data: { suspended: suspend }
            });
            return {
                status: ResponseStatus.SUCCESS,
                message: suspend
                    ? 'User suspended successfully'
                    : 'User unsuspended successfully',
                data: updatedUser
            };
        } catch (error) {
            console.error('Error in UserRepository.suspendUnsuspendUser:', error);
            return {
                status: ResponseStatus.FAILED,
                message: 'Error updating user suspension status',
                error: (error as Error).message
            };
        }
    }
}