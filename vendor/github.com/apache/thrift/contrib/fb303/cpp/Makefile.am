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

@GLOBAL_HEADER_MK@

@PRODUCT_MK@


# User specified path variables set in configure.ac.
# thrift_home
#
THRIFT = $(thrift_home)/bin/thrift

# User defined conditionals and conditonal statements set up in configure.ac.
if DEBUG
   DEBUG_CPPFLAGS = -DDEBUG_TIMING
endif

# Set common flags recognized by automake.
# DO NOT USE CPPFLAGS, CXXFLAGS, CFLAGS, LDFLAGS here! Set in configure.ac and|or override on command line.
# USE flags AM_CXXFLAGS, AM_CFLAGS, AM_CPPFLAGS, AM_LDFLAGS, LDADD in this section.

AM_CPPFLAGS = -I..
AM_CPPFLAGS += -Igen-cpp
AM_CPPFLAGS += -I$(thrift_home)/include/thrift 
AM_CPPFLAGS += $(BOOST_CPPFLAGS)
AM_CPPFLAGS += $(FB_CPPFLAGS) $(DEBUG_CPPFLAGS)

# GENERATE BUILD RULES
# Set Program/library specific flags recognized by automake.
# Use <progname|libname>_<FLAG> to set prog / lib specific flag s
# foo_CXXFLAGS foo_CPPFLAGS foo_LDFLAGS foo_LDADD

fb303_lib = gen-cpp/FacebookService.cpp gen-cpp/fb303_constants.cpp gen-cpp/fb303_types.cpp FacebookBase.cpp ServiceTracker.cpp

# Static -- multiple libraries can be defined
if STATIC
lib_LIBRARIES = libfb303.a
libfb303_a_SOURCES = $(fb303_lib)
INTERNAL_LIBS = libfb303.a
endif

# Shared -- multiple libraries can be defined
if SHARED
shareddir = $(prefix)/lib
shared_PROGRAMS = libfb303.so
libfb303_so_SOURCES = $(fb303_lib)
libfb303_so_CXXFLAGS = $(SHARED_CXXFLAGS)
libfb303_so_LDFLAGS = $(SHARED_LDFLAGS)
INTERNAL_LIBS =  libfb303.so
endif

# Set up Thrift specific activity here.
# We assume that a <name>+types.cpp will always be built from <name>.thrift.
$(eval $(call thrift_template,.,../if/fb303.thrift,-I $(thrift_home)/share  --gen cpp:pure_enums ))

include_fb303dir = $(includedir)/thrift/fb303
include_fb303_HEADERS = FacebookBase.h ServiceTracker.h gen-cpp/FacebookService.h gen-cpp/fb303_constants.h gen-cpp/fb303_types.h

include_fb303ifdir = $(prefix)/share/fb303/if
include_fb303if_HEADERS = ../if/fb303.thrift

BUILT_SOURCES = thriftstyle

# Add to pre-existing target clean
clean-local: clean-common

@GLOBAL_FOOTER_MK@
