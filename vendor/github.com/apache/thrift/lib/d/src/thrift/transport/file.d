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

/**
 * Transports for reading from/writing to Thrift »log files«.
 *
 * These transports are not »stupid« sources and sinks just reading and
 * writing bytes from a file verbatim, but organize the contents in the form
 * of so-called »events«, which refers to the data written between two flush()
 * calls.
 *
 * Chunking is supported, events are guaranteed to never span chunk boundaries.
 * As a consequence, an event can never be larger than the chunk size. The
 * chunk size used is not saved with the file, so care has to be taken to make
 * sure the same chunk size is used for reading and writing.
 */
module thrift.transport.file;

import core.thread : Thread;
import std.array : empty;
import std.algorithm : min, max;
import std.concurrency;
import std.conv : to;
import std.datetime : AutoStart, dur, Duration, StopWatch;
import std.exception;
import std.stdio : File;
import thrift.base;
import thrift.transport.base;

/// The default chunk size, in bytes.
enum DEFAULT_CHUNK_SIZE = 16 * 1024 * 1024;

/// The type used to represent event sizes in the file.
alias uint EventSize;

version (BigEndian) {
  static assert(false,
    "Little endian byte order is assumed in thrift.transport.file.");
}

/**
 * A transport used to read log files. It can never be written to, calling
 * write() throws.
 *
 * Contrary to the C++ design, explicitly opening the transport/file before
 * using is necessary to allow manually closing the file without relying on the
 * object lifetime. Otherwise, it's a straight port of the C++ implementation.
 */
final class TFileReaderTransport : TBaseTransport {
  /**
   * Creates a new file writer transport.
   *
   * Params:
   *   path = Path of the file to opperate on.
   */
  this(string path) {
    path_ = path;
    chunkSize_ = DEFAULT_CHUNK_SIZE;
    readBufferSize_ = DEFAULT_READ_BUFFER_SIZE;
    readTimeout_ = DEFAULT_READ_TIMEOUT;
    corruptedEventSleepDuration_ = DEFAULT_CORRUPTED_EVENT_SLEEP_DURATION;
    maxEventSize = DEFAULT_MAX_EVENT_SIZE;
  }

  override bool isOpen() @property {
    return isOpen_;
  }

  override bool peek() {
    if (!isOpen) return false;

    // If there is no event currently processed, try fetching one from the
    // file.
    if (!currentEvent_) {
      currentEvent_ = readEvent();

      if (!currentEvent_) {
        // Still nothing there, couldn't read a new event.
        return false;
      }
    }
    // check if there is anything to read
    return (currentEvent_.length - currentEventPos_) > 0;
  }

  override void open() {
    if (isOpen) return;
    try {
      file_ = File(path_, "rb");
    } catch (Exception e) {
      throw new TTransportException("Error on opening input file.",
        TTransportException.Type.NOT_OPEN, __FILE__, __LINE__, e);
    }
    isOpen_ = true;
  }

  override void close() {
    if (!isOpen) return;

    file_.close();
    isOpen_ = false;
    readState_.resetAllValues();
  }

  override size_t read(ubyte[] buf) {
    enforce(isOpen, new TTransportException(
      "Cannot read if file is not open.", TTransportException.Type.NOT_OPEN));

    // If there is no event currently processed, try fetching one from the
    // file.
    if (!currentEvent_) {
      currentEvent_ = readEvent();

      if (!currentEvent_) {
        // Still nothing there, couldn't read a new event.
        return 0;
      }
    }

    auto len = buf.length;
    auto remaining = currentEvent_.length - currentEventPos_;

    if (remaining <= len) {
      // If less than the requested length is available, read as much as
      // possible.
      buf[0 .. remaining] = currentEvent_[currentEventPos_ .. $];
      currentEvent_ = null;
      currentEventPos_ = 0;
      return remaining;
    }

    // There will still be data left in the buffer after reading, pass out len
    // bytes.
    buf[] = currentEvent_[currentEventPos_ .. currentEventPos_ + len];
    currentEventPos_ += len;
    return len;
  }

