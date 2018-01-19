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

SUBDIRS = json xml
PRECROSS_TARGET =

if WITH_CPP
# cpp dir is picked directly by plugin build
if !WITH_PLUGIN
SUBDIRS += cpp
endif
endif

if WITH_C_GLIB
SUBDIRS += c_glib
endif

if WITH_MONO
SUBDIRS += csharp
endif

if WITH_JAVA
SUBDIRS += java
PRECROSS_TARGET += precross-java
# JavaScript unit test depends on java
# so test only if java, ant & co is available
SUBDIRS += js
endif

if WITH_PYTHON
SUBDIRS += py
endif

if WITH_ERLANG
SUBDIRS += erl
endif

if WITH_RUBY
SUBDIRS += rb
endif

if WITH_HASKELL
SUBDIRS += hs
endif

if WITH_PERL
SUBDIRS += perl
endif

if WITH_PHP
SUBDIRS += php
endif

if WITH_DART
SUBDIRS += dart
endif

if WITH_GO
SUBDIRS += go
endif

if WITH_D
SUBDIRS += d
PRECROSS_TARGET += precross-d
endif

if WITH_NODEJS
SUBDIRS += nodejs
PRECROSS_TARGET += precross-nodejs
endif

if WITH_LUA
SUBDIRS += lua
endif

# All of the libs that don't use Automake need to go in here
# so they will end up in our release tarballs.
EXTRA_DIST = \
	as3 \
	cocoa \
	d \
	dart \
	delphi \
	haxe \
	javame \
	js \
	ocaml \
	st \
	ts

precross-%:
	$(MAKE) -C $* precross
precross: $(PRECROSS_TARGET)
