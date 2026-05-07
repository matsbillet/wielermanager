#!/bin/bash
cd "$(dirname "$0")/backend" && node src/app.js &
cd "$(dirname "$0")/frontend" && npm run dev &
wait