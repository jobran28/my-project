# Routes Documentation

This file contains notes and documentation for each route file in the routes directory.

## Authentication Routes

### `authentication.routes.ts` ✅
- **Purpose**: Handles user authentication endpoints
- **Endpoints**: 
  - POST `/signup` - User registration
  - POST `/signin` - User login  
  - POST `/request-password-reset` - Password reset request
  - POST `/set-password` - Set new password
- **Authentication**: None (these are public auth endpoints)
- **Status**: Active, well documented
- **Notes**: Public endpoints for authentication, no auth middleware needed

### `auth.routes.ts` ⚠️
- **Purpose**: Duplicate of authentication.routes.ts
- **Status**: DUPLICATE - Should be removed
- **Notes**: Identical functionality to authentication.routes.ts

## Protected Routes (Need Authentication)

### `user.routes.ts` ❌
- **Purpose**: User CRUD operations
- **Endpoints**:
  - GET `/` - List all users
  - GET `/:id` - Get user by ID
  - POST `/` - Create user
  - PUT `/:id` - Update user
  - DELETE `/:id` - Delete user
- **Authentication**: MISSING - Needs auth middleware
- **Status**: Needs authentication added
- **Security Risk**: All user operations are currently unprotected

### `repository.routes.ts` ✅
- **Purpose**: Repository management
- **Endpoints**:
  - GET `/` - List repositories
  - POST `/` - Create repository
  - PUT `/:id` - Update repository
  - DELETE `/:id` - Delete repository
  - POST `/:id/fork` - Fork repository
  - GET `/:id` - Get repository by ID
- **Authentication**: IMPLEMENTED - Uses `auth.authenticate.bind(auth)`
- **Status**: Properly protected
- **Notes**: Good example of authentication implementation

### `issue.routes.ts` ❌
- **Purpose**: Issue management and tracking
- **Endpoints**:
  - GET `/search` - Global issue search
  - GET `/repository/:repositoryId` - Get repository issues
  - GET `/repository/:repositoryId/search` - Search repository issues
  - GET `/repository/:repositoryId/comments` - Get repository issue comments
  - GET `/:issueId` - Get issue by ID
  - GET `/:issueId/comments` - Get issue comments
  - POST `/` - Create issue
  - PUT `/:issueId` - Update issue
  - DELETE `/:issueId` - Delete issue
  - POST `/comments` - Add issue comment
  - GET `/user/:userId` - Get user issues
- **Authentication**: MISSING - Needs auth middleware
- **Status**: Needs authentication added
- **Security Risk**: All issue operations are unprotected

### `pullRequest.routes.ts` ❌
- **Purpose**: Pull request management
- **Endpoints**:
  - POST `/` - Create pull request
  - GET `/` - Get all pull requests
  - GET `/:id/preview` - Preview pull request
  - POST `/:id/prepare-merge` - Prepare merge
  - POST `/:id/finalize-merge` - Finalize merge
  - PATCH `/:id/status` - Update status
  - DELETE `/:id` - Delete pull request
  - GET `/:id/diff` - Get diff (deprecated)
- **Authentication**: MISSING - Needs auth middleware
- **Status**: Needs authentication added
- **Security Risk**: All PR operations are unprotected

### `admin.routes.ts` ❌⚠️
- **Purpose**: Administrative operations
- **Endpoints**:
  - GET `/repositories` - List all repositories (admin)
  - DELETE `/repositories/:id` - Delete repository (admin)
  - GET `/users` - List all users (admin)
  - DELETE `/users/:id` - Delete user (admin)
- **Authentication**: MISSING - Needs auth + admin middleware
- **Status**: CRITICAL - Needs both authentication and admin role check
- **Security Risk**: CRITICAL - Admin operations are completely unprotected
- **Notes**: Has commented admin middleware, needs implementation

### `2fa.routes.ts` ✅
- **Purpose**: Two-factor authentication management
- **Endpoints**:
  - GET `/generate` - Generate 2FA QR code (protected)
  - POST `/verify` - Verify and enable 2FA (protected)
  - POST `/validate` - Validate 2FA token (public)
  - DELETE `/` - Disable 2FA (protected)
- **Authentication**: PARTIALLY IMPLEMENTED - Mixed public/protected
- **Status**: Properly implemented with selective protection
- **Notes**: Good example of mixed public/protected endpoints

### `folder.preview.routes.ts` ✅
- **Purpose**: Git folder preview and manipulation
- **Endpoints**:
  - POST `/clone/:repoName` - Clone repository
  - GET `/content` - Read file/directory content
  - PUT `/content` - Modify file content
  - POST `/item` - Create file/folder
  - DELETE `/item` - Remove file/folder
  - PATCH `/item` - Rename/move file/folder
  - GET `/files` - Serve raw file bytes
  - POST `/push/:repoName` - Push changes to remote
- **Authentication**: IMPLEMENTED - Uses `auth.authenticate.bind(auth)`
- **Status**: Properly protected
- **Notes**: All endpoints properly protected

### `repository_access.routes.ts` ❌
- **Purpose**: Repository access management
- **Endpoints**:
  - GET `/users/:userId/repositories` - Get user repository access
  - GET `/repositories/:repositoryId/users` - Get repository user access
  - GET `/repositories/:repositoryId/users/:userId/verify` - Verify access
  - POST `/access` - Grant access
  - DELETE `/repositories/:repositoryId/users/:userId` - Revoke access
  - PUT `/repositories/:repositoryId/users/:userId` - Update access
- **Authentication**: MISSING - Needs auth middleware
- **Status**: Needs authentication added
- **Security Risk**: Access management operations are unprotected

### `issue_comment.route.ts` ❌
- **Purpose**: Issue comment management
- **Endpoints**:
  - GET `/comments/:commentId` - Get comment by ID
  - GET `/issues/:issueId/comments` - Get comments for issue
  - POST `/comments` - Create comment
  - PUT `/comments/:commentId` - Update comment
  - DELETE `/comments/:commentId` - Delete comment
- **Authentication**: MISSING - Needs auth middleware
- **Status**: Needs authentication added
- **Security Risk**: Comment operations are unprotected

## Summary

### ✅ Properly Protected Routes (3):
- `repository.routes.ts`
- `2fa.routes.ts` (mixed)
- `folder.preview.routes.ts`

### ❌ Missing Authentication (6):
- `user.routes.ts`
- `issue.routes.ts`
- `pullRequest.routes.ts`
- `repository_access.routes.ts`
- `issue_comment.route.ts`
- `admin.routes.ts` (CRITICAL - needs admin role too)

### ⚠️ Issues to Fix:
- Remove duplicate `auth.routes.ts`
- Add admin role middleware for admin routes
- Implement global authentication in index.ts

## Recommended Actions:
1. Add global authentication middleware to index.ts
2. Remove auth middleware from individual route files
3. Add admin role check for admin routes
4. Remove duplicate auth.routes.ts file
5. Keep authentication.routes.ts as public endpoints
