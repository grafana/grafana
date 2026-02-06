#!/bin/bash

# Copyright 2020-2021 Dolthub, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -eo pipefail

paths=`find . -maxdepth 1 -mindepth 1 \( -name gen -prune -o -type d -print -o -type f -name '*.go' -print \)`

goimports -w -local github.com/dolthub/go-mysql-server $paths

bad_files=$(find $paths -name '*.go' | while read f; do
    if [[ $(awk '/import \(/{flag=1;next}/\)/{flag=0}flag' < $f | egrep -c '$^') -gt 2 ]]; then
        echo $f
    fi
done)

if [ "$bad_files" != "" ]; then
    for f in $bad_files; do
        awk '/import \(/{flag=1}/\)/{flag=0}flag&&!/^$/||!flag' < "$f" > "$f.bak"
        mv "$f.bak" "$f"
    done
    goimports -w -local github.com/dolthub/go-mysql-server .
fi
