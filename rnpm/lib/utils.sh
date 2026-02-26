#!/usr/bin/env bash

set -u  # do not exit on python returning 1

check_files(){
    local required_files=("package-lock.json" ".rnpm")
    local missing_files=()

    for file in "${required_files[@]}"; do
        [[ -f "$file" ]] || missing_files+=("$file")
    done

    if (( ${#missing_files[@]} > 0 )); then
        if (( ${#missing_files[@]} == 1 )); then
            echo "Verification failed. Missing file: ${missing_files[0]}"
        else
            echo "Verification failed. Missing files: ${missing_files[*]}"
        fi
        exit 1
    fi
    return 0
}

parse_record(){
    local line="$1"

    # Local parsing variables
    local record_command record_npm record_node record_time record_os
    local opts_chunk

    # Extract simple fields
    record_command="${line#command:}"
    record_command="${record_command%% *}"

    record_npm="${line#* npm:}"
    record_npm="${record_npm%% *}"

    record_node="${line#* node:}"
    record_node="${record_node%% *}"

    record_time="${line#* time:}"
    record_time="${record_time%% *}"

    record_os="${line#* os:}"
    record_os="${record_os%% *}"

    # Extract options:(...)
    opts_chunk="${line#* options:}"
    opts_chunk="${opts_chunk%% npm:*}"

    # Reconstruct options array
    local record_options=()
    # shellcheck disable=SC2206
    eval "record_options=${opts_chunk}"

    # Export parsed values under clear namespace
    RNPM_RECORD_COMMAND="$record_command"
    RNPM_RECORD_NPM="$record_npm"
    RNPM_RECORD_NODE="$record_node"
    RNPM_RECORD_TIME="$record_time"
    RNPM_RECORD_OS="$record_os"
    RNPM_RECORD_OPTIONS=("${record_options[@]}")

    return 0
}

compare_lock() {
    SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
    SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"

    local lock="$1"
    local new_lock="$2"

    # Compare
    if python3 "$SCRIPT_DIR/compare.py" "$lock" "$new_lock"; then
        echo "Lockfiles match"
    else
        echo "Lockfiles don't match"
    fi
}