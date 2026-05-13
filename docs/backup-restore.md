# Backup and restore

Lectio has two stateful components: **PostgreSQL** (all captures, enrichments,
connections) and **MinIO** (media attachments — voice notes, images, PDFs).

Back up both. Losing the DB alone means losing everything except raw media
files. Losing MinIO alone means losing attachments but keeping all text and
enrichments.

## Quick backup (local stack)

```bash
# 1. Dump the database
docker compose exec postgres pg_dump \
  -U lectio lectio | gzip > lectio-db-$(date +%Y%m%d).sql.gz

# 2. Sync MinIO bucket to a local folder
docker run --rm \
  -e MC_HOST_local="http://lectio:${MINIO_ROOT_PASSWORD}@localhost:9000" \
  minio/mc mirror local/lectio-media ./lectio-media-backup/
```

## Restore

```bash
# Restore the database
gunzip < lectio-db-20260101.sql.gz | docker compose exec -T postgres \
  psql -U lectio lectio

# Restore media
docker run --rm \
  -v ./lectio-media-backup:/backup \
  -e MC_HOST_local="http://lectio:${MINIO_ROOT_PASSWORD}@localhost:9000" \
  minio/mc mirror /backup local/lectio-media
```

## Automated backups with cron

Add to your crontab (`crontab -e`):

```cron
# Daily backup at 2 AM, keep 30 days
0 2 * * * cd /path/to/lectio && \
  docker compose exec -T postgres pg_dump -U lectio lectio | \
  gzip > backups/db-$(date +\%Y\%m\%d).sql.gz && \
  find backups -name "db-*.sql.gz" -mtime +30 -delete
```

## Before upgrading

Always back up before running `docker compose pull && docker compose up -d`.
Database migrations run automatically on startup. If a migration fails, you
can restore from backup and roll back to the previous image tag.

```bash
# Pin to a specific image version in docker-compose.yml:
# image: ghcr.io/lectio-app/lectio:v0.3.0
```

## Export your data (no Docker required)

If you just want a portable copy of your captures, use the in-app export:

1. Log in → **Export** in the sidebar
2. Choose **JSON** (full data including enrichments) or **Markdown ZIP**
3. The export includes all captures and enrichments as of that moment

This is not a full backup (media files are not included), but it's useful for
migrating between instances or archiving your knowledge base.
