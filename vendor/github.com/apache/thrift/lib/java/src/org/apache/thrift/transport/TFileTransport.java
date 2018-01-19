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

package org.apache.thrift.transport;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.IOException;
import java.util.Random;

/**
 * FileTransport implementation of the TTransport interface.
 * Currently this is a straightforward port of the cpp implementation
 * 
 * It may make better sense to provide a basic stream access on top of the framed file format
 * The FileTransport can then be a user of this framed file format with some additional logic
 * for chunking.
 */
public class TFileTransport extends TTransport {

  public static class TruncableBufferedInputStream extends BufferedInputStream {
    public void trunc() {
      pos = count = 0;
    }        
    public TruncableBufferedInputStream(InputStream in) {
      super(in);
    }
    public TruncableBufferedInputStream(InputStream in, int size) {
      super(in, size);
    }
  }


  public static class Event {
    private byte[] buf_;
    private int nread_;
    private int navailable_;

    /**
     * Initialize an event. Initially, it has no valid contents
     *
     * @param buf byte array buffer to store event 
     */
    public Event(byte[] buf) {
      buf_ = buf;
      nread_ = navailable_ = 0;
    }

    public byte[] getBuf() { return buf_;}
    public int getSize() { return buf_.length; }


    public void setAvailable(int sz) { nread_ = 0; navailable_=sz;}
    public int getRemaining() { return (navailable_ - nread_); }

    public int emit(byte[] buf, int offset, int ndesired) {
      if((ndesired == 0) || (ndesired > getRemaining()))
        ndesired = getRemaining();

      if(ndesired <= 0)
        return (ndesired);

      System.arraycopy(buf_, nread_, buf, offset, ndesired);
      nread_ += ndesired;

      return(ndesired);
    }
  };

  public static class ChunkState {
    /**
     * Chunk Size. Must be same across all implementations
     */
    public static final int DEFAULT_CHUNK_SIZE = 16 * 1024 * 1024;

    private int chunk_size_ = DEFAULT_CHUNK_SIZE;
    private long offset_ = 0;

    public ChunkState() {}
    public ChunkState(int chunk_size) { chunk_size_ = chunk_size; }

    public void skip(int size) {offset_ += size; }
    public void seek(long offset) {offset_ = offset;}

    public int getChunkSize() { return chunk_size_;}
    public int getChunkNum() { return ((int)(offset_/chunk_size_));}
    public int getRemaining() { return (chunk_size_ - ((int)(offset_ % chunk_size_)));}
    public long getOffset() { return (offset_);}
  }

  public static enum TailPolicy {

    NOWAIT(0, 0),
      WAIT_FOREVER(500, -1);

    /**
     * Time in milliseconds to sleep before next read
     * If 0, no sleep
     */
    public final int timeout_;

    /**
     * Number of retries before giving up
     * if 0, no retries
     * if -1, retry forever
     */
    public final int retries_;

    /**
     * ctor for policy
     *
     * @param timeout sleep time for this particular policy
     * @param retries number of retries
     */

    TailPolicy(int timeout, int retries) {
      timeout_ = timeout;
      retries_ = retries;
    }
  }

  /**
   * Current tailing policy
   */
  TailPolicy currentPolicy_ = TailPolicy.NOWAIT;


  /** 
   * Underlying file being read
   */
  protected TSeekableFile inputFile_ = null;

  /** 
   * Underlying outputStream 
   */
  protected OutputStream outputStream_ = null;


  /**
   * Event currently read in
   */
  Event currentEvent_ = null;

  /**
   * InputStream currently being used for reading
   */
  InputStream inputStream_ = null;

  /**
   * current Chunk state
   */
  ChunkState cs = null;

  /**
   * is read only?
   */
  private boolean readOnly_ = false;

  /**
   * Get File Tailing Policy
   * 
   * @return current read policy
   */
  public TailPolicy getTailPolicy() {
    return (currentPolicy_);
  }

