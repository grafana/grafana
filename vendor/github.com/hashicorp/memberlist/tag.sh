#!/usr/bin/env bash
# Copyright (c) HashiCorp, Inc.
# SPDX-License-Identifier: MPL-2.0

set -e

# The version must be supplied from the environment. Do not include the
# leading "v".
if [ -z $VERSION ]; then
    echo "Please specify a version."
    exit 1
fi

# Generate the tag.
echo "==> Tagging version $VERSION..."
git commit --allow-empty -a --gpg-sign=348FFC4C -m "Release v$VERSION"
git tag -a -m "Version $VERSION" -s -u 348FFC4C "v${VERSION}" master

exit 0
