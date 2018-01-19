# encoding: UTF-8
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

require 'spec_helper'

describe Thrift::CompactProtocol do
  TESTS = {
    :byte => (-127..127).to_a,
    :i16 => (0..14).map {|shift| [1 << shift, -(1 << shift)]}.flatten.sort,
    :i32 => (0..30).map {|shift| [1 << shift, -(1 << shift)]}.flatten.sort,
    :i64 => (0..62).map {|shift| [1 << shift, -(1 << shift)]}.flatten.sort,
    :string => ["", "1", "short", "fourteen123456", "fifteen12345678", "unicode characters: \u20AC \u20AD", "1" * 127, "1" * 3000],
    :binary => ["", "\001", "\001" * 5, "\001" * 14, "\001" * 15, "\001" * 127, "\001" * 3000],
    :double => [0.0, 1.0, -1.0, 1.1, -1.1, 10000000.1, 1.0/0.0, -1.0/0.0],
    :bool => [true, false]
  }
  
  it "should encode and decode naked primitives correctly" do
    TESTS.each_pair do |primitive_type, test_values|
      test_values.each do |value|
        # puts "testing #{value}" if primitive_type == :i64
        trans = Thrift::MemoryBufferTransport.new
        proto = Thrift::CompactProtocol.new(trans)
        
        proto.send(writer(primitive_type), value)
        # puts "buf: #{trans.inspect_buffer}" if primitive_type == :i64
        read_back = proto.send(reader(primitive_type))
        read_back.should == value
      end
    end
  end
  
  it "should encode and decode primitives in fields correctly" do
    TESTS.each_pair do |primitive_type, test_values|
      final_primitive_type = primitive_type == :binary ? :string : primitive_type
      thrift_type = Thrift::Types.const_get(final_primitive_type.to_s.upcase)
      # puts primitive_type
      test_values.each do |value|
        trans = Thrift::MemoryBufferTransport.new
        proto = Thrift::CompactProtocol.new(trans)

        proto.write_field_begin(nil, thrift_type, 15)
        proto.send(writer(primitive_type), value)
        proto.write_field_end

        proto = Thrift::CompactProtocol.new(trans)
        name, type, id = proto.read_field_begin
        type.should == thrift_type
        id.should == 15
        read_back = proto.send(reader(primitive_type))
        read_back.should == value
        proto.read_field_end
      end
    end
  end

  it "should encode and decode a monster struct correctly" do
    trans = Thrift::MemoryBufferTransport.new
    proto = Thrift::CompactProtocol.new(trans)

    struct = Thrift::Test::CompactProtoTestStruct.new
    # sets and maps don't hash well... not sure what to do here.
    struct.write(proto)

    struct2 = Thrift::Test::CompactProtoTestStruct.new
    struct2.read(proto)    
    struct2.should == struct
  end

  it "should make method calls correctly" do
    client_out_trans = Thrift::MemoryBufferTransport.new
    client_out_proto = Thrift::CompactProtocol.new(client_out_trans)

    client_in_trans = Thrift::MemoryBufferTransport.new
    client_in_proto = Thrift::CompactProtocol.new(client_in_trans)

    processor = Thrift::Test::Srv::Processor.new(JankyHandler.new)

    client = Thrift::Test::Srv::Client.new(client_in_proto, client_out_proto)
    client.send_Janky(1)
    # puts client_out_trans.inspect_buffer
    processor.process(client_out_proto, client_in_proto)
    client.recv_Janky.should == 2
  end
  
  it "should deal with fields following fields that have non-delta ids" do
    brcp = Thrift::Test::BreaksRubyCompactProtocol.new(
      :field1 => "blah", 
      :field2 => Thrift::Test::BigFieldIdStruct.new(
        :field1 => "string1", 
        :field2 => "string2"), 
      :field3 => 3)
    ser = Thrift::Serializer.new(Thrift::CompactProtocolFactory.new)
    bytes = ser.serialize(brcp)

    deser = Thrift::Deserializer.new(Thrift::CompactProtocolFactory.new)
    brcp2 = Thrift::Test::BreaksRubyCompactProtocol.new
    deser.deserialize(brcp2, bytes)
    brcp2.should == brcp
  end
  
  it "should deserialize an empty map to an empty hash" do
    struct = Thrift::Test::SingleMapTestStruct.new(:i32_map => {})
    ser = Thrift::Serializer.new(Thrift::CompactProtocolFactory.new)
    bytes = ser.serialize(struct)

    deser = Thrift::Deserializer.new(Thrift::CompactProtocolFactory.new)
    struct2 = Thrift::Test::SingleMapTestStruct.new
    deser.deserialize(struct2, bytes)
    struct.should == struct2
  end
  
  class JankyHandler
    def Janky(i32arg)
      i32arg * 2
    end
  end
  
  def writer(sym)
    "write_#{sym.to_s}"
  end
  
  def reader(sym)
    "read_#{sym.to_s}"
  end
end
