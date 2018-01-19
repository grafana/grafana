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
THRIFTARGS = -out gopath/src/ --gen go:thrift_import=thrift
THRIFTTEST = $(top_srcdir)/test/ThriftTest.thrift

# Thrift for GO has problems with complex map keys: THRIFT-2063
gopath: $(THRIFT) $(THRIFTTEST) \
				IncludesTest.thrift \
				NamespacedTest.thrift \
				MultiplexedProtocolTest.thrift \
				OnewayTest.thrift \
				OptionalFieldsTest.thrift \
				ServicesTest.thrift \
				GoTagTest.thrift \
				TypedefFieldTest.thrift \
				RefAnnotationFieldsTest.thrift \
				UnionDefaultValueTest.thrift \
				ErrorTest.thrift \
				NamesTest.thrift \
				InitialismsTest.thrift \
				DontExportRWTest.thrift \
				dontexportrwtest/compile_test.go \
				IgnoreInitialismsTest.thrift
	mkdir -p gopath/src
	grep -v list.*map.*list.*map $(THRIFTTEST) | grep -v 'set<Insanity>' > ThriftTest.thrift
	$(THRIFT) $(THRIFTARGS) -r IncludesTest.thrift
	$(THRIFT) $(THRIFTARGS) BinaryKeyTest.thrift
	$(THRIFT) $(THRIFTARGS) MultiplexedProtocolTest.thrift
	$(THRIFT) $(THRIFTARGS) OnewayTest.thrift
	$(THRIFT) $(THRIFTARGS) OptionalFieldsTest.thrift
	$(THRIFT) $(THRIFTARGS) ServicesTest.thrift
	$(THRIFT) $(THRIFTARGS) GoTagTest.thrift
	$(THRIFT) $(THRIFTARGS) TypedefFieldTest.thrift
	$(THRIFT) $(THRIFTARGS) RefAnnotationFieldsTest.thrift
	$(THRIFT) $(THRIFTARGS) UnionDefaultValueTest.thrift
	$(THRIFT) $(THRIFTARGS) ErrorTest.thrift
	$(THRIFT) $(THRIFTARGS) NamesTest.thrift
	$(THRIFT) $(THRIFTARGS) InitialismsTest.thrift
	$(THRIFT) $(THRIFTARGS),read_write_private DontExportRWTest.thrift
	$(THRIFT) $(THRIFTARGS),ignore_initialisms IgnoreInitialismsTest.thrift
	GOPATH=`pwd`/gopath $(GO) get github.com/golang/mock/gomock
	ln -nfs ../../../thrift gopath/src/thrift
	ln -nfs ../../tests gopath/src/tests
	cp -r ./dontexportrwtest gopath/src
	touch gopath

check: gopath
	GOPATH=`pwd`/gopath $(GO) build \
				includestest \
				binarykeytest \
				servicestest \
				typedeffieldtest \
				refannotationfieldstest \
				errortest	\
				namestest \
				initialismstest \
				dontexportrwtest \
				ignoreinitialismstest
	GOPATH=`pwd`/gopath $(GO) test thrift tests dontexportrwtest

clean-local:
	$(RM) -r gopath ThriftTest.thrift gen-go

client: stubs
	$(GO) run TestClient.go

EXTRA_DIST = \
	dontexportrwtest \
	tests \
	BinaryKeyTest.thrift \
	GoTagTest.thrift \
	IncludesTest.thrift \
	MultiplexedProtocolTest.thrift \
	NamespacedTest.thrift \
	OnewayTest.thrift \
	OptionalFieldsTest.thrift \
	RefAnnotationFieldsTest.thrift \
	UnionDefaultValueTest.thrift \
	ServicesTest.thrift \
	TypedefFieldTest.thrift \
	ErrorTest.thrift \
	NamesTest.thrift \
	InitialismsTest.thrift \
	DontExportRWTest.thrift \
	IgnoreInitialismsTest.thrift
