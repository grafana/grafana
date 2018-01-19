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

describe 'UNIXSocket' do

  describe Thrift::UNIXSocket do
    before(:each) do
      @path = '/tmp/thrift_spec_socket'
      @socket = Thrift::UNIXSocket.new(@path)
      @handle = mock("Handle", :closed? => false)
      @handle.stub!(:close)
      ::UNIXSocket.stub!(:new).and_return(@handle)
    end

    it_should_behave_like "a socket"

    it "should raise a TransportException when it cannot open a socket" do
      ::UNIXSocket.should_receive(:new).and_raise(StandardError)
      lambda { @socket.open }.should raise_error(Thrift::TransportException) { |e| e.type.should == Thrift::TransportException::NOT_OPEN }
    end

    it "should accept an optional timeout" do
      ::UNIXSocket.stub!(:new)
      Thrift::UNIXSocket.new(@path, 5).timeout.should == 5
    end
  end

  describe Thrift::UNIXServerSocket do
    before(:each) do
      @path = '/tmp/thrift_spec_socket'
      @socket = Thrift::UNIXServerSocket.new(@path)
    end

    it "should create a handle when calling listen" do
      UNIXServer.should_receive(:new).with(@path)
      @socket.listen
    end

    it "should create a Thrift::UNIXSocket to wrap accepted sockets" do
      handle = mock("UNIXServer")
      UNIXServer.should_receive(:new).with(@path).and_return(handle)
      @socket.listen
      sock = mock("sock")
      handle.should_receive(:accept).and_return(sock)
      trans = mock("UNIXSocket")
      Thrift::UNIXSocket.should_receive(:new).and_return(trans)
      trans.should_receive(:handle=).with(sock)
      @socket.accept.should == trans
    end

    it "should close the handle when closed" do
      handle = mock("UNIXServer", :closed? => false)
      UNIXServer.should_receive(:new).with(@path).and_return(handle)
      @socket.listen
      handle.should_receive(:close)
      File.stub!(:delete)
      @socket.close
    end

    it "should delete the socket when closed" do
      handle = mock("UNIXServer", :closed? => false)
      UNIXServer.should_receive(:new).with(@path).and_return(handle)
      @socket.listen
      handle.stub!(:close)
      File.should_receive(:delete).with(@path)
      @socket.close
    end

    it "should return nil when accepting if there is no handle" do
      @socket.accept.should be_nil
    end

    it "should return true for closed? when appropriate" do
      handle = mock("UNIXServer", :closed? => false)
      UNIXServer.stub!(:new).and_return(handle)
      File.stub!(:delete)
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
