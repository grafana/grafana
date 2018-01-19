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
require 'rack/test'
require 'thrift/server/thin_http_server'

describe Thrift::ThinHTTPServer do

  let(:processor) { mock('processor') }

  describe "#initialize" do

    context "when using the defaults" do

      it "binds to port 80, with host 0.0.0.0, a path of '/'" do
        Thin::Server.should_receive(:new).with('0.0.0.0', 80, an_instance_of(Rack::Builder))
        Thrift::ThinHTTPServer.new(processor)
      end

      it 'creates a ThinHTTPServer::RackApplicationContext' do
        Thrift::ThinHTTPServer::RackApplication.should_receive(:for).with("/", processor, an_instance_of(Thrift::BinaryProtocolFactory)).and_return(anything)
        Thrift::ThinHTTPServer.new(processor)
      end

      it "uses the BinaryProtocolFactory" do
        Thrift::BinaryProtocolFactory.should_receive(:new)
        Thrift::ThinHTTPServer.new(processor)
      end

    end

    context "when using the options" do

      it 'accepts :ip, :port, :path' do
        ip = "192.168.0.1"
        port = 3000
        path = "/thin"
        Thin::Server.should_receive(:new).with(ip, port, an_instance_of(Rack::Builder))
        Thrift::ThinHTTPServer.new(processor,
                           :ip => ip,
                           :port => port,
                           :path => path)
      end

      it 'creates a ThinHTTPServer::RackApplicationContext with a different protocol factory' do
        Thrift::ThinHTTPServer::RackApplication.should_receive(:for).with("/", processor, an_instance_of(Thrift::JsonProtocolFactory)).and_return(anything)
        Thrift::ThinHTTPServer.new(processor,
                           :protocol_factory => Thrift::JsonProtocolFactory.new)
      end

    end

  end

  describe "#serve" do

    it 'starts the Thin server' do
      underlying_thin_server = mock('thin server', :start => true)
      Thin::Server.stub(:new).and_return(underlying_thin_server)

      thin_thrift_server = Thrift::ThinHTTPServer.new(processor)

      underlying_thin_server.should_receive(:start)
      thin_thrift_server.serve
    end
  end

end

describe Thrift::ThinHTTPServer::RackApplication do
  include Rack::Test::Methods

  let(:processor) { mock('processor') }
  let(:protocol_factory) { mock('protocol factory') }

  def app
    Thrift::ThinHTTPServer::RackApplication.for("/", processor, protocol_factory)
  end

  context "404 response" do

    it 'receives a non-POST' do
      header('Content-Type', "application/x-thrift")
      get "/"
      last_response.status.should be 404
    end

    it 'receives a header other than application/x-thrift' do
      header('Content-Type', "application/json")
      post "/"
      last_response.status.should be 404
    end

  end

  context "200 response" do

    before do
      protocol_factory.stub(:get_protocol)
      processor.stub(:process)
    end

    it 'creates an IOStreamTransport' do
      header('Content-Type', "application/x-thrift")
      Thrift::IOStreamTransport.should_receive(:new).with(an_instance_of(Rack::Lint::InputWrapper), an_instance_of(Rack::Response))
      post "/"
    end

    it 'fetches the right protocol based on the Transport' do
      header('Content-Type', "application/x-thrift")
      protocol_factory.should_receive(:get_protocol).with(an_instance_of(Thrift::IOStreamTransport))
      post "/"
    end

    it 'status code 200' do
      header('Content-Type', "application/x-thrift")
      post "/"
      last_response.ok?.should be_true
    end

  end

end

