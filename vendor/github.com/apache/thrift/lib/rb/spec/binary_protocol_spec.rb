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
require File.expand_path("#{File.dirname(__FILE__)}/binary_protocol_spec_shared")

describe 'BinaryProtocol' do

  it_should_behave_like 'a binary protocol'

  def protocol_class
    Thrift::BinaryProtocol
  end

  describe Thrift::BinaryProtocol do

    before(:each) do
      @trans = Thrift::MemoryBufferTransport.new
      @prot = protocol_class.new(@trans)
    end

    it "should read a message header" do
      @trans.write([protocol_class.const_get(:VERSION_1) | Thrift::MessageTypes::REPLY].pack('N'))
      @trans.write([42].pack('N'))
      @prot.should_receive(:read_string).and_return('testMessage')
      @prot.read_message_begin.should == ['testMessage', Thrift::MessageTypes::REPLY, 42]
    end

    it "should raise an exception if the message header has the wrong version" do
      @prot.should_receive(:read_i32).and_return(-1)
      lambda { @prot.read_message_begin }.should raise_error(Thrift::ProtocolException, 'Missing version identifier') do |e|
        e.type == Thrift::ProtocolException::BAD_VERSION
      end
    end

    it "should raise an exception if the message header does not exist and strict_read is enabled" do
      @prot.should_receive(:read_i32).and_return(42)
      @prot.should_receive(:strict_read).and_return(true)
      lambda { @prot.read_message_begin }.should raise_error(Thrift::ProtocolException, 'No version identifier, old protocol client?') do |e|
        e.type == Thrift::ProtocolException::BAD_VERSION
      end
    end
  end

  describe Thrift::BinaryProtocolFactory do
    it "should create a BinaryProtocol" do
      Thrift::BinaryProtocolFactory.new.get_protocol(mock("MockTransport")).should be_instance_of(Thrift::BinaryProtocol)
    end
  end
end