  ulong getNumChunks() {
    enforce(isOpen, new TTransportException(
      "Cannot get number of chunks if file not open.",
      TTransportException.Type.NOT_OPEN));

    try {
      auto fileSize = file_.size();
      if (fileSize == 0) {
        // Empty files have no chunks.
        return 0;
      }
      return ((fileSize)/chunkSize_) + 1;
    } catch (Exception e) {
      throw new TTransportException("Error getting file size.", __FILE__,
        __LINE__, e);
    }
  }

  ulong getCurChunk() {
    return offset_ / chunkSize_;
  }

  void seekToChunk(long chunk) {
    enforce(isOpen, new TTransportException(
      "Cannot get number of chunks if file not open.",
      TTransportException.Type.NOT_OPEN));

    auto numChunks = getNumChunks();

    if (chunk < 0) {
      // Count negative indices from the end.
      chunk += numChunks;
    }

    if (chunk < 0) {
      logError("Incorrect chunk number for reverse seek, seeking to " ~
       "beginning instead: %s", chunk);
      chunk = 0;
    }

    bool seekToEnd;
    long minEndOffset;
    if (chunk >= numChunks) {
      logError("Trying to seek to non-existing chunk, seeking to " ~
       "end of file instead: %s", chunk);
      seekToEnd = true;
      chunk = numChunks - 1;
      // this is the min offset to process events till
      minEndOffset = file_.size();
    }

    readState_.resetAllValues();
    currentEvent_ = null;

    try {
      file_.seek(chunk * chunkSize_);
      offset_ = chunk * chunkSize_;
    } catch (Exception e) {
      throw new TTransportException("Error seeking to chunk", __FILE__,
        __LINE__, e);
    }

    if (seekToEnd) {
      // Never wait on the end of the file for new content, we just want to
      // find the last one.
      auto oldReadTimeout = readTimeout_;
      scope (exit) readTimeout_ = oldReadTimeout;
      readTimeout_ = dur!"hnsecs"(0);

      // Keep on reading unti the last event at point of seekToChunk call.
      while ((offset_ + readState_.bufferPos_) < minEndOffset) {
        if (readEvent() is null) {
          break;
        }
      }
    }
  }

  void seekToEnd() {
    seekToChunk(getNumChunks());
  }

  /**
   * The size of the chunks the file is divided into, in bytes.
   */
  ulong chunkSize() @property const {
    return chunkSize_;
  }

  /// ditto
  void chunkSize(ulong value) @property {
    enforce(!isOpen, new TTransportException(
      "Cannot set chunk size after TFileReaderTransport has been opened."));
    enforce(value > EventSize.sizeof, new TTransportException("Chunks must " ~
      "be large enough to accommodate at least a single byte of payload data."));
    chunkSize_ = value;
  }

  /**
   * If positive, wait the specified duration for new data when arriving at
   * end of file. If negative, wait forever (tailing mode), waking up to check
   * in the specified interval. If zero, do not wait at all.
   *
   * Defaults to 500 ms.
   */
  Duration readTimeout() @property const {
    return readTimeout_;
  }

  /// ditto
  void readTimeout(Duration value) @property {
    readTimeout_ = value;
  }

  /// ditto
  enum DEFAULT_READ_TIMEOUT = dur!"msecs"(500);

  /**
   * Read buffer size, in bytes.
   *
   * Defaults to 1 MiB.
   */
  size_t readBufferSize() @property const {
    return readBufferSize_;
  }

  /// ditto
  void readBufferSize(size_t value) @property {
    if (readBuffer_) {
      enforce(value <= readBufferSize_,
        "Cannot shrink read buffer after first read.");
      readBuffer_.length = value;
    }
    readBufferSize_ = value;
  }

  /// ditto
  enum DEFAULT_READ_BUFFER_SIZE = 1 * 1024 * 1024;

  /**
   * Arbitrary event size limit, in bytes. Must be smaller than chunk size.
   *
   * Defaults to zero (no limit).
   */
  size_t maxEventSize() @property const {
    return maxEventSize_;
  }

