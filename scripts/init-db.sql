-- DevOps AI Dashboard - Database Initialization Script
-- This script runs automatically when PostgreSQL container starts for the first time

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE devops_dashboard TO devops;

-- Create indexes for better performance (will be created by Drizzle migrations)
-- These are just placeholders for reference

-- Note: Actual tables are created by Drizzle ORM migrations
-- Run `pnpm db:push` after container starts to apply schema
