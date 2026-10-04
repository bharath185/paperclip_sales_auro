# Auro OpenCode: Database Backup, Restore & Master Key Rotation Guide

This guide covers operational backup routines, disaster recovery restoration, and cryptographic master key rotation for Auro OpenCode instances.

---

## 1. Database Backup Procedures

### A. Dockerized PostgreSQL Backup
To create an encrypted snapshot of the production PostgreSQL database:

```bash
# 1. Generate timestamped dump
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
docker compose exec -T db pg_dump -U auro -d auro_db -F c -b -v > "auro_backup_${TIMESTAMP}.dump"

# 2. Verify dump integrity
ls -lh auro_backup_*.dump
```

### B. Embedded PGlite Backup
If running locally with embedded PGlite:

```bash
# Archive the local pglite data directory
tar -czvf "auro_pglite_backup_$(date +%Y%m%d).tar.gz" data/pglite/
```

---

## 2. Disaster Recovery & Restoration

### Restoring to PostgreSQL Container:
```bash
# 1. Stop the application container to prevent incoming writes
docker compose stop app

# 2. Restore the database from the dump file
docker compose exec -T db dropdb -U auro auro_db --if-exists
docker compose exec -T db createdb -U auro auro_db
cat auro_backup_YYYYMMDD_HHMMSS.dump | docker compose exec -T db pg_restore -U auro -d auro_db -v

# 3. Restart the application container and verify health
docker compose start app
curl -s http://localhost:3100/api/health | jq .status
```

---

## 3. Master Key Rotation (`APP_ENCRYPTION_KEY`)

When rotating the cryptographic key used for encrypting stored CRM tokens, webhook secrets, and provider keys:

### Rotation Workflow:
1. **Generate New Key**:
   ```bash
   NEW_KEY=$(node -e "console.log(crypto.randomBytes(32).toString('hex'))")
   echo "New Key: $NEW_KEY"
   ```

2. **Execute Re-encryption Service**:
   Use the built-in `SecretsManager` service to decrypt all stored secrets using the legacy key and re-encrypt with the new key version header (`enc:v2:...`):
   ```bash
   # Run key rotation runner
   OLD_KEY="<current-app-encryption-key>" NEW_KEY="$NEW_KEY" node scripts/rotate-secrets.mjs
   ```

3. **Update Environment**:
   Update `APP_ENCRYPTION_KEY` in `.env` (or Docker secrets) to the newly generated key.

4. **Restart Application**:
   ```bash
   docker compose restart app
   ```

5. **Verify Rotation**:
   All encrypted records now use the active key version without service interruption.
