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

BUILT_SOURCES = gen-dart/tutorial/lib/tutorial.dart gen-dart/shared/lib/shared.dart

THRIFT = $(top_builddir)/compiler/cpp/thrift

gen-dart/tutorial/lib/tutorial.dart gen-dart/shared/lib/shared.dart: $(top_srcdir)/tutorial/tutorial.thrift
	$(THRIFT) --gen dart -r $<

all-local: gen-dart/tutorial/lib/tutorial.dart pub-get

clean-local:
	$(RM) -r gen-*
	find . -type d -name "packages" | xargs $(RM) -r
	find . -type f -name ".packages" | xargs $(RM)

pub-get: pub-get-gen pub-get-client pub-get-console-client pub-get-server

pub-get-gen: pub-get-tutorial pub-get-shared

pub-get-tutorial: gen-dart/tutorial/lib/tutorial.dart
	cd gen-dart/tutorial; ${DARTPUB} get

pub-get-shared: gen-dart/shared/lib/shared.dart
	cd gen-dart/shared; ${DARTPUB} get

pub-get-client:
	cd client; ${DARTPUB} get

pub-get-console-client:
	cd console_client; ${DARTPUB} get

pub-get-server:
	cd server; ${DARTPUB} get

tutorialserver: pub-get-gen pub-get-server
	${DART} server/bin/main.dart

tutorialclient: pub-get-gen pub-get-client
	cd client; ${DARTPUB} serve

tutorialconsoleclient: pub-get-console-client
	${DART} console_client/bin/main.dart

EXTRA_DIST = \
	client/web/client.dart \
	client/web/index.html \
	client/web/styles.css \
	client/pubspec.yaml \
	console_client/bin/main.dart \
	console_client/pubspec.yaml \
	server/bin/main.dart \
	server/pubspec.yaml \
	build.sh