  /**
   * Set file Tailing Policy
   * 
   * @param policy New policy to set
   * @return Old policy
   */
  public TailPolicy setTailPolicy(TailPolicy policy) {
    TailPolicy old = currentPolicy_;
    currentPolicy_ = policy;
    return (old);
  }


  /**
   * Initialize read input stream
   * 
   * @return input stream to read from file
   */
  private InputStream createInputStream() throws TTransportException {
    InputStream is;
    try {
      if(inputStream_ != null) {
        ((TruncableBufferedInputStream)inputStream_).trunc();
        is = inputStream_;
      } else {
        is = new TruncableBufferedInputStream(inputFile_.getInputStream());
      }
    } catch (IOException iox) {
      System.err.println("createInputStream: "+iox.getMessage());
      throw new TTransportException(iox.getMessage(), iox);
    }
    return(is);
  }

  /**
   * Read (potentially tailing) an input stream
   * 
   * @param is InputStream to read from
   * @param buf Buffer to read into
   * @param off Offset in buffer to read into
   * @param len Number of bytes to read
   * @param tp  policy to use if we hit EOF
   *
   * @return number of bytes read
   */
  private int tailRead(InputStream is, byte[] buf, 
                       int off, int len, TailPolicy tp) throws TTransportException {
    int orig_len = len;
    try {
      int retries = 0;
      while(len > 0) {
        int cnt = is.read(buf, off, len);
        if(cnt > 0) {
          off += cnt;
          len -= cnt;
          retries = 0;
          cs.skip(cnt); // remember that we read so many bytes
        } else if (cnt == -1) {
          // EOF
          retries++;

          if((tp.retries_ != -1) && tp.retries_ < retries)
            return (orig_len - len);

          if(tp.timeout_ > 0) {
            try {Thread.sleep(tp.timeout_);} catch(InterruptedException e) {}
          }
        } else {
          // either non-zero or -1 is what the contract says!
          throw new
            TTransportException("Unexpected return from InputStream.read = "
                                + cnt);
        }
      }
    } catch (IOException iox) {
      throw new TTransportException(iox.getMessage(), iox);
    }

    return(orig_len - len);
  }

  /**
   * Event is corrupted. Do recovery
   *
   * @return true if recovery could be performed and we can read more data
   *         false is returned only when nothing more can be read
   */
  private boolean performRecovery() throws TTransportException {
    int numChunks = getNumChunks();
    int curChunk = cs.getChunkNum();

    if(curChunk >= (numChunks-1)) {
      return false;
    }
    seekToChunk(curChunk+1);
    return true;
  }

  /**
   * Read event from underlying file
   *
   * @return true if event could be read, false otherwise (on EOF)
   */
  private boolean readEvent() throws TTransportException {
    byte[] ebytes = new byte[4];
    int esize;
    int nread;
    int nrequested;

    retry:
    do {
      // corner case. read to end of chunk
      nrequested = cs.getRemaining();
      if(nrequested < 4) {
        nread = tailRead(inputStream_, ebytes, 0, nrequested, currentPolicy_);
        if(nread != nrequested) {
          return(false);
        }
      }

      // assuming serialized on little endian machine
      nread = tailRead(inputStream_, ebytes, 0, 4, currentPolicy_);
      if(nread != 4) {
        return(false);
      }

      esize=0;
      for(int i=3; i>=0; i--) {
        int val = (0x000000ff & (int)ebytes[i]);
        esize |= (val << (i*8));
      }

      // check if event is corrupted and do recovery as required
      if(esize > cs.getRemaining()) {
        throw new TTransportException("FileTransport error: bad event size");
        /*        
                  if(performRecovery()) {
                  esize=0;
                  } else {
                  return false;
                  }
        */
      }
    } while (esize == 0);

    // reset existing event or get a larger one
    if(currentEvent_.getSize() < esize)
      currentEvent_ = new Event(new byte [esize]);

    // populate the event
    byte[] buf = currentEvent_.getBuf();
    nread = tailRead(inputStream_, buf, 0, esize, currentPolicy_);
    if(nread != esize) {
      return(false);
    }
    currentEvent_.setAvailable(esize);
    return(true);
  }

