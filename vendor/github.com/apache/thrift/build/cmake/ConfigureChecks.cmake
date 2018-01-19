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


include(CheckSymbolExists)
include(CheckIncludeFile)
include(CheckIncludeFiles)
include(CheckFunctionExists)

# If AI_ADDRCONFIG is not defined we define it as 0
check_symbol_exists(AI_ADDRCONFIG "sys/types.h;sys/socket.h;netdb.h" HAVE_AI_ADDRCONFIG)
if(NOT HAVE_AI_ADDRCONFIG)
set(AI_ADDRCONFIG 1)
endif(NOT HAVE_AI_ADDRCONFIG)

check_include_file(arpa/inet.h HAVE_ARPA_INET_H)
check_include_file(fcntl.h HAVE_FCNTL_H)
check_include_file(getopt.h HAVE_GETOPT_H)
check_include_file(inttypes.h HAVE_INTTYPES_H)
check_include_file(netdb.h HAVE_NETDB_H)
check_include_file(netinet/in.h HAVE_NETINET_IN_H)
check_include_file(stdint.h HAVE_STDINT_H)
check_include_file(unistd.h HAVE_UNISTD_H)
check_include_file(pthread.h HAVE_PTHREAD_H)
check_include_file(sys/time.h HAVE_SYS_TIME_H)
check_include_file(sys/param.h HAVE_SYS_PARAM_H)
check_include_file(sys/resource.h HAVE_SYS_RESOURCE_H)
check_include_file(sys/socket.h HAVE_SYS_SOCKET_H)
check_include_file(sys/stat.h HAVE_SYS_STAT_H)
check_include_file(sys/un.h HAVE_SYS_UN_H)
check_include_file(sys/poll.h HAVE_SYS_POLL_H)
check_include_file(sys/select.h HAVE_SYS_SELECT_H)
check_include_file(sched.h HAVE_SCHED_H)
check_include_file(strings.h HAVE_STRINGS_H)

check_function_exists(gethostbyname HAVE_GETHOSTBYNAME)
check_function_exists(gethostbyname_r HAVE_GETHOSTBYNAME_R)
check_function_exists(strerror_r HAVE_STRERROR_R)
check_function_exists(sched_get_priority_max HAVE_SCHED_GET_PRIORITY_MAX)
check_function_exists(sched_get_priority_min HAVE_SCHED_GET_PRIORITY_MIN)

include(CheckCSourceCompiles)
include(CheckCXXSourceCompiles)

check_cxx_source_compiles(
  "
  #include <string.h>
  int main(){char b;char *a = strerror_r(0, &b, 0); return(0);}
  "
  STRERROR_R_CHAR_P)


set(PACKAGE ${PACKAGE_NAME})
set(PACKAGE_STRING "${PACKAGE_NAME} ${PACKAGE_VERSION}")
set(VERSION ${thrift_VERSION})

# generate a config.h file
configure_file("${CMAKE_CURRENT_SOURCE_DIR}/build/cmake/config.h.in" "${CMAKE_CURRENT_BINARY_DIR}/thrift/config.h")
# HACK: Some files include thrift/config.h and some config.h so we include both. This should be cleaned up.
include_directories("${CMAKE_CURRENT_BINARY_DIR}/thrift" "${CMAKE_CURRENT_BINARY_DIR}")