  /// ditto
  void maxEventSize(size_t value) @property {
    enforce(value <= chunkSize_ - EventSize.sizeof, "Events cannot span " ~
      "mutiple chunks, maxEventSize must be smaller than chunk size.");
    maxEventSize_ = value;
  }

  /// ditto
  enum DEFAULT_MAX_EVENT_SIZE = 0;

  /**
   * The interval at which the thread wakes up to check for the next chunk
   * in tailing mode.
   *
   * Defaults to one second.
   */
  Duration corruptedEventSleepDuration() const {
    return corruptedEventSleepDuration_;
  }

  /// ditto
  void corruptedEventSleepDuration(Duration value) {
    corruptedEventSleepDuration_ = value;
  }

  /// ditto
  enum DEFAULT_CORRUPTED_EVENT_SLEEP_DURATION = dur!"seconds"(1);

  /**
   * The maximum number of corrupted events tolerated before the whole chunk
   * is skipped.
   *
   * Defaults to zero.
   */
  uint maxCorruptedEvents() @property const {
    return maxCorruptedEvents_;
  }

  /// ditto
  void maxCorruptedEvents(uint value) @property {
    maxCorruptedEvents_ = value;
  }

  /// ditto
  enum DEFAULT_MAX_CORRUPTED_EVENTS = 0;

private:
  ubyte[] readEvent() {
    if (!readBuffer_) {
      readBuffer_ = new ubyte[readBufferSize_];
    }

    bool timeoutExpired;
    while (1) {
      // read from the file if read buffer is exhausted
      if (readState_.bufferPos_ == readState_.bufferLen_) {
        // advance the offset pointer
        offset_ += readState_.bufferLen_;

        try {
          // Need to clear eof flag before reading, otherwise tailing a file
          // does not work.
          file_.clearerr();

          auto usedBuf = file_.rawRead(readBuffer_);
          readState_.bufferLen_ = usedBuf.length;
        } catch (Exception e) {
          readState_.resetAllValues();
          throw new TTransportException("Error while reading from file",
            __FILE__, __LINE__, e);
        }

        readState_.bufferPos_ = 0;
        readState_.lastDispatchPos_ = 0;

        if (readState_.bufferLen_ == 0) {
          // Reached end of file.
          if (readTimeout_ < dur!"hnsecs"(0)) {
            // Tailing mode, sleep for the specified duration and try again.
            Thread.sleep(-readTimeout_);
            continue;
          } else if (readTimeout_ == dur!"hnsecs"(0) || timeoutExpired) {
            // Either no timeout set, or it has already expired.
            readState_.resetState(0);
            return null;
          } else {
            // Timeout mode, sleep for the specified amount of time and retry.
            Thread.sleep(readTimeout_);
            timeoutExpired = true;
            continue;
          }
        }
      }

      // Attempt to read an event from the buffer.
      while (readState_.bufferPos_ < readState_.bufferLen_) {
        if (readState_.readingSize_) {
          if (readState_.eventSizeBuffPos_ == 0) {
            if ((offset_ + readState_.bufferPos_)/chunkSize_ !=
              ((offset_ + readState_.bufferPos_ + 3)/chunkSize_))
            {
              readState_.bufferPos_++;
              continue;
            }
          }

          readState_.eventSizeBuff_[readState_.eventSizeBuffPos_++] =
            readBuffer_[readState_.bufferPos_++];

          if (readState_.eventSizeBuffPos_ == 4) {
            auto size = (cast(uint[])readState_.eventSizeBuff_)[0];

            if (size == 0) {
              // This is part of the zero padding between chunks.
              readState_.resetState(readState_.lastDispatchPos_);
              continue;
            }

            // got a valid event
            readState_.readingSize_ = false;
            readState_.eventLen_ = size;
            readState_.eventPos_ = 0;

            // check if the event is corrupted and perform recovery if required
            if (isEventCorrupted()) {
              performRecovery();
              // start from the top
              break;
            }
          }
        } else {
          if (!readState_.event_) {
            readState_.event_ = new ubyte[readState_.eventLen_];
          }

          // take either the entire event or the remaining bytes in the buffer
          auto reclaimBuffer = min(readState_.bufferLen_ - readState_.bufferPos_,
            readState_.eventLen_ - readState_.eventPos_);

          // copy data from read buffer into event buffer
          readState_.event_[
            readState_.eventPos_ .. readState_.eventPos_ + reclaimBuffer
          ] = readBuffer_[
            readState_.bufferPos_ .. readState_.bufferPos_ + reclaimBuffer
          ];

          // increment position ptrs
          readState_.eventPos_ += reclaimBuffer;
          readState_.bufferPos_ += reclaimBuffer;

          // check if the event has been read in full
          if (readState_.eventPos_ == readState_.eventLen_) {
            // Reset the read state and return the completed event.
            auto completeEvent = readState_.event_;
            readState_.event_ = null;
            readState_.resetState(readState_.bufferPos_);
            return completeEvent;
          }
        }
      }
    }
  }

