#!/bin/bash
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$PATH"
cd /Volumes/workspace/avatar-studio
exec node ./node_modules/.bin/vite --port 5174
