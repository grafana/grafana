#!/usr/bin/env bash
# Copyright 2019 The Go Cloud Development Kit Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Starts a local Vault instance via Docker.

# https://coderwall.com/p/fkfaqq/safer-bash-scripts-with-set-euxo-pipefail
set -euo pipefail

echo "Starting Vault Server..."
docker rm -f dev-vault &> /dev/null || :
docker run --cap-add=IPC_LOCK -d --name=dev-vault -e 'VAULT_DEV_ROOT_TOKEN_ID=faketoken' -p 8200:8200 vault:1.6.0 &> /dev/null
echo "...done. Run \"docker rm -f dev-vault\" to clean up the container."
echo

