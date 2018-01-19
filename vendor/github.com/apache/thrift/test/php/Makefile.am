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

stubs: ../ThriftTest.thrift
	$(THRIFT) --gen php ../ThriftTest.thrift
	$(THRIFT) --gen php:inlined ../ThriftTest.thrift
	$(MKDIR_P) gen-php-psr4
	$(THRIFT) -out gen-php-psr4 --gen php:psr4 ../ThriftTest.thrift

precross: stubs

check: stubs

clean-local:
	$(RM) -r gen-php gen-phpi gen-php-psr4

client: stubs
	php TestClient.php
