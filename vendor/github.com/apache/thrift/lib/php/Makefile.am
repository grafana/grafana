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


if WITH_TESTS
SUBDIRS = test
endif

if WITH_PHP_EXTENSION
%.so:
	cd src/ext/thrift_protocol/ && $(MAKE)

phpconfdir=$(PHP_CONFIG_PREFIX)
phpconf_DATA=thrift_protocol.ini

phpmoduledir = `php-config --extension-dir`
phpmodule_SCRIPTS = src/ext/thrift_protocol/modules/thrift_protocol.so

distclean-local:
	cd $(phpmodule_SCRIPTS) && $(PHPIZE) --clean

endif

phpdir = $(PHP_PREFIX)/Thrift
php_DATA = \
  lib/Thrift/TMultiplexedProcessor.php

phpbasedir = $(phpdir)/Base
phpbase_DATA = \
  lib/Thrift/Base/TBase.php

phpclassloaderdir = $(phpdir)/ClassLoader
phpclassloader_DATA = \
  lib/Thrift/ClassLoader/ThriftClassLoader.php

phpexceptiondir = $(phpdir)/Exception
phpexception_DATA = \
  lib/Thrift/Exception/TApplicationException.php \
  lib/Thrift/Exception/TException.php \
  lib/Thrift/Exception/TProtocolException.php \
  lib/Thrift/Exception/TTransportException.php

phpfactorydir = $(phpdir)/Factory
phpfactory_DATA = \
  lib/Thrift/Factory/TBinaryProtocolFactory.php \
  lib/Thrift/Factory/TCompactProtocolFactory.php \
  lib/Thrift/Factory/TJSONProtocolFactory.php \
  lib/Thrift/Factory/TProtocolFactory.php \
  lib/Thrift/Factory/TStringFuncFactory.php \
  lib/Thrift/Factory/TTransportFactory.php

phpprotocoldir = $(phpdir)/Protocol
phpprotocol_DATA = \
  lib/Thrift/Protocol/TBinaryProtocolAccelerated.php \
  lib/Thrift/Protocol/TBinaryProtocol.php \
  lib/Thrift/Protocol/TCompactProtocol.php \
  lib/Thrift/Protocol/TJSONProtocol.php \
  lib/Thrift/Protocol/TMultiplexedProtocol.php \
  lib/Thrift/Protocol/TProtocol.php \
  lib/Thrift/Protocol/TProtocolDecorator.php \
  lib/Thrift/Protocol/TSimpleJSONProtocol.php

phpprotocoljsondir = $(phpprotocoldir)/JSON
phpprotocoljson_DATA = \
  lib/Thrift/Protocol/JSON/BaseContext.php \
  lib/Thrift/Protocol/JSON/ListContext.php \
  lib/Thrift/Protocol/JSON/LookaheadReader.php \
  lib/Thrift/Protocol/JSON/PairContext.php

phpprotocolsimplejsondir = $(phpprotocoldir)/SimpleJSON
phpprotocolsimplejson_DATA = \
  lib/Thrift/Protocol/SimpleJSON/CollectionMapKeyException.php \
  lib/Thrift/Protocol/SimpleJSON/Context.php \
  lib/Thrift/Protocol/SimpleJSON/ListContext.php \
  lib/Thrift/Protocol/SimpleJSON/MapContext.php \
  lib/Thrift/Protocol/SimpleJSON/StructContext.php

phpserializerdir = $(phpdir)/Serializer
phpserializer_DATA = \
  lib/Thrift/Serializer/TBinarySerializer.php

phpserverdir = $(phpdir)/Server
phpserver_DATA = \
  lib/Thrift/Server/TServerSocket.php \
  lib/Thrift/Server/TForkingServer.php \
  lib/Thrift/Server/TServer.php \
  lib/Thrift/Server/TServerTransport.php \
  lib/Thrift/Server/TSimpleServer.php

phpstringfuncdir = $(phpdir)/StringFunc
phpstringfunc_DATA = \
  lib/Thrift/StringFunc/Mbstring.php \
  lib/Thrift/StringFunc/Core.php \
  lib/Thrift/StringFunc/TStringFunc.php

phptransportdir = $(phpdir)/Transport
phptransport_DATA = \
  lib/Thrift/Transport/TBufferedTransport.php \
  lib/Thrift/Transport/TCurlClient.php \
  lib/Thrift/Transport/TFramedTransport.php \
  lib/Thrift/Transport/THttpClient.php \
  lib/Thrift/Transport/TMemoryBuffer.php \
  lib/Thrift/Transport/TNullTransport.php \
  lib/Thrift/Transport/TPhpStream.php \
  lib/Thrift/Transport/TSocket.php \
  lib/Thrift/Transport/TSocketPool.php \
  lib/Thrift/Transport/TTransport.php

phptypedir = $(phpdir)/Type
phptype_DATA = \
  lib/Thrift/Type/TMessageType.php \
  lib/Thrift/Type/TType.php \
  lib/Thrift/Type/TConstant.php

EXTRA_DIST = \
  lib \
  src/autoload.php \
  src/ext/thrift_protocol/config.m4 \
  src/ext/thrift_protocol/config.w32 \
  src/ext/thrift_protocol/php_thrift_protocol7.cpp \
  src/ext/thrift_protocol/php_thrift_protocol.cpp \
  src/ext/thrift_protocol/php_thrift_protocol.h \
  src/ext/thrift_protocol/run-tests.php \
  src/Thrift.php \
  src/TStringUtils.php \
  coding_standards.md \
  thrift_protocol.ini \
  README.apache.md \
  README.md

MAINTAINERCLEANFILES = \
  Makefile \
  Makefile.in

