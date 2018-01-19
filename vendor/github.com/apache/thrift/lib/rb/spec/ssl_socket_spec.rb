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

describe 'SSLSocket' do

  describe Thrift::SSLSocket do
    before(:each) do
      @context = OpenSSL::SSL::SSLContext.new
      @socket = Thrift::SSLSocket.new
      @simple_socket_handle = mock("Handle", :closed? => false)
      @simple_socket_handle.stub!(:close)
      @simple_socket_handle.stub!(:connect_nonblock)
      @simple_socket_handle.stub!(:setsockopt)

      @handle = mock(mock("SSLHandle", :connect_nonblock => true, :post_connection_check => true), :closed? => false)
      @handle.stub!(:connect_nonblock)
      @handle.stub!(:close)
      @handle.stub!(:post_connection_check)

      ::Socket.stub!(:new).and_return(@simple_socket_handle)
      OpenSSL::SSL::SSLSocket.stub!(:new).and_return(@handle)
    end

    it_should_behave_like "a socket"

    it "should raise a TransportException when it cannot open a ssl socket" do
      ::Socket.should_receive(:getaddrinfo).with("localhost", 9090, nil, ::Socket::SOCK_STREAM).and_return([[]])
      lambda { @socket.open }.should raise_error(Thrift::TransportException) { |e| e.type.should == Thrift::TransportException::NOT_OPEN }
    end

    it "should open a ::Socket with default args" do
      OpenSSL::SSL::SSLSocket.should_receive(:new).with(@simple_socket_handle, nil).and_return(@handle)
      @handle.should_receive(:post_connection_check).with('localhost')
      @socket.open
    end

    it "should accept host/port options" do
      handle = mock("Handle", :connect_nonblock => true, :setsockopt => nil)
      ::Socket.stub!(:new).and_return(handle)
      ::Socket.should_receive(:getaddrinfo).with("my.domain", 1234, nil, ::Socket::SOCK_STREAM).and_return([[]])
      ::Socket.should_receive(:sockaddr_in)
      OpenSSL::SSL::SSLSocket.should_receive(:new).with(handle, nil).and_return(@handle)
      @handle.should_receive(:post_connection_check).with('my.domain')
      Thrift::SSLSocket.new('my.domain', 1234, 6000, nil).open
    end

    it "should accept an optional timeout" do
      Thrift::SSLSocket.new('localhost', 8080, 5).timeout.should == 5
    end

    it "should accept an optional context" do
      Thrift::SSLSocket.new('localhost', 8080, 5, @context).ssl_context.should == @context
    end
  end
end
