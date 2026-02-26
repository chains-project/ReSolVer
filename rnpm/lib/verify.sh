#!/usr/bin/env bash

verify_rnpm_record(){
    local SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
    local SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"

    source "$SCRIPT_DIR/utils.sh"
    # Verify required files
    if ! check_files; then 
        return 1
    fi

    # Make sure package.json does not affect resolution. THIS IS A TEST
    if [[ -f "package.json" ]]; then
        mv "package.json" ".package.json"
        npm init -y > /dev/null 2>&1
    fi

    # Temporarily rename the lockfile
    mv package-lock.json lockfile.original

    # Separate read by lines
    local IFS=$'\n'
    # Loop over .rnpm
    while read line; do
        npm cache clean --force
        # Read in and set variables
        parse_record $line
        # Set node version
        if [[ "$(node -v)" != "$RNPM_RECORD_NODE" ]]; then
            sudo n "$RNPM_RECORD_NODE"
        fi
        # Update registry (only supports npm reg for now)
        REGISTRY="http://npm:$RNPM_RECORD_TIME@localhost:8081"
        # Perform resolution
        echo "$REGISTRY" 
        npm \
        --registry "$REGISTRY" \
        install \
        "${RNPM_RECORD_OPTIONS[@]}" \
        --package-lock-only \
        --no-fund
    done < .rnpm

    # Rename new lockfile & move back original
    mv package-lock.json package-lock.rnpm
    mv lockfile.original package-lock.json
    
    compare_lock package-lock.json package-lock.rnpm
}