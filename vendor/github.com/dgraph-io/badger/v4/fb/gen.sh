#!/usr/bin/env bash

set -e

## Install flatc if not present
## ref. https://google.github.io/flatbuffers/flatbuffers_guide_building.html
command -v flatc >/dev/null || { ./install_flatbuffers.sh; }

flatc --go flatbuffer.fbs
# Move files to the correct directory.
mv fb/* ./
rmdir fb
