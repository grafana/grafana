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
#
# Contains some contributions under the Thrift Software License.
# Please see doc/old-thrift-license.txt in the Thrift distribution for
# details.

AUTOMAKE_OPTIONS = subdir-objects serial-tests

AM_CPPFLAGS = $(BOOST_CPPFLAGS) -I$(top_srcdir)/compiler/cpp/src
AM_LDFLAGS = $(BOOST_LDFLAGS)
AM_CXXFLAGS = -Wall -Wextra -pedantic

if WITH_PLUGIN
check_PROGRAMS = plugintest

noinst_PROGRAMS = thrift-gen-mycpp

AM_CPPFLAGS += -I$(top_srcdir)/lib/cpp/src -I$(top_builddir)/lib/cpp/src

plugintest_SOURCES = plugin/conversion_test.cc
plugintest_LDADD = $(top_builddir)/compiler/cpp/libthriftc.la

thrift_gen_mycpp_SOURCES = plugin/cpp_plugin.cc \
                           plugin/t_cpp_generator.cc
thrift_gen_mycpp_CPPFLAGS = $(AM_CPPFLAGS) -I$(top_srcdir)/compiler/cpp -I$(top_srcdir)/compiler/cpp/src/generate
thrift_gen_mycpp_LDADD = $(top_builddir)/compiler/cpp/libthriftc.la

cpp_plugin_test.sh: thrift-gen-mycpp
TESTS = $(check_PROGRAMS) cpp_plugin_test.sh

clean-local:
	$(RM) -rf gen-cpp gen-mycpp

endif
