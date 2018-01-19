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

BIN_CPP = bin/Main-debug
BIN_PHP = bin/php/Main-debug.php
BIN_PHP_WEB = bin/php-web-server/Main-debug.php


gen-haxe/tutorial/calculator.hx gen-haxe/shared/shared_service.hx: $(top_srcdir)/tutorial/tutorial.thrift
	$(THRIFT) --gen haxe -r $<

all-local: $(BIN_CPP) $(BIN_PHP) $(BIN_PHP_WEB)

check: gen-haxe/tutorial/calculator.hx

$(BIN_CPP): \
		src/*.hx \
		../../lib/haxe/src/org/apache/thrift/**/*.hx \
		gen-haxe/tutorial/calculator.hx
	$(HAXE) --cwd .  cpp.hxml

$(BIN_PHP): \
		src/*.hx \
		../../lib/haxe/src/org/apache/thrift/**/*.hx \
		gen-haxe/tutorial/calculator.hx
	$(HAXE) --cwd .  php.hxml

$(BIN_PHP_WEB): \
		src/*.hx \
		../../lib/haxe/src/org/apache/thrift/**/*.hx \
		gen-haxe/tutorial/calculator.hx
	$(HAXE) --cwd .  php-web-server.hxml

tutorialserver: all
	$(BIN_CPP) server

tutorialserver_php: all
	php -f $(BIN_PHP) server

tutorialclient: all
	$(BIN_CPP)

tutorialclient_php: all
	php -f $(BIN_PHP) 

tutorialsecureserver: all
	$(BIN_CPP) server secure

tutorialsecureserver_php: all
	php -f $(BIN_PHP) server secure

tutorialsecureclient: all
	$(BIN_CPP) secure

tutorialsecureclient_php: all
	php -f $(BIN_PHP) secure

tutorialserver_php_http: all
	php -S 127.0.0.1:9090 router.php

tutorialclient_http: all
	$(BIN_CPP) client http

clean-local:
	$(RM) -r gen-haxe bin

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
             Tutorial.hxproj \
             make_all.bat \
             make_all.sh
