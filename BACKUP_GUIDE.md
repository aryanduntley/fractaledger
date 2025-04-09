# FractaLedger Backup Guide

This guide provides detailed instructions for backing up all necessary data from Hyperledger Fabric when using FractaLedger. Regular backups are essential to prevent data loss and ensure business continuity.

## Table of Contents

1. [Understanding What to Back Up](#understanding-what-to-back-up)
2. [Backup Prerequisites](#backup-prerequisites)
3. [Backing Up Docker Volumes](#backing-up-docker-volumes)
4. [Backing Up Crypto Material](#backing-up-crypto-material)
5. [Backing Up Wallet Data](#backing-up-wallet-data)
6. [Backing Up Configuration Files](#backing-up-configuration-files)
7. [Automated Backup Script](#automated-backup-script)
8. [Backup Verification](#backup-verification)
9. [Backup Restoration](#backup-restoration)
10. [Backup Best Practices](#backup-best-practices)
11. [Troubleshooting](#troubleshooting)

## Understanding What to Back Up

When using FractaLedger with Hyperledger Fabric, there are four main categories of data that need to be backed up:

1. **Docker Volumes**: These contain the blockchain ledger data, world state database, and other persistent data used by the Hyperledger Fabric network.

2. **Crypto Material**: These are the certificates, keys, and other cryptographic material used for authentication and transaction signing.

3. **Wallet Data**: This includes identity information used by the client application to connect to the Hyperledger Fabric network.

4. **Configuration Files**: These include connection profiles, environment variables, and other configuration settings.

## Backup Prerequisites

Before performing a backup, ensure you have:

- Sufficient disk space for the backup files
- Appropriate permissions to access Docker volumes and project directories
- A secure location to store the backup files (preferably off-site or in cloud storage)
- Docker and Docker Compose installed (for backing up Docker volumes)
- Basic command-line knowledge

## Backing Up Docker Volumes

Hyperledger Fabric stores its data in Docker volumes. These volumes contain the blockchain ledger data, world state database (CouchDB), and other persistent data.

### 1. Identify Docker Volumes to Back Up

First, list all Docker volumes to identify the ones related to Hyperledger Fabric:

```bash
docker volume ls | grep fabric
```

You should see volumes with names like:
- `peer0.org1.example.com`
- `couchdb0`
- `orderer.example.com`

### 2. Create a Backup Directory

```bash
# Create a backup directory with timestamp
BACKUP_DIR="fabric-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_DIR
```

### 3. Back Up Each Volume

For each volume, use the following command to create a backup:

```bash
# For peer volume
docker run --rm -v peer0.org1.example.com:/source -v $(pwd)/$BACKUP_DIR:/backup \
  -w /source alpine tar -czf /backup/peer0.org1.example.com.tar.gz .

# For CouchDB volume
docker run --rm -v couchdb0:/source -v $(pwd)/$BACKUP_DIR:/backup \
  -w /source alpine tar -czf /backup/couchdb0.tar.gz .

# For orderer volume
docker run --rm -v orderer.example.com:/source -v $(pwd)/$BACKUP_DIR:/backup \
  -w /source alpine tar -czf /backup/orderer.example.com.tar.gz .
```

This approach uses a temporary Alpine Linux container to access the volume data and create a compressed archive.

### 4. Verify Docker Volume Backups

Check that the backup files were created and have non-zero size:

```bash
ls -lh $BACKUP_DIR
```

## Backing Up Crypto Material

The crypto material includes certificates, keys, and other cryptographic material used for authentication and transaction signing. This material is stored in the `crypto-config` directory in your project.

### 1. Create a Backup of the Crypto Material

```bash
# Backup the crypto-config directory
tar -czf $BACKUP_DIR/crypto-config.tar.gz -C /path/to/your/project crypto-config/
```

### 2. Verify Crypto Material Backup

```bash
# Check the backup file
ls -lh $BACKUP_DIR/crypto-config.tar.gz
```

## Backing Up Wallet Data

The wallet data includes identity information used by the client application to connect to the Hyperledger Fabric network. This data is stored in the `wallet` directory in your project.

### 1. Create a Backup of the Wallet Data

```bash
# Backup the wallet directory
tar -czf $BACKUP_DIR/wallet.tar.gz -C /path/to/your/project wallet/
```

### 2. Verify Wallet Data Backup

```bash
# Check the backup file
ls -lh $BACKUP_DIR/wallet.tar.gz
```

## Backing Up Configuration Files

Configuration files include connection profiles, environment variables, and other settings. These files are essential for reconnecting to the Hyperledger Fabric network after a restore.

### 1. Create a Backup of Configuration Files

```bash
# Backup configuration files
tar -czf $BACKUP_DIR/config-files.tar.gz -C /path/to/your/project \
  fractaledger.json connection-profile.json .env
```

### 2. Verify Configuration Files Backup

```bash
# Check the backup file
ls -lh $BACKUP_DIR/config-files.tar.gz
```

## Automated Backup Script

To automate the backup process, you can create a shell script that performs all the necessary backup steps. Here's an example script:

```bash
#!/bin/bash
# fabric-backup.sh - Automated backup script for Hyperledger Fabric

# Exit on error
set -e

# Configuration
PROJECT_DIR="/path/to/your/project"
BACKUP_ROOT="/path/to/backup/storage"
RETENTION_DAYS=30

# Create backup directory with timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/fabric-backup-$TIMESTAMP"
mkdir -p $BACKUP_DIR

# Log function
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting Hyperledger Fabric backup..."

# 1. Back up Docker volumes
log "Backing up Docker volumes..."

# Get list of Fabric-related volumes
FABRIC_VOLUMES=$(docker volume ls -q | grep fabric)

for VOLUME in $FABRIC_VOLUMES; do
  log "Backing up volume: $VOLUME"
  docker run --rm -v $VOLUME:/source -v $BACKUP_DIR:/backup \
    -w /source alpine tar -czf /backup/${VOLUME}.tar.gz .
done

# 2. Back up crypto material
log "Backing up crypto material..."
if [ -d "$PROJECT_DIR/crypto-config" ]; then
  tar -czf $BACKUP_DIR/crypto-config.tar.gz -C $PROJECT_DIR crypto-config/
else
  log "Warning: crypto-config directory not found, skipping..."
fi

# 3. Back up wallet data
log "Backing up wallet data..."
if [ -d "$PROJECT_DIR/wallet" ]; then
  tar -czf $BACKUP_DIR/wallet.tar.gz -C $PROJECT_DIR wallet/
else
  log "Warning: wallet directory not found, skipping..."
fi

# 4. Back up configuration files
log "Backing up configuration files..."
tar -czf $BACKUP_DIR/config-files.tar.gz -C $PROJECT_DIR \
  fractaledger.json connection-profile.json .env

# 5. Create backup metadata
cat > $BACKUP_DIR/backup-info.txt << EOF
Backup Date: $(date)
Hostname: $(hostname)
Project Directory: $PROJECT_DIR
Docker Volumes: $FABRIC_VOLUMES
EOF

# 6. Create a single archive of the entire backup
log "Creating final backup archive..."
FINAL_BACKUP="$BACKUP_ROOT/fabric-backup-$TIMESTAMP.tar.gz"
tar -czf $FINAL_BACKUP -C $BACKUP_ROOT fabric-backup-$TIMESTAMP

# 7. Clean up temporary files
log "Cleaning up temporary files..."
rm -rf $BACKUP_DIR

# 8. Remove old backups (retention policy)
log "Applying retention policy ($RETENTION_DAYS days)..."
find $BACKUP_ROOT -name "fabric-backup-*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete

log "Backup completed successfully: $FINAL_BACKUP"
```

Save this script as `fabric-backup.sh`, make it executable with `chmod +x fabric-backup.sh`, and schedule it to run regularly using cron:

```bash
# Edit crontab
crontab -e

# Add a line to run the backup script daily at 2 AM
0 2 * * * /path/to/fabric-backup.sh >> /path/to/backup.log 2>&1
```

## Backup Verification

It's essential to verify that your backups are valid and can be restored if needed. Here's how to verify your backups:

### 1. Check Backup Files

Ensure all backup files exist and have non-zero size:

```bash
ls -lh /path/to/backup/storage
```

### 2. Test Extraction

Periodically test extracting the backup files to ensure they're not corrupted:

```bash
# Create a temporary directory
mkdir -p /tmp/backup-test

# Extract a backup file
tar -xzf /path/to/backup/storage/fabric-backup-YYYYMMDD-HHMMSS.tar.gz -C /tmp/backup-test

# Check the extracted files
ls -la /tmp/backup-test

# Clean up
rm -rf /tmp/backup-test
```

### 3. Perform Test Restores

Periodically perform a complete test restore in a non-production environment to ensure your backup and restore procedures work correctly.

## Backup Restoration

In case of data loss or system failure, you'll need to restore your Hyperledger Fabric data from backups. Here's how to restore each component:

### 1. Restore Docker Volumes

```bash
# Stop the Fabric network
cd /path/to/fabric-samples/test-network
./network.sh down

# Extract the backup
mkdir -p /tmp/volume-restore
tar -xzf /path/to/backup/peer0.org1.example.com.tar.gz -C /tmp/volume-restore

# Restore the volume
docker volume create peer0.org1.example.com
docker run --rm -v peer0.org1.example.com:/destination -v /tmp/volume-restore:/source \
  -w /source alpine sh -c "cp -a . /destination/"

# Repeat for other volumes (couchdb0, orderer.example.com, etc.)

# Clean up
rm -rf /tmp/volume-restore
```

### 2. Restore Crypto Material

```bash
# Remove existing crypto-config directory if it exists
rm -rf /path/to/your/project/crypto-config

# Extract the backup
tar -xzf /path/to/backup/crypto-config.tar.gz -C /path/to/your/project
```

### 3. Restore Wallet Data

```bash
# Remove existing wallet directory if it exists
rm -rf /path/to/your/project/wallet

# Extract the backup
tar -xzf /path/to/backup/wallet.tar.gz -C /path/to/your/project
```

### 4. Restore Configuration Files

```bash
# Extract the backup
tar -xzf /path/to/backup/config-files.tar.gz -C /path/to/your/project
```

### 5. Restart the Fabric Network

```bash
cd /path/to/fabric-samples/test-network
./network.sh up
```

### 6. Verify the Restoration

After restoring all components, verify that the Hyperledger Fabric network is functioning correctly:

```bash
# Check Docker containers
docker ps

# Check logs for errors
docker logs peer0.org1.example.com
```

## Backup Best Practices

1. **Regular Backups**: Schedule backups to run regularly (daily or more frequently for critical systems).

2. **Off-site Storage**: Store backups in a different physical location or cloud storage to protect against site-wide disasters.

3. **Encryption**: Encrypt backup files, especially if they contain sensitive information like private keys.

4. **Retention Policy**: Implement a retention policy to manage backup storage space while ensuring you have sufficient history.

5. **Documentation**: Document your backup and restore procedures and keep them up to date.

6. **Testing**: Regularly test your backup and restore procedures to ensure they work when needed.

7. **Monitoring**: Monitor backup jobs and alert on failures.

8. **Incremental Backups**: Consider implementing incremental backups for large volumes to reduce backup time and storage requirements.

## Troubleshooting

### Common Backup Issues

1. **Insufficient Disk Space**
   - **Symptom**: Backup fails with "No space left on device" error
   - **Solution**: Free up disk space or use a different backup location with more space

2. **Permission Denied**
   - **Symptom**: Backup fails with "Permission denied" error
   - **Solution**: Ensure the user running the backup script has appropriate permissions

3. **Docker Volume Not Found**
   - **Symptom**: Backup fails with "No such volume" error
   - **Solution**: Verify the volume name and ensure Docker is running

### Common Restoration Issues

1. **Incompatible Versions**
   - **Symptom**: After restoration, Fabric components fail to start or communicate
   - **Solution**: Ensure you're restoring to the same Fabric version as the backup

2. **Missing Configuration**
   - **Symptom**: Components start but fail to connect to each other
   - **Solution**: Verify all configuration files were restored correctly

3. **Corrupted Backup**
   - **Symptom**: Extraction fails or extracted files are incomplete
   - **Solution**: Use a different backup or implement backup verification to prevent this issue

## Conclusion

Regular backups are essential for protecting your Hyperledger Fabric data and ensuring business continuity. By following this guide, you can implement a comprehensive backup strategy for your FractaLedger deployment.

Remember to regularly test your backup and restore procedures to ensure they work when needed. A backup is only as good as your ability to restore from it.

For more information about Hyperledger Fabric setup and configuration, refer to the [Hyperledger Fabric Setup Guide](HYPERLEDGER_FABRIC_SETUP.md) and [Installation Guide](INSTALLATION_GUIDE.md).