  bool isEventCorrupted() {
    if ((maxEventSize_ > 0) && (readState_.eventLen_ > maxEventSize_)) {
      // Event size is larger than user-speficied max-event size
      logError("Corrupt event read: Event size (%s) greater than max " ~
        "event size (%s)", readState_.eventLen_, maxEventSize_);
      return true;
    } else if (readState_.eventLen_ > chunkSize_) {
      // Event size is larger than chunk size
      logError("Corrupt event read: Event size (%s) greater than chunk " ~
        "size (%s)", readState_.eventLen_, chunkSize_);
      return true;
    } else if (((offset_ + readState_.bufferPos_ - EventSize.sizeof) / chunkSize_) !=
      ((offset_ + readState_.bufferPos_ + readState_.eventLen_ - EventSize.sizeof) / chunkSize_))
    {
      // Size indicates that event crosses chunk boundary
      logError("Read corrupt event. Event crosses chunk boundary. " ~
        "Event size: %s. Offset: %s", readState_.eventLen_,
        (offset_ + readState_.bufferPos_ + EventSize.sizeof)
      );

      return true;
    }

    return false;
  }

  void performRecovery() {
    // perform some kickass recovery
    auto curChunk = getCurChunk();
    if (lastBadChunk_ == curChunk) {
      numCorruptedEventsInChunk_++;
    } else {
      lastBadChunk_ = curChunk;
      numCorruptedEventsInChunk_ = 1;
    }

    if (numCorruptedEventsInChunk_ < maxCorruptedEvents_) {
      // maybe there was an error in reading the file from disk
      // seek to the beginning of chunk and try again
      seekToChunk(curChunk);
    } else {
      // Just skip ahead to the next chunk if we not already at the last chunk.
      if (curChunk != (getNumChunks() - 1)) {
        seekToChunk(curChunk + 1);
      } else if (readTimeout_ < dur!"hnsecs"(0)) {
        // We are in tailing mode, wait until there is enough data to start
        // the next chunk.
        while(curChunk == (getNumChunks() - 1)) {
          Thread.sleep(corruptedEventSleepDuration_);
        }
        seekToChunk(curChunk + 1);
      } else {
        // Pretty hosed at this stage, rewind the file back to the last
        // successful point and punt on the error.
        readState_.resetState(readState_.lastDispatchPos_);
        currentEvent_ = null;
        currentEventPos_ = 0;

        throw new TTransportException("File corrupted at offset: " ~
          to!string(offset_ + readState_.lastDispatchPos_),
          TTransportException.Type.CORRUPTED_DATA);
      }
    }
  }

  string path_;
  File file_;
  bool isOpen_;
  long offset_;
  ubyte[] currentEvent_;
  size_t currentEventPos_;
  ulong chunkSize_;
  Duration readTimeout_;
  size_t maxEventSize_;

  // Read buffer – lazily allocated on the first read().
  ubyte[] readBuffer_;
  size_t readBufferSize_;

