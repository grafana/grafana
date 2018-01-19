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

stubs: ../../../test/ThriftTest.thrift  TestValidators.thrift
	mkdir -p ./packages
	$(THRIFT) --gen php -r --out ./packages ../../../test/ThriftTest.thrift
	mkdir -p ./packages/phpv
	mkdir -p ./packages/phpvo
	mkdir -p ./packages/phpjs
	$(THRIFT) --gen php:validate     -r --out ./packages/phpv   TestValidators.thrift
	$(THRIFT) --gen php:validate,oop -r --out ./packages/phpvo  TestValidators.thrift
	$(THRIFT) --gen php:json         -r --out ./packages/phpjs  TestValidators.thrift

check-json-serializer: stubs
if HAVE_PHPUNIT
	$(PHPUNIT) --log-junit=TEST-json-serializer.xml Test/Thrift/JsonSerialize/
endif

check-validator: stubs
	php Test/Thrift/TestValidators.php
	php Test/Thrift/TestValidators.php -oop

check-protocol:	stubs
if HAVE_PHPUNIT
	$(PHPUNIT) --log-junit=TEST-log-json-protocol.xml Test/Thrift/Protocol/TestTJSONProtocol.php
	$(PHPUNIT) --log-junit=TEST-binary-serializer.xml Test/Thrift/Protocol/TestBinarySerializer.php
	$(PHPUNIT) --log-junit=TEST-log-simple-json-protocol.xml Test/Thrift/Protocol/TestTSimpleJSONProtocol.php
endif

check: stubs \
  check-protocol \
  check-validator \
  check-json-serializer

clean-local:
	$(RM) -r ./packages
	$(RM) TEST-*.xml

EXTRA_DIST = \
	Test \
	TestValidators.thrift


