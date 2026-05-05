#!/bin/bash
cd /home/deck/fibro-web
python3 -m http.server 3000 &
sleep 2
flatpak run org.mozilla.firefox http://localhost:4000/index.html
