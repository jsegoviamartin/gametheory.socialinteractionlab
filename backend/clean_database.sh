#!/bin/bash

echo "🧹 Database Cleanup for Fresh Testing"
echo "====================================="
echo ""

# Check if we're in the right directory
if [ ! -f "clean_database.sql" ]; then
    echo "❌ Error: Please run this script from the backend directory"
    echo "Expected file: clean_database.sql"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker first."
    exit 1
fi

echo "⚠️  WARNING: This will delete ALL game data!"
echo "This includes:"
echo "  • All Prisoner's Dilemma matches and rounds"
echo "  • All Ultimatum Game matches and rounds"
echo "  • All survey data"
echo "  • All player data"
echo ""
echo "This action cannot be undone!"
echo ""

# Ask for confirmation
read -p "Are you sure you want to proceed? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Cleanup cancelled."
    exit 0
fi

echo ""
echo "🔄 Starting database cleanup..."

# Copy the SQL script to the container
echo "📋 Copying cleanup script to container..."
docker cp clean_database.sql $(docker compose ps -q db):/tmp/

# Run the cleanup script
echo "🗑️  Executing database cleanup..."
if docker compose exec -T db psql -U postgres -d "my_db" -f /tmp/clean_database.sql; then
    echo ""
    echo "✅ Database cleanup completed successfully!"
    echo ""
    echo "🎯 Your database is now clean and ready for fresh testing!"
    echo ""
    echo "💡 Next steps:"
    echo "  • Start your game application"
    echo "  • Run new tests"
    echo "  • Use ./run_data_extraction.sh to extract new data when ready"
else
    echo "❌ Database cleanup failed!"
    echo ""
    exit 1
fi
