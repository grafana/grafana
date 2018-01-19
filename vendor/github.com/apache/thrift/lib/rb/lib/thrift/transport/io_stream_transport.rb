# encoding: ascii-8bit
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

# Very very simple implementation of wrapping two objects, one with a #read
# method and one with a #write method, into a transport for thrift.
#
# Assumes both objects are open, remain open, don't require flushing, etc.
#
module Thrift
  class IOStreamTransport < BaseTransport
    def initialize(input, output)
      @input = input
      @output = output
    end

    def open?; not @input.closed? or not @output.closed? end
    def read(sz); @input.read(sz) end
    def write(buf); @output.write(Bytes.force_binary_encoding(buf)) end
    def close; @input.close; @output.close end
    def to_io; @input end # we're assuming this is used in a IO.select for reading
  end
end