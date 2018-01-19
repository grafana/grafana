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

THRIFT = $(top_builddir)/compiler/cpp/thrift
THRIFTCMD = $(THRIFT) --gen haxe -r
THRIFTTEST = $(top_srcdir)/test/ThriftTest.thrift

BIN_CPP = bin/Main-debug
BIN_PHP = bin/php/Main-debug.php
BIN_PHP_WEB = bin/php-web-server/Main-debug.php

gen-haxe/thrift/test/ThriftTest.hx: $(THRIFTTEST)
	$(THRIFTCMD) $(THRIFTTEST)

all-local: $(BIN_CPP) $(BIN_PHP) $(BIN_PHP_WEB)

$(BIN_CPP): \
		src/*.hx \
		../../lib/haxe/src/org/apache/thrift/**/*.hx \
		gen-haxe/thrift/test/ThriftTest.hx
	$(HAXE) --cwd .  cpp.hxml

$(BIN_PHP): \
		src/*.hx \
		../../lib/haxe/src/org/apache/thrift/**/*.hx \
		gen-haxe/thrift/test/ThriftTest.hx
	$(HAXE) --cwd .  php.hxml

$(BIN_PHP_WEB): \
		src/*.hx \
		../../lib/haxe/src/org/apache/thrift/**/*.hx \
		gen-haxe/thrift/test/ThriftTest.hx
	$(HAXE) --cwd .  php-web-server.hxml



#TODO: other haxe targets
#    $(HAXE)  --cwd .  csharp
#    $(HAXE)  --cwd .  flash
#    $(HAXE)  --cwd .  java
#    $(HAXE)  --cwd .  javascript
#    $(HAXE)  --cwd .  neko
#    $(HAXE)  --cwd .  python  # needs Haxe 3.2.0


clean-local:
	$(RM) -r gen-haxe bin

.NOTPARALLEL:

check: check_cpp \
	check_php \
	check_php_web 

check_cpp: $(BIN_CPP) 
	timeout 20 $(BIN_CPP) server &
	sleep 1
	$(BIN_CPP) client
	sleep 10

check_php: $(BIN_PHP) 
	timeout 20 php -f $(BIN_PHP) server &
	sleep 1
	php -f $(BIN_PHP) client
	sleep 10

check_php_web: $(BIN_PHP_WEB) $(BIN_CPP)
	timeout 20 php -S 127.0.0.1:9090 router.php &
	sleep 1
	$(BIN_CPP) client --transport http
	sleep 10


EXTRA_DIST = \
             src \
             cpp.hxml \
             csharp.hxml \
             flash.hxml \
             java.hxml \
             javascript.hxml \
             neko.hxml \
             php.hxml \
             python.hxml \
             project.hide \
             TestClientServer.hxproj \
             make_all.bat \
             make_all.sh
