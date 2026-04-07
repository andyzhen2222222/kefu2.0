# IntelliDesk Database Deployment & Operation Recommendations

This document outlines the recommended deployment and operational strategies for the IntelliDesk PostgreSQL database in a production environment.

## 1. Connection Management
- **PgBouncer**: Use PgBouncer in **Transaction mode** as a connection pooler to prevent Node.js (via Prisma) from exhausting database connections.
- **Prisma Accelerate**: Consider using Prisma Accelerate for managed connection pooling and edge-optimized queries.

## 2. Read/Write Splitting
- **Architecture**: Deploy a Primary-Replica architecture.
- **Strategy**: 
    - Route write operations (Webhooks, new Tickets, Message sending) to the **Primary** node.
    - Route read-heavy operations (Dashboard stats, historical searches, reporting) to **Read Replicas** to reduce latency and load on the primary node.

## 3. Disaster Recovery & Reliability
- **PITR (Point-In-Time Recovery)**: Enable Write-Ahead Logging (WAL) and use tools like **pgBackRest** to allow for precise point-in-time recovery.
- **Automated Backups**: Implement daily full backups and continuous WAL archiving.

## 4. Security & Isolation
- **Row-Level Security (RLS)**: Enable PostgreSQL RLS with policies based on `tenantId`. This provides a final layer of defense against accidental cross-tenant data access in a multi-tenant environment.
- **VPC Isolation**: Ensure the database is only accessible within the application's Virtual Private Cloud (VPC).

## 5. Maintenance
- **Autovacuum**: Tune autovacuum settings to ensure consistent performance as tables like `Message` grow.
- **Index Monitoring**: Regularly monitor index usage and bloat, and rebuild indexes periodically if necessary.
