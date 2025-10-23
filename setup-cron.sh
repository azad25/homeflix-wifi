#!/bin/bash

# Setup cron job to start HomeFlix on reboot
echo "Setting up cron job for HomeFlix auto-start..."

# Create cron job that runs 2 minutes after reboot
(crontab -l 2>/dev/null; echo "@reboot sleep 120 && /home/azad/homeflix-local/homeflix-wifi/start-background.sh") | crontab -

echo "✅ Cron job created!"
echo "HomeFlix will start 2 minutes after system boot"
echo ""
echo "To remove the cron job:"
echo "crontab -e"
echo "Then delete the HomeFlix line"