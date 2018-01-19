/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package org.apache.thrift.server;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.SelectionKey;
import java.nio.channels.Selector;
import java.nio.channels.spi.SelectorProvider;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

import org.apache.thrift.TAsyncProcessor;
import org.apache.thrift.TByteArrayOutputStream;
import org.apache.thrift.TException;
import org.apache.thrift.protocol.TProtocol;
import org.apache.thrift.transport.TFramedTransport;
import org.apache.thrift.transport.TIOStreamTransport;
import org.apache.thrift.transport.TMemoryInputTransport;
import org.apache.thrift.transport.TNonblockingServerTransport;
import org.apache.thrift.transport.TNonblockingTransport;
import org.apache.thrift.transport.TTransport;
import org.apache.thrift.transport.TTransportException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Provides common methods and classes used by nonblocking TServer
 * implementations.
 */
public abstract class AbstractNonblockingServer extends TServer {
  protected final Logger LOGGER = LoggerFactory.getLogger(getClass().getName());

  public static abstract class AbstractNonblockingServerArgs<T extends AbstractNonblockingServerArgs<T>> extends AbstractServerArgs<T> {
    public long maxReadBufferBytes = Long.MAX_VALUE;

    public AbstractNonblockingServerArgs(TNonblockingServerTransport transport) {
      super(transport);
      transportFactory(new TFramedTransport.Factory());
    }
  }

  /**
   * The maximum amount of memory we will allocate to client IO buffers at a
   * time. Without this limit, the server will gladly allocate client buffers
   * right into an out of memory exception, rather than waiting.
   */
  final long MAX_READ_BUFFER_BYTES;

  /**
   * How many bytes are currently allocated to read buffers.
   */
  final AtomicLong readBufferBytesAllocated = new AtomicLong(0);

  public AbstractNonblockingServer(AbstractNonblockingServerArgs args) {
    super(args);
    MAX_READ_BUFFER_BYTES = args.maxReadBufferBytes;
  }

  /**
   * Begin accepting connections and processing invocations.
   */
  public void serve() {
    // start any IO threads
    if (!startThreads()) {
      return;
    }

    // start listening, or exit
    if (!startListening()) {
      return;
    }

    setServing(true);

    // this will block while we serve
    waitForShutdown();

    setServing(false);

    // do a little cleanup
    stopListening();
  }

  /**
   * Starts any threads required for serving.
   * 
   * @return true if everything went ok, false if threads could not be started.
   */
  protected abstract boolean startThreads();

  /**
   * A method that will block until when threads handling the serving have been
   * shut down.
   */
  protected abstract void waitForShutdown();

  /**
   * Have the server transport start accepting connections.
   * 
   * @return true if we started listening successfully, false if something went
   *         wrong.
   */
  protected boolean startListening() {
    try {
      serverTransport_.listen();
      return true;
    } catch (TTransportException ttx) {
      LOGGER.error("Failed to start listening on server socket!", ttx);
      return false;
    }
  }

  /**
   * Stop listening for connections.
   */
  protected void stopListening() {
    serverTransport_.close();
  }

  /**
   * Perform an invocation. This method could behave several different ways -
   * invoke immediately inline, queue for separate execution, etc.
   * 
   * @return true if invocation was successfully requested, which is not a
   *         guarantee that invocation has completed. False if the request
   *         failed.
   */
  protected abstract boolean requestInvoke(FrameBuffer frameBuffer);

  /**
   * An abstract thread that handles selecting on a set of transports and
   * {@link FrameBuffer FrameBuffers} associated with selected keys
   * corresponding to requests.
   */
  protected abstract class AbstractSelectThread extends Thread {
    protected final Selector selector;

    // List of FrameBuffers that want to change their selection interests.
    protected final Set<FrameBuffer> selectInterestChanges = new HashSet<FrameBuffer>();

    public AbstractSelectThread() throws IOException {
      this.selector = SelectorProvider.provider().openSelector();
    }

    /**
     * If the selector is blocked, wake it up.
     */
    public void wakeupSelector() {
      selector.wakeup();
    }

    /**
     * Add FrameBuffer to the list of select interest changes and wake up the
     * selector if it's blocked. When the select() call exits, it'll give the
     * FrameBuffer a chance to change its interests.
     */
    public void requestSelectInterestChange(FrameBuffer frameBuffer) {
      synchronized (selectInterestChanges) {
        selectInterestChanges.add(frameBuffer);
      }
      // wakeup the selector, if it's currently blocked.
      selector.wakeup();
    }

