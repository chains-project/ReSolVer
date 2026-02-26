rnpm_record() {
    local command="$1"
    shift

    local npm_version node_version time os_info

    npm_version=$(npm -v)
    node_version=$(node -v)
    time=$(date -u '+%Y-%m-%dT%H:%M:%S.%3NZ') #RFC 3339
    os_info=$(cat /proc/sys/kernel/osrelease)

    # Make array for literals for easy parsing
    local quoted_args=()
    local arg

    for arg in "$@"; do
        quoted_args+=("$(printf '%q' "$arg")")
    done

    local options="(${quoted_args[*]})"

    local record
    record="command:$command options:$options npm:$npm_version node:$node_version time:$time os:$os_info"

    if [[ "$command" == "update" ]]; then
        echo "$record" > .rnpm
    else
        echo "$record" >> .rnpm
    fi
}