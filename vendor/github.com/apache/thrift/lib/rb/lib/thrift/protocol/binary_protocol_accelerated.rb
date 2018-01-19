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

=begin
The only change required for a transport to support BinaryProtocolAccelerated is to implement 2 methods:
  * borrow(size), which takes an optional argument and returns atleast _size_ bytes from the transport, 
                  or the default buffer size if no argument is given
  * consume!(size), which removes size bytes from the front of the buffer

See MemoryBuffer and BufferedTransport for examples.
=end

module Thrift
  class BinaryProtocolAcceleratedFactory < BaseProtocolFactory
    def get_protocol(trans)
      if (defined? BinaryProtocolAccelerated)
        BinaryProtocolAccelerated.new(trans)
      else
        BinaryProtocol.new(trans)
      end
    end
  end
end