    /**
     * Check to see if there are any FrameBuffers that have switched their
     * interest type from read to write or vice versa.
     */
    protected void processInterestChanges() {
      synchronized (selectInterestChanges) {
        for (FrameBuffer fb : selectInterestChanges) {
          fb.changeSelectInterests();
        }
        selectInterestChanges.clear();
      }
    }

    /**
     * Do the work required to read from a readable client. If the frame is
     * fully read, then invoke the method call.
     */
    protected void handleRead(SelectionKey key) {
      FrameBuffer buffer = (FrameBuffer) key.attachment();
      if (!buffer.read()) {
        cleanupSelectionKey(key);
        return;
      }

      // if the buffer's frame read is complete, invoke the method.
      if (buffer.isFrameFullyRead()) {
        if (!requestInvoke(buffer)) {
          cleanupSelectionKey(key);
        }
      }
    }

    /**
     * Let a writable client get written, if there's data to be written.
     */
    protected void handleWrite(SelectionKey key) {
      FrameBuffer buffer = (FrameBuffer) key.attachment();
      if (!buffer.write()) {
        cleanupSelectionKey(key);
      }
    }

    /**
     * Do connection-close cleanup on a given SelectionKey.
     */
    protected void cleanupSelectionKey(SelectionKey key) {
      // remove the records from the two maps
      FrameBuffer buffer = (FrameBuffer) key.attachment();
      if (buffer != null) {
        // close the buffer
        buffer.close();
      }
      // cancel the selection key
      key.cancel();
    }
  } // SelectThread

  /**
   * Possible states for the FrameBuffer state machine.
   */
  private enum FrameBufferState {
    // in the midst of reading the frame size off the wire
    READING_FRAME_SIZE,
    // reading the actual frame data now, but not all the way done yet
    READING_FRAME,
    // completely read the frame, so an invocation can now happen
    READ_FRAME_COMPLETE,
    // waiting to get switched to listening for write events
    AWAITING_REGISTER_WRITE,
    // started writing response data, not fully complete yet
    WRITING,
    // another thread wants this framebuffer to go back to reading
    AWAITING_REGISTER_READ,
    // we want our transport and selection key invalidated in the selector
    // thread
    AWAITING_CLOSE
  }

  /**
   * Class that implements a sort of state machine around the interaction with a
   * client and an invoker. It manages reading the frame size and frame data,
   * getting it handed off as wrapped transports, and then the writing of
   * response data back to the client. In the process it manages flipping the
   * read and write bits on the selection key for its client.
   */
   public class FrameBuffer {
    private final Logger LOGGER = LoggerFactory.getLogger(getClass().getName());

    // the actual transport hooked up to the client.
    protected final TNonblockingTransport trans_;

    // the SelectionKey that corresponds to our transport
    protected final SelectionKey selectionKey_;

    // the SelectThread that owns the registration of our transport
    protected final AbstractSelectThread selectThread_;

    // where in the process of reading/writing are we?
    protected FrameBufferState state_ = FrameBufferState.READING_FRAME_SIZE;

    // the ByteBuffer we'll be using to write and read, depending on the state
    protected ByteBuffer buffer_;

    protected final TByteArrayOutputStream response_;
    
    // the frame that the TTransport should wrap.
    protected final TMemoryInputTransport frameTrans_;
    
    // the transport that should be used to connect to clients
    protected final TTransport inTrans_;
    
    protected final TTransport outTrans_;
    
    // the input protocol to use on frames
    protected final TProtocol inProt_;
    
    // the output protocol to use on frames
    protected final TProtocol outProt_;
    
    // context associated with this connection
    protected final ServerContext context_;

    public FrameBuffer(final TNonblockingTransport trans,
        final SelectionKey selectionKey,
        final AbstractSelectThread selectThread) {
      trans_ = trans;
      selectionKey_ = selectionKey;
      selectThread_ = selectThread;
      buffer_ = ByteBuffer.allocate(4);

      frameTrans_ = new TMemoryInputTransport();
      response_ = new TByteArrayOutputStream();
      inTrans_ = inputTransportFactory_.getTransport(frameTrans_);
      outTrans_ = outputTransportFactory_.getTransport(new TIOStreamTransport(response_));
      inProt_ = inputProtocolFactory_.getProtocol(inTrans_);
      outProt_ = outputProtocolFactory_.getProtocol(outTrans_);

      if (eventHandler_ != null) {
        context_ = eventHandler_.createContext(inProt_, outProt_);
      } else {
        context_  = null;
      }
    }