  static struct ReadState {
    ubyte[] event_;
    size_t eventLen_;
    size_t eventPos_;

    // keep track of event size
    ubyte[4] eventSizeBuff_;
    ubyte eventSizeBuffPos_;
    bool readingSize_ = true;

    // read buffer variables
    size_t bufferPos_;
    size_t bufferLen_;

    // last successful dispatch point
    size_t lastDispatchPos_;

    void resetState(size_t lastDispatchPos) {
      readingSize_ = true;
      eventSizeBuffPos_ = 0;
      lastDispatchPos_ = lastDispatchPos;
    }

    void resetAllValues() {
      resetState(0);
      bufferPos_ = 0;
      bufferLen_ = 0;
      event_ = null;
    }
  }
  ReadState readState_;

  ulong lastBadChunk_;
  uint maxCorruptedEvents_;
  uint numCorruptedEventsInChunk_;
  Duration corruptedEventSleepDuration_;
}

/**
 * A transport used to write log files. It can never be read from, calling
 * read() throws.
 *
 * Contrary to the C++ design, explicitly opening the transport/file before
 * using is necessary to allow manually closing the file without relying on the
 * object lifetime.
 */
final class TFileWriterTransport : TBaseTransport {
  /**
   * Creates a new file writer transport.
   *
   * Params:
   *   path = Path of the file to opperate on.
   */
  this(string path) {
    path_ = path;

    chunkSize_ = DEFAULT_CHUNK_SIZE;
    eventBufferSize_ = DEFAULT_EVENT_BUFFER_SIZE;
    ioErrorSleepDuration = DEFAULT_IO_ERROR_SLEEP_DURATION;
    maxFlushBytes_ = DEFAULT_MAX_FLUSH_BYTES;
    maxFlushInterval_ = DEFAULT_MAX_FLUSH_INTERVAL;
  }

  override bool isOpen() @property {
    return isOpen_;
  }

  /**
   * A file writer transport can never be read from.
   */
  override bool peek() {
    return false;
  }

  override void open() {
    if (isOpen) return;

    writerThread_ = spawn(
      &writerThread,
      path_,
      chunkSize_,
      maxFlushBytes_,
      maxFlushInterval_,
      ioErrorSleepDuration_
    );
    setMaxMailboxSize(writerThread_, eventBufferSize_, OnCrowding.block);
    isOpen_ = true;
  }

  /**
   * Closes the transport, i.e. the underlying file and the writer thread.
   */
  override void close() {
    if (!isOpen) return;

    prioritySend(writerThread_, ShutdownMessage(), thisTid); // FIXME: Should use normal send here.
    receive((ShutdownMessage msg, Tid tid){});
    isOpen_ = false;
  }

  /**
   * Enqueues the passed slice of data for writing and immediately returns.
   * write() only blocks if the event buffer has been exhausted.
   *
   * The transport must be open when calling this.
   *
   * Params:
   *   buf = Slice of data to write.
   */
  override void write(in ubyte[] buf) {
    enforce(isOpen, new TTransportException(
      "Cannot write to non-open file.", TTransportException.Type.NOT_OPEN));

    if (buf.empty) {
      logError("Cannot write empty event, skipping.");
      return;
    }

    auto maxSize = chunkSize - EventSize.sizeof;
    enforce(buf.length <= maxSize, new TTransportException(
      "Cannot write more than " ~ to!string(maxSize) ~
      "bytes at once due to chunk size."));

    send(writerThread_, buf.idup);
  }

  /**
   * Flushes any pending data to be written.
   *
   * The transport must be open when calling this.
   *
   * Throws: TTransportException if an error occurs.
   */
  override void flush() {
    enforce(isOpen, new TTransportException(
      "Cannot flush file if not open.", TTransportException.Type.NOT_OPEN));

    send(writerThread_, FlushMessage(), thisTid);
    receive((FlushMessage msg, Tid tid){});
  }