  /**
   * open if both input/output open unless readonly
   *
   * @return true
   */
  public boolean isOpen() {
    return ((inputStream_ != null) && (readOnly_ || (outputStream_ != null)));
  }


  /**
   * Diverging from the cpp model and sticking to the TSocket model
   * Files are not opened in ctor - but in explicit open call
   */
  public void open() throws TTransportException {
    if (isOpen()) 
      throw new TTransportException(TTransportException.ALREADY_OPEN);

    try {
      inputStream_ = createInputStream();
      cs = new ChunkState();
      currentEvent_ = new Event(new byte [256]);

      if(!readOnly_)
        outputStream_ = new BufferedOutputStream(inputFile_.getOutputStream(), 8192);
    } catch (IOException iox) {
      throw new TTransportException(TTransportException.NOT_OPEN, iox);
    }
  }

  /**
   * Closes the transport.
   */
  public void close() {
    if (inputFile_ != null) {
      try {
        inputFile_.close();
      } catch (IOException iox) {
        System.err.println("WARNING: Error closing input file: " +
                           iox.getMessage());
      }
      inputFile_ = null;
    }
    if (outputStream_ != null) {
      try {
        outputStream_.close();
      } catch (IOException iox) {
        System.err.println("WARNING: Error closing output stream: " +
                           iox.getMessage());
      }
      outputStream_ = null;
    }
  }


  /**
   * File Transport ctor
   *
   * @param path File path to read and write from
   * @param readOnly Whether this is a read-only transport
   */ 
  public TFileTransport(final String path, boolean readOnly) throws IOException {
    inputFile_ = new TStandardFile(path);
    readOnly_ = readOnly;
  }

  /**
   * File Transport ctor
   *
   * @param inputFile open TSeekableFile to read/write from
   * @param readOnly Whether this is a read-only transport
   */
  public TFileTransport(TSeekableFile inputFile, boolean readOnly) {
    inputFile_ = inputFile;
    readOnly_ = readOnly;
  }


  /**
   * Cloned from TTransport.java:readAll(). Only difference is throwing an EOF exception
   * where one is detected.
   */
  public int readAll(byte[] buf, int off, int len)
    throws TTransportException {
    int got = 0;
    int ret = 0;
    while (got < len) {
      ret = read(buf, off+got, len-got);
      if (ret < 0) {
        throw new TTransportException("Error in reading from file");
      }
      if(ret == 0) {
        throw new TTransportException(TTransportException.END_OF_FILE,
                                      "End of File reached");
      }
      got += ret;
    }
    return got;
  }


  /**
   * Reads up to len bytes into buffer buf, starting at offset off.
   *
   * @param buf Array to read into
   * @param off Index to start reading at
   * @param len Maximum number of bytes to read
   * @return The number of bytes actually read
   * @throws TTransportException if there was an error reading data
   */
  public int read(byte[] buf, int off, int len) throws TTransportException {
    if(!isOpen()) 
      throw new TTransportException(TTransportException.NOT_OPEN, 
                                    "Must open before reading");

    if(currentEvent_.getRemaining() == 0) {
      if(!readEvent())
        return(0);
    }

    int nread = currentEvent_.emit(buf, off, len);
    return nread;
  }

  public int getNumChunks() throws TTransportException {
    if(!isOpen()) 
      throw new TTransportException(TTransportException.NOT_OPEN, 
                                    "Must open before getNumChunks");
    try {
      long len = inputFile_.length();
      if(len == 0)
        return 0;
      else 
        return (((int)(len/cs.getChunkSize())) + 1);

    } catch (IOException iox) {
      throw new TTransportException(iox.getMessage(), iox);
    }
  }

