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

export CLASSPATH

# Make sure this doesn't fail if ant is not configured.
clean-local:
	ANT=$(ANT) ; if test -z "$$ANT" ; then ANT=: ; fi ; \
	$$ANT $(ANT_FLAGS) clean

all-local:
	$(ANT) $(ANT_FLAGS) compile

check-local: all
	$(ANT) $(ANT_FLAGS) test

tutorial: all
	$(ANT) $(ANT_FLAGS) tutorial

tutorialserver: all
	$(ANT) $(ANT_FLAGS) tutorialserver

tutorialclient: all
	$(ANT) $(ANT_FLAGS) tutorialclient

EXTRA_DIST = \
	build.xml \
	src \
	README.md