  /**
   * The size of the chunks the file is divided into, in bytes.
   *
   * A single event (write call) never spans multiple chunks – this
   * effectively limits the event size to chunkSize - EventSize.sizeof.
   */
  ulong chunkSize() @property {
    return chunkSize_;
  }

  /// ditto
  void chunkSize(ulong value) @property {
    enforce(!isOpen, new TTransportException(
      "Cannot set chunk size after TFileWriterTransport has been opened."));
    chunkSize_ = value;
  }

  /**
   * The maximum number of write() calls buffered, or zero for no limit.
   *
   * If the buffer is exhausted, write() will block until space becomes
   * available.
   */
  size_t eventBufferSize() @property {
    return eventBufferSize_;
  }

  /// ditto
  void eventBufferSize(size_t value) @property {
    eventBufferSize_ = value;
    if (isOpen) {
      setMaxMailboxSize(writerThread_, value, OnCrowding.throwException);
    }
  }

  /// ditto
  enum DEFAULT_EVENT_BUFFER_SIZE = 10_000;

  /**
   * Maximum number of bytes buffered before writing and flushing the file
   * to disk.
   *
   * Currently cannot be set after the first call to write().
   */
  size_t maxFlushBytes() @property {
    return maxFlushBytes_;
  }

  /// ditto
  void maxFlushBytes(size_t value) @property {
    maxFlushBytes_ = value;
    if (isOpen) {
      send(writerThread_, FlushBytesMessage(value));
    }
  }

  /// ditto
  enum DEFAULT_MAX_FLUSH_BYTES = 1000 * 1024;

  /**
   * Maximum interval between flushing the file to disk.
   *
   * Currenlty cannot be set after the first call to write().
   */
  Duration maxFlushInterval() @property {
    return maxFlushInterval_;
  }

  /// ditto
  void maxFlushInterval(Duration value) @property {
    maxFlushInterval_ = value;
    if (isOpen) {
      send(writerThread_, FlushIntervalMessage(value));
    }
  }

  /// ditto
  enum DEFAULT_MAX_FLUSH_INTERVAL = dur!"seconds"(3);

  /**
   * When the writer thread encounteres an I/O error, it goes pauses for a
   * short time before trying to reopen the output file. This controls the
   * sleep duration.
   */
  Duration ioErrorSleepDuration() @property {
    return ioErrorSleepDuration_;
  }

  /// ditto
  void ioErrorSleepDuration(Duration value) @property {
    ioErrorSleepDuration_ = value;
    if (isOpen) {
      send(writerThread_, FlushIntervalMessage(value));
    }
  }

  /// ditto
  enum DEFAULT_IO_ERROR_SLEEP_DURATION = dur!"msecs"(500);

private:
  string path_;
  ulong chunkSize_;
  size_t eventBufferSize_;
  Duration ioErrorSleepDuration_;
  size_t maxFlushBytes_;
  Duration maxFlushInterval_;
  bool isOpen_;
  Tid writerThread_;
}

