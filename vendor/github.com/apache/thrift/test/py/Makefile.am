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

THRIFT = $(top_builddir)/compiler/cpp/thrift

py_unit_tests = RunClientServer.py

thrift_gen =                                    \
        gen-py/ThriftTest/__init__.py           \
        gen-py/DebugProtoTest/__init__.py \
        gen-py-default/ThriftTest/__init__.py           \
        gen-py-default/DebugProtoTest/__init__.py \
        gen-py-slots/ThriftTest/__init__.py           \
        gen-py-slots/DebugProtoTest/__init__.py \
        gen-py-oldstyle/ThriftTest/__init__.py \
        gen-py-oldstyle/DebugProtoTest/__init__.py \
        gen-py-no_utf8strings/ThriftTest/__init__.py \
        gen-py-no_utf8strings/DebugProtoTest/__init__.py \
        gen-py-dynamic/ThriftTest/__init__.py           \
        gen-py-dynamic/DebugProtoTest/__init__.py \
        gen-py-dynamicslots/ThriftTest/__init__.py           \
        gen-py-dynamicslots/DebugProtoTest/__init__.py

precross: $(thrift_gen)
BUILT_SOURCES = $(thrift_gen)

helper_scripts=                                 \
        TestClient.py                           \
        TestServer.py

check_SCRIPTS=                                  \
        $(thrift_gen) \
        $(py_unit_tests)                        \
        $(helper_scripts)

TESTS= $(py_unit_tests)


gen-py/%/__init__.py: ../%.thrift $(THRIFT)
	$(THRIFT) --gen py  $<

gen-py-default/%/__init__.py: ../%.thrift $(THRIFT)
	test -d gen-py-default || $(MKDIR_P) gen-py-default
	$(THRIFT) --gen py -out gen-py-default $<

gen-py-slots/%/__init__.py: ../%.thrift $(THRIFT)
	test -d gen-py-slots || $(MKDIR_P) gen-py-slots
	$(THRIFT) --gen py:slots -out gen-py-slots $<

gen-py-oldstyle/%/__init__.py: ../%.thrift $(THRIFT)
	test -d gen-py-oldstyle || $(MKDIR_P) gen-py-oldstyle
	$(THRIFT) --gen py:old_style -out gen-py-oldstyle $<

gen-py-no_utf8strings/%/__init__.py: ../%.thrift $(THRIFT)
	test -d gen-py-no_utf8strings || $(MKDIR_P) gen-py-no_utf8strings
	$(THRIFT) --gen py:no_utf8strings -out gen-py-no_utf8strings $<

gen-py-dynamic/%/__init__.py: ../%.thrift $(THRIFT)
	test -d gen-py-dynamic || $(MKDIR_P) gen-py-dynamic
	$(THRIFT) --gen py:dynamic -out gen-py-dynamic $<

gen-py-dynamicslots/%/__init__.py: ../%.thrift $(THRIFT)
	test -d gen-py-dynamicslots || $(MKDIR_P) gen-py-dynamicslots
	$(THRIFT) --gen py:dynamic,slots -out gen-py-dynamicslots $<

clean-local:
	$(RM) -r gen-py gen-py-slots gen-py-default gen-py-oldstyle gen-py-no_utf8strings gen-py-dynamic gen-py-dynamicslots
