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

DESTDIR ?= /
EXTRA_DIST = setup.py src

all:

all-local:
	$(thrift_home)/bin/thrift --gen py $(top_srcdir)/if/fb303.thrift
	mv gen-py/fb303/* fb303
	$(PYTHON) setup.py build

# We're ignoring prefix here because site-packages seems to be
# the equivalent of /usr/local/lib in Python land.
# Old version (can't put inline because it's not portable).
#$(PYTHON) setup.py install --prefix=$(prefix) --root=$(DESTDIR) $(PYTHON_SETUPUTIL_ARGS)
install-exec-hook:
	$(PYTHON) setup.py install --root=$(DESTDIR) --prefix=$(PY_PREFIX) $(PYTHON_SETUPUTIL_ARGS)



clean:	clean-local

clean-local:
	$(RM) -r build

check-local: all
