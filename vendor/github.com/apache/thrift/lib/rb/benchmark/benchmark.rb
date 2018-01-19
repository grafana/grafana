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

require 'rubygems'
$:.unshift File.dirname(__FILE__) + '/../lib'
require 'thrift'
require 'stringio'

HOST = '127.0.0.1'
PORT = 42587

###############
## Server
###############

class Server
  attr_accessor :serverclass
  attr_accessor :interpreter
  attr_accessor :host
  attr_accessor :port

  def initialize(opts)
    @serverclass = opts.fetch(:class, Thrift::NonblockingServer)
    @interpreter = opts.fetch(:interpreter, "ruby")
    @host = opts.fetch(:host, ::HOST)
    @port = opts.fetch(:port, ::PORT)
  end

  def start
    return if @serverclass == Object
    args = (File.basename(@interpreter) == "jruby" ? "-J-server" : "")
    @pipe = IO.popen("#{@interpreter} #{args} #{File.dirname(__FILE__)}/server.rb #{@host} #{@port} #{@serverclass.name}", "r+")
    Marshal.load(@pipe) # wait until the server has started
    sleep 0.4 # give the server time to actually start spawning sockets
  end

  def shutdown
    return unless @pipe
    Marshal.dump(:shutdown, @pipe)
    begin
      @pipe.read(10) # block until the server shuts down
    rescue EOFError
    end
    @pipe.close
    @pipe = nil
  end
end

