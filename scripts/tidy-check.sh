#!/bin/bash
set -eo pipefail

# Verify that Go is properly installed and available
command -v go >/dev/null 2>&1 || { echo 'please install Go or use an image that has it'; exit 1; }

backup_go_mod_files()
{
    mod=$(mktemp)
    cp go.mod "$mod"

    sum=$(mktemp)
    cp go.sum "$sum"
}

restore_go_mod_files()
{
    cp "$mod" go.mod
    rm "$mod"

    cp "$sum" go.sum
    rm "$sum"
}

# Backup current go.mod and go.sum files
backup_go_mod_files

# Defer the go.mod and go.sum files backup recovery
trap restore_go_mod_files EXIT

# Tidy go.mod and go.sum files
go mod tidy

diff "$mod" go.mod || { echo "your go.mod is inconsistent"; exit 1; }
diff "$sum" go.sum || { echo "your go.sum is inconsistent"; exit 1; }
