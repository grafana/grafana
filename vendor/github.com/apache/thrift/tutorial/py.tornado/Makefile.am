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

THRIFT = $(top_builddir)/compiler/cpp/thrift

gen-py.tornado/tutorial/Calculator.py gen-py.tornado/shared/SharedService.py: $(top_srcdir)/tutorial/tutorial.thrift
	$(THRIFT) --gen py:tornado -r $<

all-local: gen-py.tornado/tutorial/Calculator.py

tutorialserver: all
	${PYTHON} PythonServer.py

tutorialclient: all
	${PYTHON} PythonClient.py

clean-local:
	$(RM) -r gen-*

EXTRA_DIST = \
	PythonServer.py \
	PythonClient.py
