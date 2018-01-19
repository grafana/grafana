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

AM_YFLAGS = -d

BUILT_SOURCES = thrift/thrifty.cc

noinst_LIBRARIES = thrift/libparse.a

thrift_libparse_a_CPPFLAGS = -I$(srcdir)
thrift_libparse_a_CXXFLAGS = -Wall -Wno-sign-compare -Wno-unused

thrift_libparse_a_SOURCES = thrift/thrifty.yy \
                     thrift/thriftl.ll

clean-local:
	$(RM) thrift/thriftl.cc thrift/thrifty.cc thrift/thrifty.h thrift/thrifty.hh

if WITH_PLUGIN
noinst_PROGRAMS = thrift/thrift-bootstrap

thrift_thrift_bootstrap_SOURCES = \
                 thrift/common.h \
                 thrift/common.cc \
                 thrift/audit/t_audit.h \
                 thrift/audit/t_audit.cpp \
                 thrift/generate/t_generator.cc \
                 thrift/generate/t_generator_registry.h \
                 thrift/globals.h \
                 thrift/platform.h \
                 thrift/logging.h \
                 thrift/parse/t_doc.h \
                 thrift/parse/t_type.h \
                 thrift/parse/t_base_type.h \
                 thrift/parse/t_enum.h \
                 thrift/parse/t_enum_value.h \
                 thrift/parse/t_typedef.h \
                 thrift/parse/t_typedef.cc \
                 thrift/parse/t_container.h \
                 thrift/parse/t_list.h \
                 thrift/parse/t_set.h \
                 thrift/parse/t_map.h \
                 thrift/parse/t_struct.h \
                 thrift/parse/t_field.h \
                 thrift/parse/t_service.h \
                 thrift/parse/t_function.h \
                 thrift/parse/t_program.h \
                 thrift/parse/t_scope.h \
                 thrift/parse/t_const.h \
                 thrift/parse/t_const_value.h \
                 thrift/parse/parse.cc \
                 thrift/generate/t_generator.h \
                 thrift/generate/t_oop_generator.h \
                 thrift/generate/t_html_generator.h \
                 thrift/windows/config.h \
                 thrift/version.h \
                 thrift/generate/t_cpp_generator.cc \
                 thrift/main.h \
                 thrift/main.cc

main.cc: version.h

thrift_thrift_bootstrap_CXXFLAGS = -Wall -Wextra -pedantic
thrift_thrift_bootstrap_LDADD = @LEXLIB@ thrift/libparse.a
endif
