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

require File.dirname(__FILE__) + "/../spec/spec_helper.rb"

require "benchmark"
# require "ruby-prof"

obj = Fixtures::COMPACT_PROTOCOL_TEST_STRUCT

HOW_MANY = 1_000

binser = Thrift::Serializer.new
bin_data = binser.serialize(obj)
bindeser = Thrift::Deserializer.new
accel_bin_ser = Thrift::Serializer.new(Thrift::BinaryProtocolAcceleratedFactory.new)
accel_bin_deser = Thrift::Deserializer.new(Thrift::BinaryProtocolAcceleratedFactory.new)

compact_ser = Thrift::Serializer.new(Thrift::CompactProtocolFactory.new)
compact_data = compact_ser.serialize(obj)
compact_deser = Thrift::Deserializer.new(Thrift::CompactProtocolFactory.new)

Benchmark.bm(60) do |reporter|
  reporter.report("binary protocol, write") do
    HOW_MANY.times do
      binser.serialize(obj)
    end
  end
  
  reporter.report("accelerated binary protocol, write") do
    HOW_MANY.times do
      accel_bin_ser.serialize(obj)
    end
  end
  
  reporter.report("compact protocol, write") do
    # RubyProf.start
    HOW_MANY.times do
      compact_ser.serialize(obj)
    end
    # result = RubyProf.stop
    # printer = RubyProf::GraphHtmlPrinter.new(result)
    # file = File.open("profile.html", "w+")
    # printer.print(file, 0)
    # file.close
  end
  
  reporter.report("binary protocol, read") do
    HOW_MANY.times do
      bindeser.deserialize(obj, bin_data)
    end
  end
  
  reporter.report("accelerated binary protocol, read") do
    HOW_MANY.times do
      accel_bin_deser.deserialize(obj, bin_data)
    end
  end
  
  reporter.report("compact protocol, read") do
    HOW_MANY.times do
      compact_deser.deserialize(obj, compact_data)
    end
  end


  # f = File.new("/tmp/testfile", "w")
  # proto = Thrift::BinaryProtocolAccelerated.new(Thrift::IOStreamTransport.new(Thrift::MemoryBufferTransport.new, f))
  # reporter.report("accelerated binary protocol, write (to disk)") do
  #   HOW_MANY.times do
  #     obj.write(proto)
  #   end
  #   f.flush
  # end
  # f.close
  #   
  # f = File.new("/tmp/testfile", "r")
  # proto = Thrift::BinaryProtocolAccelerated.new(Thrift::IOStreamTransport.new(f, Thrift::MemoryBufferTransport.new))
  # reporter.report("accelerated binary protocol, read (from disk)") do
  #   HOW_MANY.times do
  #     obj.read(proto)
  #   end
  # end
  # f.close
  # 
  # f = File.new("/tmp/testfile", "w")
  # reporter.report("compact protocol, write (to disk)") do
  #   proto = Thrift::CompactProtocol.new(Thrift::IOStreamTransport.new(Thrift::MemoryBufferTransport.new, f))
  #   HOW_MANY.times do
  #     obj.write(proto)
  #   end
  #   f.flush
  # end
  # f.close
  # 
  # f = File.new("/tmp/testfile", "r")
  # reporter.report("compact protocol, read (from disk)") do
  #   proto = Thrift::CompactProtocol.new(Thrift::IOStreamTransport.new(f, Thrift::MemoryBufferTransport.new))
  #   HOW_MANY.times do
  #     obj.read(proto)
  #   end
  # end
  # f.close

end
