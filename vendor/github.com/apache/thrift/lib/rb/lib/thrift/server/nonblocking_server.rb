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

require 'logger'
require 'thread'

module Thrift
  # this class expects to always use a FramedTransport for reading messages
  class NonblockingServer < BaseServer
    def initialize(processor, server_transport, transport_factory=nil, protocol_factory=nil, num=20, logger=nil)
      super(processor, server_transport, transport_factory, protocol_factory)
      @num_threads = num
      if logger.nil?
        @logger = Logger.new(STDERR)
        @logger.level = Logger::WARN
      else
        @logger = logger
      end
      @shutdown_semaphore = Mutex.new
      @transport_semaphore = Mutex.new
    end

    def serve
      @logger.info "Starting #{self}"
      @server_transport.listen
      @io_manager = start_io_manager

      begin
        loop do
          break if @server_transport.closed?
          begin
            rd, = select([@server_transport], nil, nil, 0.1)
          rescue Errno::EBADF => e
            # In Ruby 1.9, calling @server_transport.close in shutdown paths causes the select() to raise an
            # Errno::EBADF. If this happens, ignore it and retry the loop.
            break
          end
          next if rd.nil?
          socket = @server_transport.accept
          @logger.debug "Accepted socket: #{socket.inspect}"
          @io_manager.add_connection socket
        end
      rescue IOError => e
      end
      # we must be shutting down
      @logger.info "#{self} is shutting down, goodbye"
    ensure
      @transport_semaphore.synchronize do
        @server_transport.close
      end
      @io_manager.ensure_closed unless @io_manager.nil?
    end

    def shutdown(timeout = 0, block = true)
      @shutdown_semaphore.synchronize do
        return if @is_shutdown
        @is_shutdown = true
      end
      # nonblocking is intended for calling from within a Handler
      # but we can't change the order of operations here, so lets thread
      shutdown_proc = lambda do
        @io_manager.shutdown(timeout)
        @transport_semaphore.synchronize do
          @server_transport.close # this will break the accept loop
        end
      end
      if block
        shutdown_proc.call
      else
        Thread.new &shutdown_proc
      end
    end

    private

    def start_io_manager
      iom = IOManager.new(@processor, @server_transport, @transport_factory, @protocol_factory, @num_threads, @logger)
      iom.spawn
      iom
    end

    class IOManager # :nodoc:
      DEFAULT_BUFFER = 2**20
      
      def initialize(processor, server_transport, transport_factory, protocol_factory, num, logger)
        @processor = processor
        @server_transport = server_transport
        @transport_factory = transport_factory
        @protocol_factory = protocol_factory
        @num_threads = num
        @logger = logger
        @connections = []
        @buffers = Hash.new { |h,k| h[k] = '' }
        @signal_queue = Queue.new
        @signal_pipes = IO.pipe
        @signal_pipes[1].sync = true
        @worker_queue = Queue.new
        @shutdown_queue = Queue.new
      end

      def add_connection(socket)
        signal [:connection, socket]
      end

      def spawn
        @iom_thread = Thread.new do
          @logger.debug "Starting #{self}"
          run
        end
      end

      def shutdown(timeout = 0)
        @logger.debug "#{self} is shutting down workers"
        @worker_queue.clear
        @num_threads.times { @worker_queue.push [:shutdown] }
        signal [:shutdown, timeout]
        @shutdown_queue.pop
        @signal_pipes[0].close
        @signal_pipes[1].close
        @logger.debug "#{self} is shutting down, goodbye"
      end

      def ensure_closed
        kill_worker_threads if @worker_threads
        @iom_thread.kill
      end

      private
      
      def run
        spin_worker_threads

        loop do
          rd, = select([@signal_pipes[0], *@connections])
          if rd.delete @signal_pipes[0]
            break if read_signals == :shutdown
          end
          rd.each do |fd|
            begin
              if fd.handle.eof?
                remove_connection fd
              else
                read_connection fd
              end
            rescue Errno::ECONNRESET
              remove_connection fd
            end
          end
        end
        join_worker_threads(@shutdown_timeout)
      ensure
        @shutdown_queue.push :shutdown
      end

      def read_connection(fd)
        @buffers[fd] << fd.read(DEFAULT_BUFFER)
        while(frame = slice_frame!(@buffers[fd]))
          @logger.debug "#{self} is processing a frame"
          @worker_queue.push [:frame, fd, frame]
        end
      end

      def spin_worker_threads
        @logger.debug "#{self} is spinning up worker threads"
        @worker_threads = []
        @num_threads.times do
          @worker_threads << spin_thread
        end
      end

      def spin_thread
        Worker.new(@processor, @transport_factory, @protocol_factory, @logger, @worker_queue).spawn
      end

      def signal(msg)
        @signal_queue << msg
        @signal_pipes[1].write " "
      end

      def read_signals
        # clear the signal pipe
        # note that since read_nonblock is broken in jruby,
        # we can only read up to a set number of signals at once
        sigstr = @signal_pipes[0].readpartial(1024)
        # now read the signals
        begin
          sigstr.length.times do
            signal, obj = @signal_queue.pop(true)
            case signal
            when :connection
              @connections << obj
            when :shutdown
              @shutdown_timeout = obj
              return :shutdown
            end
          end
        rescue ThreadError
          # out of signals
          # note that in a perfect world this would never happen, since we're
          # only reading the number of signals pushed on the pipe, but given the lack
          # of locks, in theory we could clear the pipe/queue while a new signal is being
          # placed on the pipe, at which point our next read_signals would hit this error
        end
      end

      def remove_connection(fd)
        # don't explicitly close it, a thread may still be writing to it
        @connections.delete fd
        @buffers.delete fd
      end

      def join_worker_threads(shutdown_timeout)
        start = Time.now
        @worker_threads.each do |t|
          if shutdown_timeout > 0
            timeout = (start + shutdown_timeout) - Time.now
            break if timeout <= 0
            t.join(timeout)
          else
            t.join
          end
        end
        kill_worker_threads
      end

      def kill_worker_threads
        @worker_threads.each do |t|
          t.kill if t.status
        end
        @worker_threads.clear
      end

      def slice_frame!(buf)
        if buf.length >= 4
          size = buf.unpack('N').first
          if buf.length >= size + 4
            buf.slice!(0, size + 4)
          else
            nil
          end
        else
          nil
        end
      end

      class Worker # :nodoc:
        def initialize(processor, transport_factory, protocol_factory, logger, queue)
          @processor = processor
          @transport_factory = transport_factory
          @protocol_factory = protocol_factory
          @logger = logger
          @queue = queue
        end

        def spawn
          Thread.new do
            @logger.debug "#{self} is spawning"
            run
          end
        end

        private

        def run
          loop do
            cmd, *args = @queue.pop
            case cmd
            when :shutdown
              @logger.debug "#{self} is shutting down, goodbye"
              break
            when :frame
              fd, frame = args
              begin
                otrans = @transport_factory.get_transport(fd)
                oprot = @protocol_factory.get_protocol(otrans)
                membuf = MemoryBufferTransport.new(frame)
                itrans = @transport_factory.get_transport(membuf)
                iprot = @protocol_factory.get_protocol(itrans)
                @processor.process(iprot, oprot)
              rescue => e
                @logger.error "#{Thread.current.inspect} raised error: #{e.inspect}\n#{e.backtrace.join("\n")}"
              end
            end
          end
        end
      end
    end
  end
end
