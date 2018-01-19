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

EXTRA_DIST = \
	coding_standards.md \
	CMakeLists.txt \
	LICENSE \
	README.md \
	Setup.lhs \
	TODO \
	Thrift.cabal \
	src \
	test

all-local:
	$(CABAL) update
	$(CABAL) install

install-exec-hook:
	$(CABAL) install

# Make sure this doesn't fail if Haskell is not configured.
clean-local:
	$(CABAL) clean

maintainer-clean-local:
	$(CABAL) clean

check-local:
	$(CABAL) check
	$(CABAL) install --only-dependencies --enable-tests
	$(CABAL) configure --enable-tests
	$(CABAL) build
	$(CABAL) test
