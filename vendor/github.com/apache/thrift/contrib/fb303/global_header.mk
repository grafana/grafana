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

#define thrift_template
#  $(1) : $(2)
#	$$(THRIFT) $(3) $(4) $(5) $(6) $(7) $(8) $$<
#endef

define thrift_template
XTARGET := $(shell perl -e '@val = split("\/","$(2)"); $$last = pop(@val);split("\\.",$$last);print "$(1)/"."gen-cpp/"."@_[0]"."_types.cpp\n"' )

ifneq ($$(XBUILT_SOURCES),) 
    XBUILT_SOURCES := $$(XBUILT_SOURCES) $$(XTARGET)
else
    XBUILT_SOURCES := $$(XTARGET)
endif
$$(XTARGET) : $(2)
	$$(THRIFT) -o $1 $3 $$<
endef

clean-common:
	rm -rf gen-*
