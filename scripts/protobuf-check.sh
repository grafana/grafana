#!/usr/bin/env bash

# Check whether buf cli is installed
BUF_HELP_URL="https://buf.build/docs/installation"

EXIT_CODE=0

if ! [ -x "$(command -v buf)" ]; then
	echo "Buf CLI not found."
	echo "Please install Buf CLI and ensure 'buf' is available in your PATH."
	echo "See ${BUF_HELP_URL} for help."
	echo
	EXIT_CODE=1
fi

exit $EXIT_CODE
