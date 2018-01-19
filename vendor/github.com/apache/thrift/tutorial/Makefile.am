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

SUBDIRS =

if MINGW
# do nothing, just build the compiler
else

if WITH_C_GLIB
SUBDIRS += c_glib
endif

if WITH_CPP
SUBDIRS += cpp
endif

if WITH_D
SUBDIRS += d
endif

if WITH_JAVA
SUBDIRS += java
SUBDIRS += js
endif

if WITH_PYTHON
SUBDIRS += py
SUBDIRS += py.twisted
SUBDIRS += py.tornado
endif

if WITH_RUBY
SUBDIRS += rb
endif

if WITH_HASKELL
SUBDIRS += hs
endif

if WITH_HAXE
SUBDIRS += haxe
endif

if WITH_GO
SUBDIRS += go
endif

if WITH_NODEJS
SUBDIRS += nodejs
endif

if WITH_DART
SUBDIRS += dart
endif

#
# generate html for ThriftTest.thrift
#
all-local:
	$(top_builddir)/compiler/cpp/thrift --gen html -r $(top_srcdir)/tutorial/tutorial.thrift

clean-local:
	rm -rf $(top_srcdir)/tutorial/gen-html

endif

# Any folders or files not listed above being added to SUBDIR need to be placed here in
# EXTRA_DIST to be included in the release
EXTRA_DIST = \
	as3 \
	csharp \
	d \
	delphi \
	erl \
	hs \
	ocaml \
	perl \
	php \
	shared.thrift \
	tutorial.thrift \
	README.md
