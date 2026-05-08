#!/bin/bash

# CSV Format Converter Script
# Converts pipe-delimited CSV files to Excel-compatible comma-delimited format

echo "🔄 Converting Game Theory CSV Files to Excel Format"
echo "=================================================="

# Change to the backend directory
cd "$(dirname "$0")"

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Run the conversion script
if python3 convert_csv_clean.py; then
    echo ""
    echo "🎉 Conversion completed successfully!"
    echo ""
    echo "📁 Excel-ready files created:"
    if [ -f "data_prisoner_clean.csv" ]; then
        echo "  ✅ data_prisoner_clean.csv (Prisoner's Dilemma data)"
    fi
    if [ -f "ultimatum_output_data_clean.csv" ]; then
        echo "  ✅ ultimatum_output_data_clean.csv (Ultimatum Game data)"
    fi
    echo ""
    echo "💡 You can now open these files directly in Excel or Google Sheets!"
else
    echo "❌ Conversion failed. Please check the error messages above."
    exit 1
fi
