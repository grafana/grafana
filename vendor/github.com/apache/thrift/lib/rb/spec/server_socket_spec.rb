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
require File.expand_path("#{File.dirname(__FILE__)}/socket_spec_shared")

describe 'Thrift::ServerSocket' do

  describe Thrift::ServerSocket do
    before(:each) do
      @socket = Thrift::ServerSocket.new(1234)
    end

    it "should create a handle when calling listen" do
      TCPServer.should_receive(:new).with(nil, 1234)
      @socket.listen
    end

    it "should accept an optional host argument" do
      @socket = Thrift::ServerSocket.new('localhost', 1234)
      TCPServer.should_receive(:new).with('localhost', 1234)
      @socket.listen
    end

    it "should create a Thrift::Socket to wrap accepted sockets" do
      handle = mock("TCPServer")
      TCPServer.should_receive(:new).with(nil, 1234).and_return(handle)
      @socket.listen
      sock = mock("sock")
      handle.should_receive(:accept).and_return(sock)
      trans = mock("Socket")
      Thrift::Socket.should_receive(:new).and_return(trans)
      trans.should_receive(:handle=).with(sock)
      @socket.accept.should == trans
    end

    it "should close the handle when closed" do
      handle = mock("TCPServer", :closed? => false)
      TCPServer.should_receive(:new).with(nil, 1234).and_return(handle)
      @socket.listen
      handle.should_receive(:close)
      @socket.close
    end

    it "should return nil when accepting if there is no handle" do
      @socket.accept.should be_nil
    end

    it "should return true for closed? when appropriate" do
      handle = mock("TCPServer", :closed? => false)
      TCPServer.stub!(:new).and_return(handle)
      @socket.listen
      @socket.should_not be_closed
      handle.stub!(:close)
      @socket.close
      @socket.should be_closed
      @socket.listen
      @socket.should_not be_closed
      handle.stub!(:closed?).and_return(true)
      @socket.should be_closed
    end
  end
end
