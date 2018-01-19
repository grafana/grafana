#!/bin/sh

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

topsrcdir="`dirname $0`"
cd "$topsrcdir"

make -k clean >/dev/null 2>&1
make -k distclean >/dev/null 2>&1
find . -name Makefile.in -exec rm -f {} \;
rm -rf \
AUTHORS \
ChangeLog \
INSTALL \
Makefile \
Makefile.in \
Makefile.orig \
aclocal/libtool.m4 \
aclocal/ltoptions.m4 \
aclocal/ltsugar.m4 \
aclocal/ltversion.m4 \
aclocal/lt~obsolete.m4 \
aclocal.m4 \
autom4te.cache \
autoscan.log \
config.guess \
config.h \
config.hin \
config.hin~ \
config.log \
config.status \
config.status.lineno \
config.sub \
configure \
configure.lineno \
configure.scan \
depcomp \
.deps \
install-sh \
.libs \
libtool \
ltmain.sh \
missing \
ylwrap \
if/gen-* \
test/gen-* \
lib/php/src/ext/thrift_protocol/.deps \
lib/php/src/ext/thrift_protocol/Makefile \
lib/php/src/ext/thrift_protocol/Makefile.fragments \
lib/php/src/ext/thrift_protocol/Makefile.global \
lib/php/src/ext/thrift_protocol/Makefile.objects \
lib/php/src/ext/thrift_protocol/acinclude.m4 \
lib/php/src/ext/thrift_protocol/aclocal.m4 \
lib/php/src/ext/thrift_protocol/autom4te.cache \
lib/php/src/ext/thrift_protocol/build \
lib/php/src/ext/thrift_protocol/config.guess \
lib/php/src/ext/thrift_protocol/config.h \
lib/php/src/ext/thrift_protocol/config.h.in \
lib/php/src/ext/thrift_protocol/config.log \
lib/php/src/ext/thrift_protocol/config.nice \
lib/php/src/ext/thrift_protocol/config.status \
lib/php/src/ext/thrift_protocol/config.sub \
lib/php/src/ext/thrift_protocol/configure \
lib/php/src/ext/thrift_protocol/configure.in \
lib/php/src/ext/thrift_protocol/include \
lib/php/src/ext/thrift_protocol/install-sh \
lib/php/src/ext/thrift_protocol/libtool \
lib/php/src/ext/thrift_protocol/ltmain.sh \
lib/php/src/ext/thrift_protocol/missing \
lib/php/src/ext/thrift_protocol/mkinstalldirs \
lib/php/src/ext/thrift_protocol/modules \
lib/php/src/ext/thrift_protocol/run-tests.php
