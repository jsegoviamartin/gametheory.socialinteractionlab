#!/bin/bash

# Setup SSL Certificate Renewal Cron Job
# This script sets up automatic SSL certificate renewal

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

echo -e "${BLUE}Setting up SSL certificate renewal cron job...${RESET}"

# Get the current directory (project root)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RENEWAL_SCRIPT="$PROJECT_DIR/scripts/renew-ssl.sh"

echo -e "${YELLOW}Project directory: $PROJECT_DIR${RESET}"
echo -e "${YELLOW}Renewal script: $RENEWAL_SCRIPT${RESET}"

# Check if the renewal script exists
if [ ! -f "$RENEWAL_SCRIPT" ]; then
    echo -e "${RED}Error: Renewal script not found at $RENEWAL_SCRIPT${RESET}"
    exit 1
fi

# Make sure the script is executable
chmod +x "$RENEWAL_SCRIPT"

# Create the cron job entry
CRON_JOB="0 2 * * * cd $PROJECT_DIR && $RENEWAL_SCRIPT >> /var/log/ssl-renewal.log 2>&1"

echo -e "${BLUE}Adding cron job for SSL certificate renewal...${RESET}"
echo -e "${YELLOW}Cron job will run daily at 2:00 AM${RESET}"

# Add the cron job (this will add it to the current user's crontab)
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo -e "${GREEN}SSL certificate renewal cron job has been set up successfully!${RESET}"
echo -e "${BLUE}The certificate will be checked for renewal daily at 2:00 AM${RESET}"
echo -e "${YELLOW}To view the cron job, run: crontab -l${RESET}"
echo -e "${YELLOW}To remove the cron job, run: crontab -e${RESET}"

# Show the current crontab
echo -e "${BLUE}Current crontab entries:${RESET}"
crontab -l
