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


#  GHC_FOUND - system has GHC
#  GHC - the GHC executable
#  RUN_HASKELL_FOUND - system has runhaskell
#  RUN_HASKELL - the runhaskell executable
#
# It will search the environment variable GHC_HOME if it is set

include(FindPackageHandleStandardArgs)

find_program(GHC NAMES ghc PATHS $ENV{GHC_HOME}/bin)
find_package_handle_standard_args(GHC DEFAULT_MSG GHC)
mark_as_advanced(GHC)

find_program(RUN_HASKELL NAMES runhaskell PATHS $ENV{GHC_HOME}/bin)
find_package_handle_standard_args(RUN_HASKELL DEFAULT_MSG RUN_HASKELL)
mark_as_advanced(RUN_HASKELL)
