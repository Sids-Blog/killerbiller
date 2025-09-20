# Database Setup and Migration

## ⚠️ IMPORTANT WARNING

**NEVER run `setup.sql` on a production database with existing data!** 
The `setup.sql` file will **DELETE ALL EXISTING DATA** including users, customers, bills, etc.

## Files

### `setup.sql` 
- **ONLY for new installations or when you want to start fresh**
- Drops and recreates ALL tables, functions, and data
- Use this only when setting up a completely new database

### `migrate_safe.sql` ✅ **SAFE FOR EXISTING DATABASES**
- **Use this for existing databases that already have data**
- Only adds new functionality without deleting existing data
- Safely adds auto-numbering for bills and orders
- Preserves all existing users, customers, bills, etc.

## Auto-Numbering Format

The application now uses the following auto-numbering format:

- **Bills**: `NAEBILL000001`, `NAEBILL000002`, etc.
- **Orders**: `NAEORD000001`, `NAEORD000002`, etc.

## When to Use Which Script

### Use `setup.sql` when:
- Setting up a brand new database
- You want to start completely fresh
- You don't mind losing all existing data

### Use `migrate_safe.sql` when:
- You have an existing database with data
- You want to add auto-numbering functionality
- You want to preserve all existing data

## Migration Process

### For Existing Installations (Recommended)
1. **Backup your database first!**
2. Run `migrate_safe.sql` to add auto-numbering without losing data
3. The auto-numbering will work automatically for new bills and orders

### For New Installations
1. Run `setup.sql` to create the complete database schema
2. The auto-numbering will work automatically from the start

## Recovery

If you accidentally ran `setup.sql` and lost data:
1. Check if you have database backups
2. Check if you have application-level backups
3. Contact your database administrator for recovery options

## Security Note

Always backup your database before running any migration scripts, even the safe ones!
