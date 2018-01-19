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

AUTOMAKE_OPTIONS = serial-tests

SUBDIRS = .

if WITH_TESTS
SUBDIRS += test
endif

#
# Enumeration of all the public and private modules.
#
# We unconditionally install all of them, even if libevent or OpenSSL are
# not available, but build the respective libraries only if the Deimos headers
# could be found.
#
d_thriftmodules = $(addprefix thrift/, base)
d_thriftdir = $(D_IMPORT_PREFIX)/thrift
d_thrift_DATA = $(addprefix src/, $(addsuffix .d, $(d_thriftmodules)))

d_asyncmodules = $(addprefix thrift/async/, base libevent socket ssl)
d_asyncdir = $(d_thriftdir)/async
d_async_DATA = $(addprefix src/, $(addsuffix .d, $(d_asyncmodules)))

d_codegenmodules = $(addprefix thrift/codegen/, async_client \
	async_client_pool base client client_pool processor)
#d_codegenmodules = $(addprefix thrift/codegen/, async_client \
#	async_client_pool base client client_pool idlgen processor)

d_codegendir = $(d_thriftdir)/codegen
d_codegen_DATA = $(addprefix src/, $(addsuffix .d, $(d_codegenmodules)))

d_protocolmodules = $(addprefix thrift/protocol/, base binary compact json \
	processor)
d_protocoldir = $(d_thriftdir)/protocol
d_protocol_DATA = $(addprefix src/, $(addsuffix .d, $(d_protocolmodules)))

d_servermodules = $(addprefix thrift/server/, base simple nonblocking \
	taskpool threaded)
d_serverdir = $(d_thriftdir)/server
d_server_DATA = $(addprefix src/, $(addsuffix .d, $(d_servermodules)))

d_servertransportmodules = $(addprefix thrift/server/transport/, base socket ssl)
d_servertransportdir = $(d_thriftdir)/server/transport
d_servertransport_DATA = $(addprefix src/, $(addsuffix .d, \
	$(d_servertransportmodules)))

d_transportmodules = $(addprefix thrift/transport/, base buffered file \
	framed http memory piped range socket ssl zlib)
d_transportdir = $(d_thriftdir)/transport
d_transport_DATA = $(addprefix src/, $(addsuffix .d, $(d_transportmodules)))

d_utilmodules = $(addprefix thrift/util/, awaitable cancellation future \
	hashset)
d_utildir = $(d_thriftdir)/util
d_util_DATA = $(addprefix src/, $(addsuffix .d, $(d_utilmodules)))

d_internalmodules = $(addprefix thrift/internal/, algorithm codegen ctfe \
	endian resource_pool socket ssl ssl_bio traits)
d_internaldir = $(d_thriftdir)/internal
d_internal_DATA = $(addprefix src/, $(addsuffix .d, $(d_internalmodules)))

d_testmodules = $(addprefix thrift/internal/test/, protocol server)
d_testdir = $(d_internaldir)/test
d_test_DATA = $(addprefix src/, $(addsuffix .d, $(d_testmodules)))

d_publicmodules = $(d_thriftmodules) $(d_asyncmodules) \
	$(d_codegenmodules) $(d_protocolmodules) $(d_servermodules) \
	$(d_servertransportmodules) $(d_transportmodules) $(d_utilmodules)
d_publicsources = $(addprefix src/, $(addsuffix .d, $(d_publicmodules)))

d_modules = $(d_publicmodules) $(d_internalmodules) $(d_testmodules)

# List modules with external dependencies and remove them from the main list
d_libevent_dependent_modules = thrift/async/libevent thrift/server/nonblocking
d_openssl_dependent_modules = thrift/async/ssl thrift/internal/ssl \
	thrift/internal/ssl_bio thrift/transport/ssl thrift/server/transport/ssl
d_main_modules = $(filter-out $(d_libevent_dependent_modules) \
	$(d_openssl_dependent_modules),$(d_modules))


d_lib_flags = -w -wi -Isrc -lib
all_targets =

#
# libevent-dependent modules.
#
if HAVE_DEIMOS_EVENT2
$(D_EVENT_LIB_NAME): $(addprefix src/, $(addsuffix .d, $(d_libevent_dependent_modules)))
	$(DMD) -of$(D_EVENT_LIB_NAME) $(d_lib_flags) $^
all_targets += $(D_EVENT_LIB_NAME)
endif

#
# OpenSSL-dependent modules.
#
if HAVE_DEIMOS_OPENSSL
$(D_SSL_LIB_NAME): $(addprefix src/, $(addsuffix .d, $(d_openssl_dependent_modules)))
	$(DMD) -of$(D_SSL_LIB_NAME) $(d_lib_flags) $^
all_targets += $(D_SSL_LIB_NAME)
endif

#
# Main library target.
#
$(D_LIB_NAME): $(addprefix src/, $(addsuffix .d, $(d_main_modules)))
	$(DMD) -of$(D_LIB_NAME) $(d_lib_flags) $^
all_targets += $(D_LIB_NAME)


#
# Documentation target (requires Dil).
#
docs: $(d_publicsources) src/thrift/index.d
	dil ddoc docs -hl --kandil $^


#
# Hook custom library targets into the automake all/install targets.
#
all-local: $(all_targets)

install-exec-local:
	$(INSTALL_PROGRAM) $(all_targets) $(DESTDIR)$(libdir)


clean-local:
	$(RM) -rf docs $(D_LIB_NAME) $(D_EVENT_LIB_NAME) $(D_SSL_LIB_NAME) unittest


#
# Unit tests (built both in debug and release mode).
#
d_test_flags = -unittest -w -wi -I$(top_srcdir)/lib/d/src

# There just must be some way to reassign a variable without warnings in
# Automake...
d_test_modules__ = $(d_modules)

if WITH_D_EVENT_TESTS
d_test_flags += $(DMD_LIBEVENT_FLAGS)
d_test_modules_ = $(d_test_modules__)
else
d_test_modules_ = $(filter-out $(d_libevent_dependent_modules), $(d_test_modules__))
endif

if WITH_D_SSL_TESTS
d_test_flags += $(DMD_OPENSSL_FLAGS)
d_test_modules = $(d_test_modules_)
else
d_test_modules = $(filter-out $(d_openssl_dependent_modules), $(d_test_modules_))
endif

unittest/emptymain.d: unittest/.directory
	@echo 'void main(){}' >$@

unittest/.directory:
	mkdir -p unittest || exists unittest
	touch $@

unittest/debug/%: src/%.d $(all_targets) unittest/emptymain.d
	$(DMD) -gc -of$(subst /,$(DMD_OF_DIRSEP),$@) $(d_test_flags) $^

unittest/release/%: src/%.d $(all_targets) unittest/emptymain.d
	$(DMD) -O -release -of$(subst /,$(DMD_OF_DIRSEP),$@) $(d_test_flags) $^

TESTS = $(addprefix unittest/debug/, $(d_test_modules)) \
	$(addprefix unittest/release/, $(d_test_modules))

precross: all-local
	$(MAKE) -C test precross

EXTRA_DIST = \
	src \
	test \
	README.md
