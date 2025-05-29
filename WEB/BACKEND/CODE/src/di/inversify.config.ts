import 'reflect-metadata';
import { Container } from 'inversify';
import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../prisma/prisma-client';

import { TYPES } from './types';
import { tracingMiddleware } from './tracing-middleware';   // ← NEW

/* ───── repositories ───── */
import { UserRepository } from '../repositories/user.repository';
import { RepositoryRepository } from '../repositories/repository.repository';
import { RepositoryAccessRepository } from '../repositories/repository_access.repository';
import { IssueRepository } from '../repositories/issue.repository';
import { PullRequestRepository } from '../repositories/pullRequest.repository';
import { IssueCommentRepository } from '../repositories/issue_comment.repository';

/* ───── services ───── */
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { RepositoryService } from '../services/repository.service';
import { RepositoryAccessService } from '../services/repository_access.service';
import { IssueService } from '../services/issue.service';
import { PullRequestService } from '../services/pullRequest.services';
import { IssueCommentService } from '../services/issue_comment.service';
import { FolderPreviewService } from '../services/folder.preview.service';

/* ───── controllers ───── */
import { UserController } from '../controllers/user.controller';
import { AuthenticationController } from '../controllers/authentication.controller';
import { RepositoryController } from '../controllers/repository.controller';
import { RepositoryAccessController } from '../controllers/repository_access.controller';
import { IssueController } from '../controllers/issue.controller';
import { PullRequestController } from '../controllers/pullRequest.controller';
import { IssueCommentController } from '../controllers/issue_comment.controller';
import { FolderPreviewController } from '../controllers/folder.preview.controller';
import { TwoFactorAuthController } from '../controllers/2fa';

/* ───── middleware classes ───── */
import { AuthMiddleware } from '../middlewares/auth.middleware';
import { AdminMiddleware } from '../middlewares/admin.middleware';
import { RepoAccessMiddleware } from '../middlewares/repoAccess.middleware';

/* ───── container ───── */
const container = new Container();

/* ───────── Bindings ───────── */

/* Prisma client */
container
    .bind<PrismaClient>(TYPES.PrismaClient)
    .toDynamicValue(() => getPrismaClient())
    .inSingletonScope();

/* Repositories */
container.bind<UserRepository>(TYPES.UserRepository).to(UserRepository).inSingletonScope();
container.bind<RepositoryRepository>(TYPES.RepositoryRepository).to(RepositoryRepository).inSingletonScope();
container.bind<RepositoryAccessRepository>(TYPES.RepositoryAccessRepository).to(RepositoryAccessRepository).inSingletonScope();
container.bind<IssueRepository>(TYPES.IssueRepository).to(IssueRepository).inSingletonScope();
container.bind<PullRequestRepository>(TYPES.PullRequestRepository).to(PullRequestRepository).inSingletonScope();
container.bind<IssueCommentRepository>(TYPES.IssueCommentRepository).to(IssueCommentRepository).inSingletonScope();

/* Services */
container.bind<UserService>(TYPES.UserService).to(UserService).inSingletonScope();
container.bind<AuthService>(TYPES.AuthService).to(AuthService).inSingletonScope();
container.bind<RepositoryService>(TYPES.RepositoryService).to(RepositoryService).inSingletonScope();
container.bind<RepositoryAccessService>(TYPES.RepositoryAccessService).to(RepositoryAccessService).inSingletonScope();
container.bind<IssueService>(TYPES.IssueService).to(IssueService).inSingletonScope();
container.bind<PullRequestService>(TYPES.PullRequestService).to(PullRequestService).inSingletonScope();
container.bind<IssueCommentService>(TYPES.IssueCommentService).to(IssueCommentService).inSingletonScope();
container.bind<FolderPreviewService>(TYPES.FolderPreviewService).to(FolderPreviewService).inSingletonScope();

/* Controllers */
container.bind<UserController>(TYPES.UserController).to(UserController).inRequestScope();
container.bind<AuthenticationController>(TYPES.AuthenticationController).to(AuthenticationController).inSingletonScope();
container.bind<RepositoryController>(TYPES.RepositoryController).to(RepositoryController).inSingletonScope();
container.bind<RepositoryAccessController>(TYPES.RepositoryAccessController).to(RepositoryAccessController).inSingletonScope();
container.bind<IssueController>(TYPES.IssueController).to(IssueController).inSingletonScope();
container.bind<PullRequestController>(TYPES.PullRequestController).to(PullRequestController).inSingletonScope();
container.bind<IssueCommentController>(TYPES.IssueCommentController).to(IssueCommentController).inSingletonScope();
container.bind<FolderPreviewController>(TYPES.FolderPreviewController).to(FolderPreviewController).inRequestScope();
container.bind<TwoFactorAuthController>(TYPES.TwoFactorAuthController).to(TwoFactorAuthController).inSingletonScope();

/* Middleware classes */
container.bind<AuthMiddleware>(TYPES.AuthMiddleware).to(AuthMiddleware).inSingletonScope();
container.bind<AdminMiddleware>(TYPES.AdminMiddleware).to(AdminMiddleware).inSingletonScope();
container.bind<RepoAccessMiddleware>(TYPES.RepoAccessMiddleware).to(RepoAccessMiddleware).inSingletonScope(); // NEW

/* ───────── Attach tracing middleware (NEW) ───────── */
container.applyMiddleware(tracingMiddleware);              // NEW

/* ───────── Export the singleton container ───────── */
export default container;
