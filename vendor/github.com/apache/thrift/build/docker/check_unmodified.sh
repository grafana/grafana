#!/bin/bash
#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.
#

# Download prebuilt docker image and compare Dockerfile hash values

set -ex

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISTRO=$1
SRC_IMG=thrift/thrift-build:$DISTRO

function try_pull {
  docker pull $SRC_IMG
  cd ${SCRIPT_DIR}/$DISTRO
  docker run $SRC_IMG bash -c 'cd .. && sha512sum Dockerfile' > .Dockerfile.sha512
  sha512sum -c .Dockerfile.sha512
}

if try_pull; then
  echo Dockerfile seems identical. No need to rebuild from scratch.
  docker tag thrift/thrift-build:$DISTRO thrift-build:$DISTRO
else
  echo Either Dockerfile has changed or pull failure. Need to build brand new one.
  exit 1
fi
