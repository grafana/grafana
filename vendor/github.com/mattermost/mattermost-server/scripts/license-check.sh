#!/usr/bin/env bash
set -e
IFS=$'\n'
count=0
for fileType in GoFiles; do
    for file in `go list -f $'{{range .GoFiles}}{{$.Dir}}/{{.}}\n{{end}}' "$@"`; do
        case $file in
            */utils/lru.go|*/store/storetest/mocks/*|*/app/plugin/jira/plugin_*|*/app/plugin/zoom/plugin_*)
            # Third-party, doesn't require a header.
            ;;
        *)
            if ! grep 'Mattermost, Inc. All Rights Reserved.' $file -q; then
                >&2 echo "FAIL: $file is missing a license header."
                ((count++))
            fi
        esac
    done
done
if [ $count -eq 0 ]; then
    exit 0
fi

if [ $count -gt 1 ]; then
    >&2 echo "$count files are missing license headers."
else
    >&2 echo "$count file is missing a license header."
fi
exit 1
