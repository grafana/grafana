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

file(MAKE_DIRECTORY ${CURDIR}/gen-cpp)
execute_process(COMMAND ${THRIFT_COMPILER} -r -out ${CURDIR}/gen-cpp -gen cpp ${SRCDIR}/../../../test/Include.thrift)
if(EXITCODE)
  message(FATAL_ERROR "FAILED: \"${ARGV}\": \"${EXITCODE}\"")
endif()
if(WIN32)
    set(ENV{PATH} "${BINDIR}/${BUILDTYPE};${BINDIR};$ENV{PATH}")
else()
    set(ENV{PATH} "${BINDIR}:$ENV{PATH}")
endif()

file(MAKE_DIRECTORY ${CURDIR}/gen-mycpp)
execute_process(COMMAND ${THRIFT_COMPILER} -r -out ${CURDIR}/gen-mycpp -gen mycpp ${SRCDIR}/../../../test/Include.thrift RESULT_VARIABLE EXITCODE)
if(EXITCODE)
  message(FATAL_ERROR "FAILED: \"${EXITCODE}\"")
endif()

find_program(DIFF diff)
if(DIFF)
  execute_process(COMMAND ${DIFF} -urN gen-cpp gen-mycpp RESULT_VARIABLE EXITCODE)
  if(EXITCODE)
    message(FATAL_ERROR "FAILED: \"${EXITCODE}\"")
  endif()
else()
    message(WARNING "diff executable is not available. Not validating plugin-generated code.")
endif()
