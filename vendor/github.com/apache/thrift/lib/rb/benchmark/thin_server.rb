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

$:.unshift File.dirname(__FILE__) + '/../lib'
require 'thrift'
$:.unshift File.dirname(__FILE__) + "/gen-rb"
require 'benchmark_service'
HOST = 'localhost'
PORT = 42587

class BenchmarkHandler
  # 1-based index into the fibonacci sequence
  def fibonacci(n)
    seq = [1, 1]
    3.upto(n) do
      seq << seq[-1] + seq[-2]
    end
    seq[n-1] # n is 1-based
  end
end

handler = BenchmarkHandler.new
processor = ThriftBenchmark::BenchmarkService::Processor.new(handler)
transport = Thrift::ServerSocket.new(HOST, PORT)
transport_factory = Thrift::FramedTransportFactory.new
logger = Logger.new(STDERR)
logger.level = Logger::WARN
Thrift::NonblockingServer.new(processor, transport, transport_factory, nil, 20, logger).serve
