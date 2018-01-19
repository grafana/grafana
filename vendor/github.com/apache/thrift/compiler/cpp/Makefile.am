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

# Note on why we have src/thrift and src/thrift/plugin directories:
# Since Automake supports only one set of BUILT_SOURCES per file and does not allow
# SUBDIRS built before BUILT_SOURCES, we end up separate Makefile.am for each source
# code generation, i.e. lex-yacc and Thrift, to achieve stable parallel make.

SUBDIRS = src src/thrift/plugin .
if WITH_TESTS
SUBDIRS += test
endif

bin_PROGRAMS = thrift

thrift_OBJDIR = obj

plugin_gen = src/thrift/plugin/plugin_types.h \
             src/thrift/plugin/plugin_types.cpp \
             src/thrift/plugin/plugin_constants.h \
             src/thrift/plugin/plugin_constants.cpp

compiler_core =  src/thrift/common.h \
                 src/thrift/common.cc \
                 src/thrift/generate/t_generator.cc \
                 src/thrift/generate/t_generator_registry.h \
                 src/thrift/globals.h \
                 src/thrift/platform.h \
                 src/thrift/logging.h \
                 src/thrift/parse/t_doc.h \
                 src/thrift/parse/t_type.h \
                 src/thrift/parse/t_base_type.h \
                 src/thrift/parse/t_enum.h \
                 src/thrift/parse/t_enum_value.h \
                 src/thrift/parse/t_typedef.h \
                 src/thrift/parse/t_typedef.cc \
                 src/thrift/parse/t_container.h \
                 src/thrift/parse/t_list.h \
                 src/thrift/parse/t_set.h \
                 src/thrift/parse/t_map.h \
                 src/thrift/parse/t_struct.h \
                 src/thrift/parse/t_field.h \
                 src/thrift/parse/t_service.h \
                 src/thrift/parse/t_function.h \
                 src/thrift/parse/t_program.h \
                 src/thrift/parse/t_scope.h \
                 src/thrift/parse/t_const.h \
                 src/thrift/parse/t_const_value.h \
                 src/thrift/parse/parse.cc \
                 src/thrift/generate/t_generator.h \
                 src/thrift/generate/t_oop_generator.h \
                 src/thrift/generate/t_html_generator.h

thrift_SOURCES = src/thrift/main.h \
                 src/thrift/main.cc \
                 src/thrift/audit/t_audit.cpp \
                 src/thrift/audit/t_audit.h

# Specific client generator source
thrift_SOURCES += src/thrift/generate/t_c_glib_generator.cc \
                  src/thrift/generate/t_cpp_generator.cc \
                  src/thrift/generate/t_java_generator.cc \
                  src/thrift/generate/t_json_generator.cc \
                  src/thrift/generate/t_as3_generator.cc \
                  src/thrift/generate/t_dart_generator.cc \
                  src/thrift/generate/t_haxe_generator.cc \
                  src/thrift/generate/t_csharp_generator.cc \
                  src/thrift/generate/t_py_generator.cc \
                  src/thrift/generate/t_rb_generator.cc \
                  src/thrift/generate/t_perl_generator.cc \
                  src/thrift/generate/t_php_generator.cc \
                  src/thrift/generate/t_erl_generator.cc \
                  src/thrift/generate/t_cocoa_generator.cc \
                  src/thrift/generate/t_swift_generator.cc \
                  src/thrift/generate/t_st_generator.cc \
                  src/thrift/generate/t_ocaml_generator.cc \
                  src/thrift/generate/t_hs_generator.cc \
                  src/thrift/generate/t_xsd_generator.cc \
                  src/thrift/generate/t_xml_generator.cc \
                  src/thrift/generate/t_html_generator.cc \
                  src/thrift/generate/t_js_generator.cc \
                  src/thrift/generate/t_javame_generator.cc \
                  src/thrift/generate/t_delphi_generator.cc \
                  src/thrift/generate/t_go_generator.cc \
                  src/thrift/generate/t_gv_generator.cc \
                  src/thrift/generate/t_d_generator.cc \
                  src/thrift/generate/t_lua_generator.cc

