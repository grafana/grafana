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
AUTOMAKE_OPTIONS = serial-tests
DESTDIR ?= /

if WITH_PY3
py3-build:
	$(PYTHON3) setup.py build
py3-test: py3-build
	$(PYTHON3) test/thrift_json.py
	$(PYTHON3) test/test_sslsocket.py
else
py3-build:
py3-test:
endif

all-local: py3-build
	$(PYTHON) setup.py build

# We're ignoring prefix here because site-packages seems to be
# the equivalent of /usr/local/lib in Python land.
# Old version (can't put inline because it's not portable).
#$(PYTHON) setup.py install --prefix=$(prefix) --root=$(DESTDIR) $(PYTHON_SETUPUTIL_ARGS)
install-exec-hook:
	$(PYTHON) setup.py install --root=$(DESTDIR) --prefix=$(PY_PREFIX) $(PYTHON_SETUPUTIL_ARGS)

clean-local:
	$(RM) -r build

check-local: all py3-test
	$(PYTHON) test/thrift_json.py
	$(PYTHON) test/test_sslsocket.py

EXTRA_DIST = \
	CMakeLists.txt \
	coding_standards.md \
	compat \
	setup.py \
	setup.cfg \
	src \
	test \
	README.md
