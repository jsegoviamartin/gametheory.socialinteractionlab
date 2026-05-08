#!/usr/bin/env python3
"""
Script to convert pipe-delimited CSV files to comma-delimited CSV files
for better compatibility with Excel and other spreadsheet software.
"""

import csv
import os
import sys
from pathlib import Path

def convert_pipe_to_comma_csv(input_file, output_file):
    """Convert a pipe-delimited CSV file to a comma-delimited CSV file."""
    try:
        with open(input_file, 'r', encoding='utf-8') as infile:
            # Read the pipe-delimited file
            reader = csv.reader(infile, delimiter='|')
            
            with open(output_file, 'w', newline='', encoding='utf-8') as outfile:
                # Write as comma-delimited file
                writer = csv.writer(outfile, delimiter=',', quoting=csv.QUOTE_MINIMAL)
                
                for row in reader:
                    # Strip whitespace from each field
                    cleaned_row = [field.strip() for field in row]
                    writer.writerow(cleaned_row)
        
        print(f"✅ Successfully converted {input_file} to {output_file}")
        return True
        
    except Exception as e:
        print(f"❌ Error converting {input_file}: {str(e)}")
        return False

def main():
    """Main function to convert CSV files."""
    script_dir = Path(__file__).parent
    
    # Define input and output files
    files_to_convert = [
        {
            'input': script_dir / 'data_prisoner.csv',
            'output': script_dir / 'data_prisoner_formatted.csv'
        },
        {
            'input': script_dir / 'ultimatum_output_data.csv',
            'output': script_dir / 'ultimatum_output_data_formatted.csv'
        }
    ]
    
    print("🔄 Converting pipe-delimited CSV files to comma-delimited format...")
    print("=" * 60)
    
    success_count = 0
    total_count = len(files_to_convert)
    
    for file_info in files_to_convert:
        input_file = file_info['input']
        output_file = file_info['output']
        
        if not input_file.exists():
            print(f"⚠️  Input file not found: {input_file}")
            continue
            
        print(f"Converting: {input_file.name} -> {output_file.name}")
        
        if convert_pipe_to_comma_csv(input_file, output_file):
            success_count += 1
            
            # Show file sizes
            input_size = input_file.stat().st_size
            output_size = output_file.stat().st_size
            print(f"   Input size: {input_size:,} bytes")
            print(f"   Output size: {output_size:,} bytes")
        
        print()
    
    print("=" * 60)
    print(f"✅ Conversion complete: {success_count}/{total_count} files converted successfully")
    
    if success_count > 0:
        print("\n📊 The formatted CSV files are now ready for use with Excel!")
        print("Files created:")
        for file_info in files_to_convert:
            output_file = file_info['output']
            if output_file.exists():
                print(f"  - {output_file.name}")

if __name__ == "__main__":
    main()