    /**
     * Give this FrameBuffer a chance to read. The selector loop should have
     * received a read event for this FrameBuffer.
     * 
     * @return true if the connection should live on, false if it should be
     *         closed
     */
    public boolean read() {
      if (state_ == FrameBufferState.READING_FRAME_SIZE) {
        // try to read the frame size completely
        if (!internalRead()) {
          return false;
        }

        // if the frame size has been read completely, then prepare to read the
        // actual frame.
        if (buffer_.remaining() == 0) {
          // pull out the frame size as an integer.
          int frameSize = buffer_.getInt(0);
          if (frameSize <= 0) {
            LOGGER.error("Read an invalid frame size of " + frameSize
                + ". Are you using TFramedTransport on the client side?");
            return false;
          }

          // if this frame will always be too large for this server, log the
          // error and close the connection.
          if (frameSize > MAX_READ_BUFFER_BYTES) {
            LOGGER.error("Read a frame size of " + frameSize
                + ", which is bigger than the maximum allowable buffer size for ALL connections.");
            return false;
          }

          // if this frame will push us over the memory limit, then return.
          // with luck, more memory will free up the next time around.
          if (readBufferBytesAllocated.get() + frameSize > MAX_READ_BUFFER_BYTES) {
            return true;
          }

          // increment the amount of memory allocated to read buffers
          readBufferBytesAllocated.addAndGet(frameSize + 4);

          // reallocate the readbuffer as a frame-sized buffer
          buffer_ = ByteBuffer.allocate(frameSize + 4);
          buffer_.putInt(frameSize);

          state_ = FrameBufferState.READING_FRAME;
        } else {
          // this skips the check of READING_FRAME state below, since we can't
          // possibly go on to that state if there's data left to be read at
          // this one.
          return true;
        }
      }

      // it is possible to fall through from the READING_FRAME_SIZE section
      // to READING_FRAME if there's already some frame data available once
      // READING_FRAME_SIZE is complete.

      if (state_ == FrameBufferState.READING_FRAME) {
        if (!internalRead()) {
          return false;
        }

        // since we're already in the select loop here for sure, we can just
        // modify our selection key directly.
        if (buffer_.remaining() == 0) {
          // get rid of the read select interests
          selectionKey_.interestOps(0);
          state_ = FrameBufferState.READ_FRAME_COMPLETE;
        }

        return true;
      }

      // if we fall through to this point, then the state must be invalid.
      LOGGER.error("Read was called but state is invalid (" + state_ + ")");
      return false;
    }

    /**
     * Give this FrameBuffer a chance to write its output to the final client.
     */
    public boolean write() {
      if (state_ == FrameBufferState.WRITING) {
        try {
          if (trans_.write(buffer_) < 0) {
            return false;
          }
        } catch (IOException e) {
          LOGGER.warn("Got an IOException during write!", e);
          return false;
        }

        // we're done writing. now we need to switch back to reading.
        if (buffer_.remaining() == 0) {
          prepareRead();
        }
        return true;
      }

      LOGGER.error("Write was called, but state is invalid (" + state_ + ")");
      return false;
    }

    /**
     * Give this FrameBuffer a chance to set its interest to write, once data
     * has come in.
     */
    public void changeSelectInterests() {
      if (state_ == FrameBufferState.AWAITING_REGISTER_WRITE) {
        // set the OP_WRITE interest
        selectionKey_.interestOps(SelectionKey.OP_WRITE);
        state_ = FrameBufferState.WRITING;
      } else if (state_ == FrameBufferState.AWAITING_REGISTER_READ) {
        prepareRead();
      } else if (state_ == FrameBufferState.AWAITING_CLOSE) {
        close();
        selectionKey_.cancel();
      } else {
        LOGGER.error("changeSelectInterest was called, but state is invalid (" + state_ + ")");
      }
    }

    /**
     * Shut the connection down.
     */
    public void close() {
      // if we're being closed due to an error, we might have allocated a
      // buffer that we need to subtract for our memory accounting.
      if (state_ == FrameBufferState.READING_FRAME || 
          state_ == FrameBufferState.READ_FRAME_COMPLETE ||
          state_ == FrameBufferState.AWAITING_CLOSE) {
        readBufferBytesAllocated.addAndGet(-buffer_.array().length);
      }
      trans_.close();
      if (eventHandler_ != null) {
        eventHandler_.deleteContext(context_, inProt_, outProt_);
      }
    }

