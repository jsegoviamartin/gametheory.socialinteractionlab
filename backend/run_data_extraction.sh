#!/bin/bash

echo "🚀 Game Theory Data Extraction Suite"
echo "======================================"
echo ""

# Check if we're in the right directory
if [ ! -f "extract_all_game_data.sql" ]; then
    echo "❌ Error: Please run this script from the backend directory"
    echo "Expected file: extract_all_game_data.sql"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker first."
    exit 1
fi

echo "📊 Starting comprehensive data extraction..."
echo ""

# Copy the SQL script to the container first
echo "🔄 Copying SQL script to container..."
docker cp extract_all_game_data.sql $(docker compose ps -q db):/tmp/

# Run the unified SQL script
echo "🔄 Executing unified data extraction script..."
if docker compose exec -T db psql -U postgres -d "my_db" -f /tmp/extract_all_game_data.sql; then
    echo ""
    echo "✅ Data extraction completed successfully!"
else
    echo "❌ Failed to extract data"
    echo ""
    exit 1
fi

# Copy CSV files from container to host
echo "🔄 Copying CSV files from container to host..."
docker cp $(docker compose ps -q db):/tmp/data_prisoner.csv ./data_prisoner.csv 2>/dev/null || echo "⚠️  data_prisoner.csv not found in container"
docker cp $(docker compose ps -q db):/tmp/ultimatum_output_data.csv ./ultimatum_output_data.csv 2>/dev/null || echo "⚠️  ultimatum_output_data.csv not found in container"

# Create clean copies for Excel
echo "🔄 Creating Excel-ready copies..."
cp data_prisoner.csv data_prisoner_clean.csv 2>/dev/null || echo "⚠️  data_prisoner.csv not found"
cp ultimatum_output_data.csv ultimatum_output_data_clean.csv 2>/dev/null || echo "⚠️  ultimatum_output_data.csv not found"

# Summary
echo ""
echo "📋 EXTRACTION SUMMARY"
echo "===================="
echo ""

echo "📁 Generated Files:"

if [ -f "data_prisoner.csv" ] && [ -f "data_prisoner_clean.csv" ]; then
    prisoner_raw_size=$(stat -c%s "data_prisoner.csv" 2>/dev/null || echo "unknown")
    prisoner_clean_size=$(stat -c%s "data_prisoner_clean.csv" 2>/dev/null || echo "unknown")
    prisoner_rows=$(wc -l < "data_prisoner.csv" 2>/dev/null || echo "unknown")
    echo "  🎯 Prisoner's Dilemma:"
    echo "     ├── data_prisoner.csv (raw: ${prisoner_raw_size} bytes, ${prisoner_rows} lines)"
    echo "     └── data_prisoner_clean.csv (Excel: ${prisoner_clean_size} bytes)"
else
    echo "  ❌ Prisoner's Dilemma files missing"
fi

if [ -f "ultimatum_output_data.csv" ] && [ -f "ultimatum_output_data_clean.csv" ]; then
    ultimatum_raw_size=$(stat -c%s "ultimatum_output_data.csv" 2>/dev/null || echo "unknown")
    ultimatum_clean_size=$(stat -c%s "ultimatum_output_data_clean.csv" 2>/dev/null || echo "unknown")
    ultimatum_rows=$(wc -l < "ultimatum_output_data.csv" 2>/dev/null || echo "unknown")
    echo "  🎲 Ultimatum Game:"
    echo "     ├── ultimatum_output_data.csv (raw: ${ultimatum_raw_size} bytes, ${ultimatum_rows} lines)"
    echo "     └── ultimatum_output_data_clean.csv (Excel: ${ultimatum_clean_size} bytes)"
else
    echo "  ❌ Ultimatum Game files missing"
fi

echo ""
echo "💡 Usage Tips:"
echo "  • Use *_clean.csv files for Excel/Google Sheets"
echo "  • Raw .csv files preserve original database format"
echo "  • Files are updated each time you run the extraction"
echo "  • All columns are included without exception"

echo ""
echo "🎉 Comprehensive data extraction complete!"
