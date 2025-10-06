#!/bin/bash

# Stop any running instances of the application
pkill -f "homeflix" || true

# Define paths
DB_FILE="$PWD/homeflix.db"
BACKUP_DIR="$PWD/db_backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/homeflix_backup_$TIMESTAMP.db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database exists and back it up
if [ -f "$DB_FILE" ]; then
    echo "🔍 Found existing database, creating backup..."
    cp "$DB_FILE" "$BACKUP_FILE"
    echo "✅ Database backed up to $BACKUP_FILE"
    
    # Remove the existing database
    rm -f "$DB_FILE"
    echo "🗑️  Removed existing database"
else
    echo "ℹ️  No existing database found, creating a new one..."
fi

# Check if we need to build the application
if [ ! -f "$PWD/main" ]; then
    echo "🔨 Building application..."
    go build -o main .
    if [ $? -ne 0 ]; then
        echo "❌ Failed to build application"
        exit 1
    fi
    echo "✅ Application built successfully"
fi

# Run the application in the background to initialize the database
# with a timeout to ensure it doesn't hang
{
    echo "🚀 Starting application to initialize database..."
    timeout 10s ./main || {
        echo "ℹ️  Application stopped, database should be initialized"
    }
} &

# Wait a moment for the database to be created
sleep 3

# Check if database was created successfully
if [ -f "$DB_FILE" ]; then
    echo "✅ Database initialized successfully at $DB_FILE"
    
    # Display database info
    echo "\n📊 Database information:"
    sqlite3 "$DB_FILE" ".tables" | awk '{print "Tables in database: " $0}'
    
    # Count records in each table
    echo "\n📋 Record counts:"
    TABLES=$(sqlite3 "$DB_FILE" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    for table in $TABLES; do
        COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM \"$table\";")
        echo "- $table: $COUNT records"
    done
    
    echo "\n✨ Database reset complete!"
else
    echo "❌ Failed to initialize database"
    exit 1
fi