    /**
     * Check if this FrameBuffer has a full frame read.
     */
    public boolean isFrameFullyRead() {
      return state_ == FrameBufferState.READ_FRAME_COMPLETE;
    }

    /**
     * After the processor has processed the invocation, whatever thread is
     * managing invocations should call this method on this FrameBuffer so we
     * know it's time to start trying to write again. Also, if it turns out that
     * there actually isn't any data in the response buffer, we'll skip trying
     * to write and instead go back to reading.
     */
    public void responseReady() {
      // the read buffer is definitely no longer in use, so we will decrement
      // our read buffer count. we do this here as well as in close because
      // we'd like to free this read memory up as quickly as possible for other
      // clients.
      readBufferBytesAllocated.addAndGet(-buffer_.array().length);

      if (response_.len() == 0) {
        // go straight to reading again. this was probably an oneway method
        state_ = FrameBufferState.AWAITING_REGISTER_READ;
        buffer_ = null;
      } else {
        buffer_ = ByteBuffer.wrap(response_.get(), 0, response_.len());

        // set state that we're waiting to be switched to write. we do this
        // asynchronously through requestSelectInterestChange() because there is
        // a possibility that we're not in the main thread, and thus currently
        // blocked in select(). (this functionality is in place for the sake of
        // the HsHa server.)
        state_ = FrameBufferState.AWAITING_REGISTER_WRITE;
      }
      requestSelectInterestChange();
    }

    /**
     * Actually invoke the method signified by this FrameBuffer.
     */
    public void invoke() {
      frameTrans_.reset(buffer_.array());
      response_.reset();
      
      try {
        if (eventHandler_ != null) {
          eventHandler_.processContext(context_, inTrans_, outTrans_);
        }
        processorFactory_.getProcessor(inTrans_).process(inProt_, outProt_);
        responseReady();
        return;
      } catch (TException te) {
        LOGGER.warn("Exception while invoking!", te);
      } catch (Throwable t) {
        LOGGER.error("Unexpected throwable while invoking!", t);
      }
      // This will only be reached when there is a throwable.
      state_ = FrameBufferState.AWAITING_CLOSE;
      requestSelectInterestChange();
    }

    /**
     * Perform a read into buffer.
     * 
     * @return true if the read succeeded, false if there was an error or the
     *         connection closed.
     */
    private boolean internalRead() {
      try {
        if (trans_.read(buffer_) < 0) {
          return false;
        }
        return true;
      } catch (IOException e) {
        LOGGER.warn("Got an IOException in internalRead!", e);
        return false;
      }
    }

    /**
     * We're done writing, so reset our interest ops and change state
     * accordingly.
     */
    private void prepareRead() {
      // we can set our interest directly without using the queue because
      // we're in the select thread.
      selectionKey_.interestOps(SelectionKey.OP_READ);
      // get ready for another go-around
      buffer_ = ByteBuffer.allocate(4);
      state_ = FrameBufferState.READING_FRAME_SIZE;
    }

    /**
     * When this FrameBuffer needs to change its select interests and execution
     * might not be in its select thread, then this method will make sure the
     * interest change gets done when the select thread wakes back up. When the
     * current thread is this FrameBuffer's select thread, then it just does the
     * interest change immediately.
     */
    protected void requestSelectInterestChange() {
      if (Thread.currentThread() == this.selectThread_) {
        changeSelectInterests();
      } else {
        this.selectThread_.requestSelectInterestChange(this);
      }
    }
  } // FrameBuffer

  public class AsyncFrameBuffer extends FrameBuffer {
    public AsyncFrameBuffer(TNonblockingTransport trans, SelectionKey selectionKey, AbstractSelectThread selectThread) {
      super(trans, selectionKey, selectThread);
    }

    public TProtocol getInputProtocol() {
      return  inProt_;
    }

    public TProtocol getOutputProtocol() {
      return outProt_;
    }


    public void invoke() {
      frameTrans_.reset(buffer_.array());
      response_.reset();

      try {
        if (eventHandler_ != null) {
          eventHandler_.processContext(context_, inTrans_, outTrans_);
        }
        ((TAsyncProcessor)processorFactory_.getProcessor(inTrans_)).process(this);
        return;
      } catch (TException te) {
        LOGGER.warn("Exception while invoking!", te);
      } catch (Throwable t) {
        LOGGER.error("Unexpected throwable while invoking!", t);
      }
      // This will only be reached when there is a throwable.
      state_ = FrameBufferState.AWAITING_CLOSE;
      requestSelectInterestChange();
    }
  }
}
