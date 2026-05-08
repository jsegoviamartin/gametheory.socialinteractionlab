#!/usr/bin/env python3
"""
Enhanced script to convert pipe-delimited CSV files to comma-delimited CSV files
with proper handling of separator lines and data cleaning.
"""

import csv
import os
import re
from pathlib import Path

def is_separator_line(row):
    """Check if a row is a separator line (contains only dashes and pipes)."""
    if not row:
        return False
    
    # Join all fields and check if it only contains dashes, pipes, spaces, and plus signs
    joined = ''.join(row)
    return bool(re.match(r'^[-|\s+]*$', joined.strip()))

def clean_field(field):
    """Clean a field by stripping whitespace and handling empty values."""
    cleaned = field.strip()
    return cleaned if cleaned else ''

def convert_pipe_to_comma_csv(input_file, output_file):
    """Convert a pipe-delimited CSV file to a comma-delimited CSV file."""
    try:
        with open(input_file, 'r', encoding='utf-8') as infile:
            # Read the pipe-delimited file
            reader = csv.reader(infile, delimiter='|')
            
            with open(output_file, 'w', newline='', encoding='utf-8') as outfile:
                # Write as comma-delimited file
                writer = csv.writer(outfile, delimiter=',', quoting=csv.QUOTE_MINIMAL)
                
                row_count = 0
                skipped_count = 0
                
                for row in reader:
                    # Skip separator lines
                    if is_separator_line(row):
                        skipped_count += 1
                        continue
                    
                    # Clean each field
                    cleaned_row = [clean_field(field) for field in row]
                    
                    # Skip empty rows
                    if not any(cleaned_row):
                        skipped_count += 1
                        continue
                    
                    writer.writerow(cleaned_row)
                    row_count += 1
        
        print(f"✅ Successfully converted {input_file}")
        print(f"   Rows written: {row_count}")
        print(f"   Rows skipped: {skipped_count}")
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
            'output': script_dir / 'data_prisoner_clean.csv',
            'description': 'Prisoner\'s Dilemma Game Data'
        },
        {
            'input': script_dir / 'ultimatum_output_data.csv',
            'output': script_dir / 'ultimatum_output_data_clean.csv',
            'description': 'Ultimatum Game Data'
        }
    ]
    
    print("🔄 Converting CSV files to Excel-compatible format...")
    print("=" * 70)
    
    success_count = 0
    total_count = len(files_to_convert)
    
    for file_info in files_to_convert:
        input_file = file_info['input']
        output_file = file_info['output']
        description = file_info['description']
        
        if not input_file.exists():
            print(f"⚠️  Input file not found: {input_file}")
            continue
            
        print(f"\n📊 {description}")
        print(f"Input:  {input_file.name}")
        print(f"Output: {output_file.name}")
        
        if convert_pipe_to_comma_csv(input_file, output_file):
            success_count += 1
            
            # Show file sizes
            input_size = input_file.stat().st_size
            output_size = output_file.stat().st_size
            print(f"   Input size:  {input_size:,} bytes")
            print(f"   Output size: {output_size:,} bytes")
    
    print("\n" + "=" * 70)
    print(f"✅ Conversion complete: {success_count}/{total_count} files converted successfully")
    
    if success_count > 0:
        print("\n🎉 Excel-ready CSV files created!")
        print("\n📁 Files you can now open in Excel:")
        for file_info in files_to_convert:
            output_file = file_info['output']
            if output_file.exists():
                description = file_info['description']
                print(f"  📈 {output_file.name} - {description}")
        
        print("\n💡 Tips for Excel:")
        print("  • These files use comma separators (standard CSV)")
        print("  • Data should auto-format correctly when opening")
        print("  • Use 'Data > Text to Columns' if needed")
        print("  • Save as .xlsx for better Excel compatibility")

if __name__ == "__main__":
    main()
