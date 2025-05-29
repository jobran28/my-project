-- CreateEnum
CREATE TYPE "RepositoryAccess" AS ENUM ('view', 'edit');

-- CreateEnum
CREATE TYPE "PullRequestStatus" AS ENUM ('OPEN', 'CLOSED', 'MERGED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "bio" TEXT,
    "gitCliPassword" TEXT,
    "avatar_path" VARCHAR(255),
    "is_admin" BOOLEAN DEFAULT false,
    "confirmed" BOOLEAN DEFAULT false,
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "contribution_count" INTEGER DEFAULT 0,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "owner_user_id" INTEGER NOT NULL,
    "description" TEXT,
    "is_private" BOOLEAN DEFAULT false,
    "repoPath" VARCHAR(512),
    "parent_id" INTEGER,
    "forked_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "forks_count" INTEGER DEFAULT 0,
    "pull_requests_count" INTEGER DEFAULT 0,

    CONSTRAINT "repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_access" (
    "id" SERIAL NOT NULL,
    "repository_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "access_level" "RepositoryAccess" NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repository_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue" (
    "id" SERIAL NOT NULL,
    "repository_id" INTEGER NOT NULL,
    "author_id" INTEGER,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pull_request" (
    "id" SERIAL NOT NULL,
    "repository_id" INTEGER NOT NULL,
    "author_id" INTEGER,
    "source_branch" VARCHAR(255) NOT NULL,
    "target_branch" VARCHAR(255) NOT NULL,
    "status" "PullRequestStatus" NOT NULL DEFAULT 'OPEN',
    "source_repository_id" INTEGER NOT NULL,
    "target_repository_id" INTEGER NOT NULL,
    "merged_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pull_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_comment" (
    "id" SERIAL NOT NULL,
    "issue_id" INTEGER NOT NULL,
    "author_id" INTEGER,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pull_request_comment" (
    "id" SERIAL NOT NULL,
    "pull_request_id" INTEGER NOT NULL,
    "author_id" INTEGER,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pull_request_comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "repository_access_repository_id_user_id_key" ON "repository_access"("repository_id", "user_id");

-- AddForeignKey
ALTER TABLE "repository" ADD CONSTRAINT "repository_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository" ADD CONSTRAINT "repository_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "repository"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_access" ADD CONSTRAINT "repository_access_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_access" ADD CONSTRAINT "repository_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue" ADD CONSTRAINT "issue_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue" ADD CONSTRAINT "issue_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_request" ADD CONSTRAINT "pull_request_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_request" ADD CONSTRAINT "pull_request_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_request" ADD CONSTRAINT "pull_request_source_repository_id_fkey" FOREIGN KEY ("source_repository_id") REFERENCES "repository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_request" ADD CONSTRAINT "pull_request_target_repository_id_fkey" FOREIGN KEY ("target_repository_id") REFERENCES "repository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_comment" ADD CONSTRAINT "issue_comment_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_comment" ADD CONSTRAINT "issue_comment_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_request_comment" ADD CONSTRAINT "pull_request_comment_pull_request_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "pull_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_request_comment" ADD CONSTRAINT "pull_request_comment_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
