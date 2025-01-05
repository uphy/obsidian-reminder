#!/bin/bash

# This script builds, deploy, and reload Obsidian
# To reload Obsidian, you need to set Cmd+R to `Reload app without saving` action.
# This works only in mac.

function deploy(){
    local dest=$1
    mkdir -p $dest
    cp -f main.js manifest.json styles.css $dest
    echo deployed to $dest
}

function reloadObsidian() {
osascript <<EOS
    activate application "Obsidian"
    delay 0.5
    tell application "System Events"
        tell application process "Obsidian"
            tell window (get name of first window whose name contains "obsidian-dev")
                perform action "AXRaise"
                repeat 10 times
                    -- ESC key to close modals of Obsidian
                    key code 53
                end repeat
                -- Reload Obsidian's window
                keystroke "r" using {command down}
            end tell
        end tell
    end tell
EOS
}

npm run dev

for target in $(cat deploy-targets.txt)
do
    deploy "$target"
done

reloadObsidian
