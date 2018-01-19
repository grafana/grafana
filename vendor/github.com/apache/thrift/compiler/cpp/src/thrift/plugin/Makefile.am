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

AUTOMAKE_OPTIONS = subdir-objects

if WITH_PLUGIN
plugin_gen = plugin_types.h \
             plugin_types.cpp \
             plugin_constants.h \
             plugin_constants.cpp

BUILT_SOURCES = $(plugin_gen)
gen.stamp: plugin.thrift $(top_builddir)/compiler/cpp/src/thrift/thrift-bootstrap
	@$(RM) -f gen.tmp
	@touch gen.tmp
	$(top_builddir)/compiler/cpp/src/thrift/thrift-bootstrap -gen cpp -out . $<
	@mv -f gen.tmp $@

$(plugin_gen): gen.stamp
	@if test -f $@; then :; else \
	$(RM) -f gen.stamp; \
	$(MAKE) $(AM_MAKEFLAGS) gen.stamp; \
	fi

clean-local:
	$(RM) version.h windows/version.h $(plugin_gen)
endif