private {
  // Signals that the file should be flushed on disk. Sent to the writer
  // thread and sent back along with the tid for confirmation.
  struct FlushMessage {}

  // Signals that the writer thread should close the file and shut down. Sent
  // to the writer thread and sent back along with the tid for confirmation.
  struct ShutdownMessage {}

  struct FlushBytesMessage {
    size_t value;
  }

  struct FlushIntervalMessage {
    Duration value;
  }

  struct IoErrorSleepDurationMessage {
    Duration value;
  }

  void writerThread(
    string path,
    ulong chunkSize,
    size_t maxFlushBytes,
    Duration maxFlushInterval,
    Duration ioErrorSleepDuration
  ) {
    bool errorOpening;
    File file;
    ulong offset;
    try {
      // Open file in appending and binary mode.
      file = File(path, "ab");
      offset = file.tell();
    } catch (Exception e) {
      logError("Error on opening output file in writer thread: %s", e);
      errorOpening = true;
    }

    auto flushTimer = StopWatch(AutoStart.yes);
    size_t unflushedByteCount;

    Tid shutdownRequestTid;
    bool shutdownRequested;
    while (true) {
      if (shutdownRequested) break;

      bool forceFlush;
      Tid flushRequestTid;
      receiveTimeout(max(dur!"hnsecs"(0), maxFlushInterval - flushTimer.peek()),
        (immutable(ubyte)[] data) {
          while (errorOpening) {
            logError("Writer thread going to sleep for %s µs due to IO errors",
              ioErrorSleepDuration.total!"usecs");

            // Sleep for ioErrorSleepDuration, being ready to be interrupted
            // by shutdown requests.
            auto timedOut = receiveTimeout(ioErrorSleepDuration,
              (ShutdownMessage msg, Tid tid){ shutdownRequestTid = tid; });
            if (!timedOut) {
              // We got a shutdown request, just drop all events and exit the
              // main loop as to not block application shutdown with our tries
              // which we must assume to fail.
              break;
            }

            try {
              file = File(path, "ab");
              unflushedByteCount = 0;
              errorOpening = false;
              logError("Output file %s reopened during writer thread error " ~
                "recovery", path);
            } catch (Exception e) {
              logError("Unable to reopen output file %s during writer " ~
                "thread error recovery", path);
            }
          }

          // Make sure the event does not cross the chunk boundary by writing
          // a padding consisting of zeroes if it would.
          auto chunk1 = offset / chunkSize;
          auto chunk2 = (offset + EventSize.sizeof + data.length - 1) / chunkSize;

          if (chunk1 != chunk2) {
            // TODO: The C++ implementation refetches the offset here to »keep
            // in sync« – why would this be needed?
            auto padding = cast(size_t)
              ((((offset / chunkSize) + 1) * chunkSize) - offset);
            auto zeroes = new ubyte[padding];
            file.rawWrite(zeroes);
            unflushedByteCount += padding;
            offset += padding;
          }

          // TODO: 2 syscalls here, is this a problem performance-wise?
          // Probably abysmal performance on Windows due to rawWrite
          // implementation.
          uint len = cast(uint)data.length;
          file.rawWrite(cast(ubyte[])(&len)[0..1]);
          file.rawWrite(data);

          auto bytesWritten = EventSize.sizeof + data.length;
          unflushedByteCount += bytesWritten;
          offset += bytesWritten;
        }, (FlushBytesMessage msg) {
          maxFlushBytes = msg.value;
        }, (FlushIntervalMessage msg) {
          maxFlushInterval = msg.value;
        }, (IoErrorSleepDurationMessage msg) {
          ioErrorSleepDuration = msg.value;
        }, (FlushMessage msg, Tid tid) {
          forceFlush = true;
          flushRequestTid = tid;
        }, (OwnerTerminated msg) {
          shutdownRequested = true;
        }, (ShutdownMessage msg, Tid tid) {
          shutdownRequested = true;
          shutdownRequestTid = tid;
        }
      );

      if (errorOpening) continue;

      bool flush;
      if (forceFlush || shutdownRequested || unflushedByteCount > maxFlushBytes) {
        flush = true;
      } else if (cast(Duration)flushTimer.peek() > maxFlushInterval) {
        if (unflushedByteCount == 0) {
          // If the flush timer is due, but no data has been written, don't
          // needlessly fsync, but do reset the timer.
          flushTimer.reset();
        } else {
          flush = true;
        }
      }

      if (flush) {
        file.flush();
        flushTimer.reset();
        unflushedByteCount = 0;
        if (forceFlush) send(flushRequestTid, FlushMessage(), thisTid);
      }
    }

    file.close();

    if (shutdownRequestTid != Tid.init) {
      send(shutdownRequestTid, ShutdownMessage(), thisTid);
    }
  }
}

version (unittest) {
  import core.memory : GC;
  import std.file;
}