  public int getCurChunk() throws TTransportException {
    if(!isOpen()) 
      throw new TTransportException(TTransportException.NOT_OPEN, 
                                    "Must open before getCurChunk");
    return (cs.getChunkNum());

  }


  public void seekToChunk(int chunk) throws TTransportException {
    if(!isOpen()) 
      throw new TTransportException(TTransportException.NOT_OPEN, 
                                    "Must open before seeking");

    int numChunks = getNumChunks();

    // file is empty, seeking to chunk is pointless
    if (numChunks == 0) {
      return;
    }

    // negative indicates reverse seek (from the end)
    if (chunk < 0) {
      chunk += numChunks;
    }

    // too large a value for reverse seek, just seek to beginning
    if (chunk < 0) {
      chunk = 0;
    }

    long eofOffset=0;
    boolean seekToEnd = (chunk >= numChunks);
    if(seekToEnd) {
      chunk = chunk - 1;
      try { eofOffset = inputFile_.length(); }
      catch (IOException iox) {throw new TTransportException(iox.getMessage(),
                                                             iox);}
    }

    if(chunk*cs.getChunkSize() != cs.getOffset()) {
      try { inputFile_.seek((long)chunk*cs.getChunkSize()); } 
      catch (IOException iox) {
        System.err.println("createInputStream: "+iox.getMessage());
        throw new TTransportException("Seek to chunk " +
                                      chunk + " " +iox.getMessage(), iox);
      }

      cs.seek((long)chunk*cs.getChunkSize());
      currentEvent_.setAvailable(0);
      inputStream_ = createInputStream();
    }

    if(seekToEnd) {
      // waiting forever here - otherwise we can hit EOF and end up
      // having consumed partial data from the data stream.
      TailPolicy old = setTailPolicy(TailPolicy.WAIT_FOREVER);
      while(cs.getOffset() < eofOffset) { readEvent(); }
      currentEvent_.setAvailable(0);
      setTailPolicy(old);
    }
  }

  public void seekToEnd() throws TTransportException {
    if(!isOpen()) 
      throw new TTransportException(TTransportException.NOT_OPEN, 
                                    "Must open before seeking");
    seekToChunk(getNumChunks());
  }


  /**
   * Writes up to len bytes from the buffer.
   *
   * @param buf The output data buffer
   * @param off The offset to start writing from
   * @param len The number of bytes to write
   * @throws TTransportException if there was an error writing data
   */
  public void write(byte[] buf, int off, int len) throws TTransportException {
    throw new TTransportException("Not Supported");
  }

  /**
   * Flush any pending data out of a transport buffer.
   *
   * @throws TTransportException if there was an error writing out data.
   */
  public void flush() throws TTransportException {
    throw new TTransportException("Not Supported");
  }

  /**
   * test program
   * 
   */
  public static void main(String[] args) throws Exception {

    int num_chunks = 10;

    if((args.length < 1) || args[0].equals("--help")
       || args[0].equals("-h") || args[0].equals("-?")) {
      printUsage();
    }

    if(args.length > 1) {
      try {
        num_chunks = Integer.parseInt(args[1]);
      } catch (Exception e) {
        System.err.println("Cannot parse " + args[1]); 
        printUsage();
      }
    }

    TFileTransport t = new TFileTransport(args[0], true);
    t.open();
    System.out.println("NumChunks="+t.getNumChunks());

    Random r = new Random();
    for(int j=0; j<num_chunks; j++) {
      byte[] buf = new byte[4096];
      int cnum = r.nextInt(t.getNumChunks()-1);
      System.out.println("Reading chunk "+cnum);
      t.seekToChunk(cnum);
      for(int i=0; i<4096; i++) {
        t.read(buf, 0, 4096);
      }
    }
  }

  private static void printUsage() {
    System.err.println("Usage: TFileTransport <filename> [num_chunks]");
    System.err.println("       (Opens and reads num_chunks chunks from file randomly)");
    System.exit(1);
  }

}
