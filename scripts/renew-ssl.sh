#!/bin/bash

# SSL Certificate Renewal Script
# This script renews Let's Encrypt certificates and reloads nginx

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

echo -e "${BLUE}Starting SSL certificate renewal process...${RESET}"

# Check if we're in the project directory
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Error: docker-compose.yml not found. Please run this script from the project root directory.${RESET}"
    exit 1
fi

# Create certbot directory if it doesn't exist
mkdir -p certbot/conf
mkdir -p certbot/www

# Try to renew certificates
echo -e "${YELLOW}Attempting to renew SSL certificates...${RESET}"

# Run certbot renewal with proper flags to avoid interactive prompts
echo -e "${BLUE}Running certbot renewal command...${RESET}"
RENEWAL_OUTPUT=$(docker run --rm \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  certbot/certbot renew \
  --webroot \
  --webroot-path=/var/www/certbot \
  --non-interactive \
  --agree-tos \
  --quiet 2>&1)
RENEWAL_EXIT_CODE=$?

echo -e "${BLUE}Certbot exit code: $RENEWAL_EXIT_CODE${RESET}"

if [ $RENEWAL_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}Certificate renewal successful!${RESET}"
    
    # Reload nginx to use the new certificates
    echo -e "${YELLOW}Reloading nginx configuration...${RESET}"
    if docker compose exec nginx nginx -s reload; then
        echo -e "${GREEN}Nginx reloaded successfully!${RESET}"
    else
        echo -e "${RED}Warning: Failed to reload nginx. You may need to restart the nginx container.${RESET}"
        echo -e "${YELLOW}Attempting to restart nginx container...${RESET}"
        docker compose restart nginx
    fi
    
    echo -e "${GREEN}SSL certificate renewal completed successfully!${RESET}"
elif echo "$RENEWAL_OUTPUT" | grep -q "Certificate not yet due for renewal"; then
    echo -e "${GREEN}Certificate is still valid and not due for renewal.${RESET}"
    echo -e "${BLUE}Checking certificate status...${RESET}"
    
    # Check certificate expiration
    if command -v openssl >/dev/null 2>&1 && [ -f "certbot/conf/live/gametheory.socialinteractionlab.org/fullchain.pem" ]; then
        echo -e "${BLUE}Certificate expiration info:${RESET}"
        openssl x509 -in certbot/conf/live/gametheory.socialinteractionlab.org/fullchain.pem -text -noout | grep -A2 "Validity"
    fi
else
    echo -e "${RED}Certificate renewal failed:${RESET}"
    echo "$RENEWAL_OUTPUT"
    exit 1
fi

echo -e "${GREEN}SSL renewal process completed.${RESET}"
