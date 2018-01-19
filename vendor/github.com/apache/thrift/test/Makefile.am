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

SUBDIRS = features
PRECROSS_TARGET =

if WITH_C_GLIB
SUBDIRS += c_glib
PRECROSS_TARGET += precross-c_glib
endif

if WITH_MONO
SUBDIRS += csharp
PRECROSS_TARGET += precross-csharp
endif

if WITH_CPP
SUBDIRS += cpp
PRECROSS_TARGET += precross-cpp
endif

if WITH_PERL
SUBDIRS += perl
PRECROSS_TARGET += precross-perl
endif

if WITH_PHP
SUBDIRS += php
PRECROSS_TARGET += precross-php
endif

if WITH_DART
SUBDIRS += dart
PRECROSS_TARGET += precross-dart
endif

if WITH_PYTHON
SUBDIRS += py
PRECROSS_TARGET += precross-py
SUBDIRS += py.tornado
if WITH_TWISTED_TEST
SUBDIRS += py.twisted
endif
endif

if WITH_RUBY
SUBDIRS += rb
PRECROSS_TARGET += precross-rb
endif

if WITH_HASKELL
SUBDIRS += hs
endif

if WITH_HAXE
SUBDIRS += haxe
endif

if WITH_GO
SUBDIRS += go
PRECROSS_TARGET += precross-go
endif

if WITH_ERLANG
SUBDIRS += erl
PRECROSS_TARGET += precross-erl
endif

if WITH_LUA
SUBDIRS += lua
PRECROSS_TARGET += precross-lua
endif

#
# generate html for ThriftTest.thrift
#
check-local:
	$(top_builddir)/compiler/cpp/thrift --gen html -r $(top_srcdir)/test/ThriftTest.thrift

clean-local:
	rm -rf $(top_srcdir)/test/gen-html

EXTRA_DIST = \
	audit \
	crossrunner \
	keys \
	c_glib \
	cpp \
	dart \
	erl \
	hs \
	lua \
	ocaml \
	perl \
	php \
	py \
	py.twisted \
	py.tornado \
	rb \
	threads \
	AnnotationTest.thrift \
	BrokenConstants.thrift \
	ConstantsDemo.thrift \
	DebugProtoTest.thrift \
	DenseLinkingTest.thrift \
	DocTest.thrift \
	EnumTest.thrift \
	FullCamelTest.thrift \
	Include.thrift \
	JavaBeansTest.thrift \
	JavaTypes.thrift \
	JsDeepConstructorTest.thrift \
	ManyOptionals.thrift \
	ManyTypedefs.thrift \
	NameConflictTest.thrift \
	OptionalRequiredTest.thrift \
	Recursive.thrift \
	ReuseObjects.thrift \
	SmallTest.thrift \
	StressTest.thrift \
	ThriftTest.thrift \
	TypedefTest.thrift \
	known_failures_Linux.json \
	test.py \
	tests.json \
	rebuild_known_failures.sh \
	result.js \
	index.html \
	README.md \
	valgrind.suppress

precross-%:
	$(MAKE) -C $* precross
precross: $(PRECROSS_TARGET)