class BenchmarkManager
  def initialize(opts, server)
    @socket = opts.fetch(:socket) do
      @host = opts.fetch(:host, 'localhost')
      @port = opts.fetch(:port)
      nil
    end
    @num_processes = opts.fetch(:num_processes, 40)
    @clients_per_process = opts.fetch(:clients_per_process, 10)
    @calls_per_client = opts.fetch(:calls_per_client, 50)
    @interpreter = opts.fetch(:interpreter, "ruby")
    @server = server
    @log_exceptions = opts.fetch(:log_exceptions, false)
  end

  def run
    @pool = []
    @benchmark_start = Time.now
    puts "Spawning benchmark processes..."
    @num_processes.times do
      spawn
      sleep 0.02 # space out spawns
    end
    collect_output
    @benchmark_end = Time.now # we know the procs are done here
    translate_output
    analyze_output
    report_output
  end

  def spawn
    pipe = IO.popen("#{@interpreter} #{File.dirname(__FILE__)}/client.rb #{"-log-exceptions" if @log_exceptions} #{@host} #{@port} #{@clients_per_process} #{@calls_per_client}")
    @pool << pipe
  end

  def socket_class
    if @socket
      Thrift::UNIXSocket
    else
      Thrift::Socket
    end
  end

  def collect_output
    puts "Collecting output..."
    # read from @pool until all sockets are closed
    @buffers = Hash.new { |h,k| h[k] = '' }
    until @pool.empty?
      rd, = select(@pool)
      next if rd.nil?
      rd.each do |fd|
        begin
          @buffers[fd] << fd.readpartial(4096)
        rescue EOFError
          @pool.delete fd
        end
      end
    end
  end

  def translate_output
    puts "Translating output..."
    @output = []
    @buffers.each do |fd, buffer|
      strio = StringIO.new(buffer)
      logs = []
      begin
        loop do
          logs << Marshal.load(strio)
        end
      rescue EOFError
        @output << logs
      end
    end
  end

  def analyze_output
    puts "Analyzing output..."
    call_times = []
    client_times = []
    connection_failures = []
    connection_errors = []
    shortest_call = 0
    shortest_client = 0
    longest_call = 0
    longest_client = 0
    @output.each do |logs|
      cur_call, cur_client = nil
      logs.each do |tok, time|
        case tok
        when :start
          cur_client = time
        when :call_start
          cur_call = time
        when :call_end
          delta = time - cur_call
          call_times << delta
          longest_call = delta unless longest_call > delta
          shortest_call = delta if shortest_call == 0 or delta < shortest_call
          cur_call = nil
        when :end
          delta = time - cur_client
          client_times << delta
          longest_client = delta unless longest_client > delta
          shortest_client = delta if shortest_client == 0 or delta < shortest_client
          cur_client = nil
        when :connection_failure
          connection_failures << time
        when :connection_error
          connection_errors << time
        end
      end
    end
    @report = {}
    @report[:total_calls] = call_times.inject(0.0) { |a,t| a += t }
    @report[:avg_calls] = @report[:total_calls] / call_times.size
    @report[:total_clients] = client_times.inject(0.0) { |a,t| a += t }
    @report[:avg_clients] = @report[:total_clients] / client_times.size
    @report[:connection_failures] = connection_failures.size
    @report[:connection_errors] = connection_errors.size
    @report[:shortest_call] = shortest_call
    @report[:shortest_client] = shortest_client
    @report[:longest_call] = longest_call
    @report[:longest_client] = longest_client
    @report[:total_benchmark_time] = @benchmark_end - @benchmark_start
    @report[:fastthread] = $".include?('fastthread.bundle')
  end

  def report_output
    fmt = "%.4f seconds"
    puts
    tabulate "%d",
             [["Server class", "%s"], @server.serverclass == Object ? "" : @server.serverclass],
             [["Server interpreter", "%s"], @server.interpreter],
             [["Client interpreter", "%s"], @interpreter],
             [["Socket class", "%s"], socket_class],
             ["Number of processes", @num_processes],
             ["Clients per process", @clients_per_process],
             ["Calls per client", @calls_per_client],
             [["Using fastthread", "%s"], @report[:fastthread] ? "yes" : "no"]
    puts
    failures = (@report[:connection_failures] > 0)
    tabulate fmt,
             [["Connection failures", "%d", [:red, :bold]], @report[:connection_failures]],
             [["Connection errors", "%d", [:red, :bold]], @report[:connection_errors]],
             ["Average time per call", @report[:avg_calls]],
             ["Average time per client (%d calls)" % @calls_per_client, @report[:avg_clients]],
             ["Total time for all calls", @report[:total_calls]],
             ["Real time for benchmarking", @report[:total_benchmark_time]],
             ["Shortest call time", @report[:shortest_call]],
             ["Longest call time", @report[:longest_call]],
             ["Shortest client time (%d calls)" % @calls_per_client, @report[:shortest_client]],
             ["Longest client time (%d calls)" % @calls_per_client, @report[:longest_client]]
  end

  ANSI = {
    :reset => 0,
    :bold => 1,
    :black => 30,
    :red => 31,
    :green => 32,
    :yellow => 33,
    :blue => 34,
    :magenta => 35,
    :cyan => 36,
    :white => 37
  }

  def tabulate(fmt, *labels_and_values)
    labels = labels_and_values.map { |l| Array === l ? l.first : l }
    label_width = labels.inject(0) { |w,l| l.size > w ? l.size : w }
    labels_and_values.each do |(l,v)|
      f = fmt
      l, f, c = l if Array === l
      fmtstr = "%-#{label_width+1}s #{f}"
      if STDOUT.tty? and c and v.to_i > 0
        fmtstr = "\e[#{[*c].map { |x| ANSI[x] } * ";"}m" + fmtstr + "\e[#{ANSI[:reset]}m"
      end
      puts fmtstr % [l+":", v]
    end
  end
end

def resolve_const(const)
  const and const.split('::').inject(Object) { |k,c| k.const_get(c) }
end

puts "Starting server..."
args = {}
args[:interpreter] = ENV['THRIFT_SERVER_INTERPRETER'] || ENV['THRIFT_INTERPRETER'] || "ruby"
args[:class] = resolve_const(ENV['THRIFT_SERVER']) || Thrift::NonblockingServer
args[:host] = ENV['THRIFT_HOST'] || HOST
args[:port] = (ENV['THRIFT_PORT'] || PORT).to_i
server = Server.new(args)
server.start

args = {}
args[:host] = ENV['THRIFT_HOST'] || HOST
args[:port] = (ENV['THRIFT_PORT'] || PORT).to_i
args[:num_processes] = (ENV['THRIFT_NUM_PROCESSES'] || 40).to_i
args[:clients_per_process] = (ENV['THRIFT_NUM_CLIENTS'] || 5).to_i
args[:calls_per_client] = (ENV['THRIFT_NUM_CALLS'] || 50).to_i
args[:interpreter] = ENV['THRIFT_CLIENT_INTERPRETER'] || ENV['THRIFT_INTERPRETER'] || "ruby"
args[:log_exceptions] = !!ENV['THRIFT_LOG_EXCEPTIONS']
BenchmarkManager.new(args, server).run

server.shutdown
