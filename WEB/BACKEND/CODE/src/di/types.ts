export const TYPES = {
    /* ───── Core / infrastructure ───── */
    PrismaClient:                Symbol.for('PrismaClient'),

    /* ───── Repositories ───── */
    UserRepository:              Symbol.for('UserRepository'),
    RepositoryRepository:        Symbol.for('RepositoryRepository'),
    RepositoryAccessRepository:  Symbol.for('RepositoryAccessRepository'),
    IssueRepository:             Symbol.for('IssueRepository'),
    PullRequestRepository:       Symbol.for('PullRequestRepository'),
    IssueCommentRepository:      Symbol.for('IssueCommentRepository'),

    /* ───── Services ───── */
    UserService:                 Symbol.for('UserService'),
    AuthService:                 Symbol.for('AuthService'),
    RepositoryService:           Symbol.for('RepositoryService'),
    RepositoryAccessService:     Symbol.for('RepositoryAccessService'),
    IssueService:                Symbol.for('IssueService'),
    PullRequestService:          Symbol.for('PullRequestService'),
    IssueCommentService:         Symbol.for('IssueCommentService'),
    FolderPreviewService:        Symbol.for('FolderPreviewService'),
    // GitService:              Symbol.for('GitService'),  // uncomment if/when used

    /* ───── Controllers ───── */
    UserController:              Symbol.for('UserController'),
    AuthenticationController:    Symbol.for('AuthenticationController'),
    RepositoryController:        Symbol.for('RepositoryController'),
    RepositoryAccessController:  Symbol.for('RepositoryAccessController'),
    IssueController:             Symbol.for('IssueController'),
    PullRequestController:       Symbol.for('PullRequestController'),
    IssueCommentController:      Symbol.for('IssueCommentController'),
    FolderPreviewController:     Symbol.for('FolderPreviewController'),
    TwoFactorAuthController:     Symbol.for('TwoFactorAuthController'),

    /* ───── Middleware ───── */
    AuthMiddleware:              Symbol.for('AuthMiddleware'),
    AdminMiddleware:             Symbol.for('AdminMiddleware'),
    RepoAccessMiddleware:        Symbol.for('RepoAccessMiddleware'),

    /* ───── Utilities (optional) ───── */
    // GitCrud:                 Symbol.for('GitCrud'),
} as const;