unittest {
  void tryRemove(string fileName) {
    try {
      remove(fileName);
    } catch (Exception) {}
  }

  immutable fileName = "unittest.dat.tmp";
  enforce(!exists(fileName), "Unit test output file " ~ fileName ~
    " already exists.");

  /*
   * Check the most basic reading/writing operations.
   */
  {
    scope (exit) tryRemove(fileName);

    auto writer = new TFileWriterTransport(fileName);
    writer.open();
    scope (exit) writer.close();

    writer.write([1, 2]);
    writer.write([3, 4]);
    writer.write([5, 6, 7]);
    writer.flush();

    auto reader = new TFileReaderTransport(fileName);
    reader.open();
    scope (exit) reader.close();

    auto buf = new ubyte[7];
    reader.readAll(buf);
    enforce(buf == [1, 2, 3, 4, 5, 6, 7]);
  }

  /*
   * Check that chunking works as expected.
   */
  {
    scope (exit) tryRemove(fileName);

    static assert(EventSize.sizeof == 4);
    enum CHUNK_SIZE = 10;

    // Write some contents to the file.
    {
      auto writer = new TFileWriterTransport(fileName);
      writer.chunkSize = CHUNK_SIZE;
      writer.open();
      scope (exit) writer.close();

      writer.write([0xde]);
      writer.write([0xad]);
      // Chunk boundary here.
      writer.write([0xbe]);
      // The next write doesn't fit in the five bytes remaining, so we expect
      // padding zero bytes to be written.
      writer.write([0xef, 0x12]);

      try {
        writer.write(new ubyte[CHUNK_SIZE]);
        enforce(false, "Could write event not fitting in a single chunk.");
      } catch (TTransportException e) {}

      writer.flush();
    }

    // Check the raw contents of the file to see if chunk padding was written
    // as expected.
    auto file = File(fileName, "r");
    enforce(file.size == 26);
    auto written = new ubyte[26];
    file.rawRead(written);
    enforce(written == [
      1, 0, 0, 0, 0xde,
      1, 0, 0, 0, 0xad,
      1, 0, 0, 0, 0xbe,
      0, 0, 0, 0, 0,
      2, 0, 0, 0, 0xef, 0x12
    ]);

    // Read the data back in, getting all the events at once.
    {
      auto reader = new TFileReaderTransport(fileName);
      reader.chunkSize = CHUNK_SIZE;
      reader.open();
      scope (exit) reader.close();

      auto buf = new ubyte[5];
      reader.readAll(buf);
      enforce(buf == [0xde, 0xad, 0xbe, 0xef, 0x12]);
    }
  }

  /*
   * Make sure that close() exits "quickly", i.e. that there is no problem
   * with the worker thread waking up.
   */
  {
    import std.conv : text;
    enum NUM_ITERATIONS = 1000;

    uint numOver = 0;
    foreach (n; 0 .. NUM_ITERATIONS) {
      scope (exit) tryRemove(fileName);

      auto transport = new TFileWriterTransport(fileName);
      transport.open();

      // Write something so that the writer thread gets started.
      transport.write(cast(ubyte[])"foo");

      // Every other iteration, also call flush(), just in case that potentially
      // has any effect on how the writer thread wakes up.
      if (n & 0x1) {
        transport.flush();
      }

      // Time the call to close().
      auto sw = StopWatch(AutoStart.yes);
      transport.close();
      sw.stop();

      // If any attempt takes more than 500ms, treat that as a fatal failure to
      // avoid looping over a potentially very slow operation.
      enforce(sw.peek().msecs < 1500,
        text("close() took ", sw.peek().msecs, "ms."));

      // Normally, it takes less than 5ms on my dev box.
      // However, if the box is heavily loaded, some of the test runs can take
      // longer. Additionally, on a Windows Server 2008 instance running in
      // a VirtualBox VM, it has been observed that about a quarter of the runs
      // takes (217 ± 1) ms, for reasons not yet known.
      if (sw.peek().msecs > 50) {
        ++numOver;
      }

      // Force garbage collection runs every now and then to make sure we
      // don't run out of OS thread handles.
      if (!(n % 100)) GC.collect();
    }

    // Make sure fewer than a third of the runs took longer than 5ms.
    enforce(numOver < NUM_ITERATIONS / 3,
      text(numOver, " iterations took more than 10 ms."));
  }
}
