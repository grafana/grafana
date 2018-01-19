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

LIB_D_DIR = $(top_srcdir)/lib/d

GEN_SRC = gen-d/share/SharedService.d gen-d/share/shared_types.d \
	gen-d/tutorial/tutorial_types.d gen-d/tutorial/Calculator.d

$(GEN_SRC): $(top_srcdir)/tutorial/tutorial.thrift
	$(top_builddir)/compiler/cpp/thrift --gen d -r $<

server: server.d $(GEN_SRC)
	$(DMD) -I${LIB_D_DIR}/src -L-L${LIB_D_DIR} -L-lthriftd server.d ${GEN_SRC}

client: client.d $(GEN_SRC)
	$(DMD) -I${LIB_D_DIR}/src -L-L${LIB_D_DIR} -L-lthriftd client.d ${GEN_SRC}

PROGS = server client

if WITH_D_EVENT_TESTS
async_client: async_client.d $(GEN_SRC)
	$(DMD) -I${LIB_D_DIR}/src -L-L${LIB_D_DIR} -L-lthriftd-event -L-lthriftd -L-levent async_client.d ${GEN_SRC}

PROGS += async_client
endif

all-local: $(PROGS)

clean:
	$(RM) -f $(PROGS)
