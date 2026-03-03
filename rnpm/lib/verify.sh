#!/usr/bin/env bash
verify_rnpm_hash(){
    # Function to call at the beginning of every rnpm command
    # Improves consistency if a file is manually edited

    # Verify required files
    check_files
    rc=$?
    if (( rc != E_SUCCESS )); then
        return $rc
    fi

    local DIR manifest_hash lock_hash 

    DIR=$1

    manifest_hash=$(sha256sum "$DIR/package.json" | awk '{print $1}')
    lock_hash=$(sha256sum "$DIR/package-lock.json" | awk '{print $1}')

    parse_record "$(tail -n1 "$DIR/.rnpm")" # Sets RNPM_* variables

    if [[ "$manifest_hash" != "$RNPM_RECORD_MANIFEST_HASH" ]]; then
        if [[ "$lock_hash" != "$RNPM_RECORD_LOCK_HASH" ]]; then
            echo "What have you done? Integrity check of package.json and package-lock.json failed. Running a cool function that fixes everything (maybe)"
            return $E_ALL_HASH_MISMATCH
        else
            echo "Integrity check of package.json failed. Running a cool function that fixes everything (perchance)"
            return $E_MANIFEST_HASH_MISMATCH
        fi
    elif [[ "$lock_hash" != "$RNPM_RECORD_LOCK_HASH" ]]; then
        echo "Integrity check of package-lock.json failed. *Option to update and fix lockfile drift here*"
        return $E_LOCK_HASH_MISMATCH
    fi
    return $E_SUCCESS
}

verify_rnpm_record(){
    # TODO: instead of renaming files, maybe create a temporary dir?

    # Verify required files
    check_files
    rc=$?
    if (( rc != E_SUCCESS )); then
        return $rc
    fi

    # Make sure package.json does not affect resolution.
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