thrift_CPPFLAGS = -I$(srcdir)/src
thrift_CXXFLAGS = -Wall -Wextra -pedantic
thrift_LDADD = @LEXLIB@ src/thrift/libparse.a

if !WITH_PLUGIN
thrift_SOURCES += $(compiler_core)
else

lib_LTLIBRARIES = libthriftc.la

thrift_CPPFLAGS += -DTHRIFT_ENABLE_PLUGIN=1
thrift_LDADD += libthriftc.la

nodist_libthriftc_la_SOURCES = $(plugin_gen)
libthriftc_la_SOURCES = $(compiler_core) \
                        src/thrift/plugin/type_util.h \
                        src/thrift/plugin/plugin.h \
                        src/thrift/plugin/plugin.cc \
                        src/thrift/plugin/plugin_output.h \
                        src/thrift/plugin/plugin_output.cc \
                        src/thrift/plugin/plugin.thrift \
                        src/thrift/logging.cc


libthriftc_la_CPPFLAGS = -I$(srcdir)/src -Isrc -I$(top_builddir)/lib/cpp/src -DTHRIFT_ENABLE_PLUGIN=1
libthriftc_la_CXXFLAGS = -Wall -Wextra -pedantic
libthriftc_la_LIBADD = $(top_builddir)/lib/cpp/libthrift.la

include_thriftdir = $(includedir)/thrift
include_thrift_HEADERS = src/thrift/common.h \
                         src/thrift/globals.h \
                         src/thrift/logging.h \
                         src/thrift/main.h \
                         src/thrift/platform.h \
                         src/thrift/version.h

include_auditdir = $(include_thriftdir)/windows
include_audit_HEADERS = src/thrift/audit/t_audit.h

include_generatedir = $(include_thriftdir)/generate
include_generate_HEADERS = src/thrift/generate/t_generator.h \
                           src/thrift/generate/t_generator_registry.h \
                           src/thrift/generate/t_oop_generator.h \
                           src/thrift/generate/t_html_generator.h

include_parsedir = $(include_thriftdir)/parse
include_parse_HEADERS = src/thrift/parse/t_service.h \
                        src/thrift/parse/t_program.h \
                        src/thrift/parse/t_field.h \
                        src/thrift/parse/t_scope.h \
                        src/thrift/parse/t_typedef.h \
                        src/thrift/parse/t_set.h \
                        src/thrift/parse/t_const_value.h \
                        src/thrift/parse/t_enum_value.h \
                        src/thrift/parse/t_const.h \
                        src/thrift/parse/t_list.h \
                        src/thrift/parse/t_map.h \
                        src/thrift/parse/t_container.h \
                        src/thrift/parse/t_base_type.h \
                        src/thrift/parse/t_enum.h \
                        src/thrift/parse/t_function.h \
                        src/thrift/parse/t_type.h \
                        src/thrift/parse/t_doc.h \
                        src/thrift/parse/t_struct.h

include_plugindir = $(include_thriftdir)/plugin
include_plugin_HEADERS = src/thrift/plugin/plugin.h \
                         src/thrift/plugin/type_util.h \
                         src/thrift/plugin/plugin_output.h

include_windowsdir = $(include_thriftdir)/windows
include_windows_HEADERS = src/thrift/windows/config.h
endif

WINDOWS_DIST = \
             compiler.sln \
             compiler.vcxproj \
             compiler.vcxproj.filters

EXTRA_DIST = \
             coding_standards.md \
             README.md \
             CMakeLists.txt \
             test \
             $(WINDOWS_DIST)

clean-local:
	$(RM) version.h $(plugin_gen)

src/thrift/main.cc: src/thrift/version.h

style-local:
  $(CPPSTYLE_CMD)
