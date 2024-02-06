#!/bin/bash

set -eu

PATH=$HOME/Library/Android/sdk/emulator/:$HOME/Library/Android/sdk/platform-tools/:$PATH

cd $(cd $(dirname $0)/..; pwd)
npm run build
adb push main.js styles.css /storage/emulated/0/Documents/obsidian-dev/.obsidian/plugins/obsidian-reminder-plugin/

adb shell am force-stop md.obsidian 
adb shell am start -n 'md.obsidian/md.obsidian.MainActivity' 