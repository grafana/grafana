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

./cleanup.sh
if test -d lib/php/src/ext/thrift_protocol ; then
    if phpize -v >/dev/null 2>/dev/null ; then
        (cd lib/php/src/ext/thrift_protocol && phpize)
    fi
fi

set -e

# libtoolize is called "glibtoolize" on OSX.
if libtoolize --version 1 >/dev/null 2>/dev/null; then
  LIBTOOLIZE=libtoolize
elif glibtoolize --version 1 >/dev/null 2>/dev/null; then
  LIBTOOLIZE=glibtoolize
else
  echo >&2 "Couldn't find libtoolize!"
  exit 1
fi

# we require automake 1.13 or later
# check must happen externally due to use of newer macro
AUTOMAKE_VERSION=`automake --version | grep automake | egrep -o '([0-9]{1,}\.)+[0-9]{1,}'`
if [ "$AUTOMAKE_VERSION" \< "1.13" ]; then
  echo >&2 "automake version $AUTOMAKE_VERSION is too old (need 1.13 or later)"
  exit 1
fi

autoscan
$LIBTOOLIZE --copy --automake
aclocal -I ./aclocal
autoheader
autoconf
automake --copy --add-missing --foreign
