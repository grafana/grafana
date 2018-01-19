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

import java.io.IOException;
import java.io.RandomAccessFile;


/**
 * Basic file support for the TTransport interface
 */
public final class TSimpleFileTransport extends TTransport {

  private RandomAccessFile file = null;   
  private boolean readable;               
  private boolean writable;               
  private String path_;               


  /**
   * Create a transport backed by a simple file 
   * 
   * @param path the path to the file to open/create
   * @param read true to support read operations
   * @param write true to support write operations
   * @param openFile true to open the file on construction
   * @throws TTransportException if file open fails
   */
  public TSimpleFileTransport(String path, boolean read, 
                              boolean write, boolean openFile)
          throws TTransportException {
    if (path.length() <= 0) {
      throw new TTransportException("No path specified");
    }
    if (!read && !write) {
      throw new TTransportException("Neither READ nor WRITE specified");
    }
    readable = read;
    writable = write;
    path_ = path;
    if (openFile) {
      open();
    }
  }
  
  /**
   * Create a transport backed by a simple file 
   * Implicitly opens file to conform to C++ behavior.
   * 
   * @param path the path to the file to open/create
   * @param read true to support read operations
   * @param write true to support write operations
   * @throws TTransportException if file open fails
   */
  public TSimpleFileTransport(String path, boolean read, boolean write)
          throws TTransportException {
    this(path, read, write, true);
  }
  
  /**
   * Create a transport backed by a simple read only disk file (implicitly opens
   * file)
   *
   * @param path the path to the file to open/create
   * @throws TTransportException if file open fails
   */
  public TSimpleFileTransport(String path) throws TTransportException {
    this(path, true, false, true);
  }

  /**
   * Test file status
   *
   * @return true if open, otherwise false
   */
  @Override
  public boolean isOpen() {
    return (file != null);
  }

  /**
   * Open file if not previously opened. 
   *
   * @throws TTransportException if open fails
   */
  @Override
  public void open() throws TTransportException {
    if (file == null){
      try {
        String access = "r";       //RandomAccessFile objects must be readable
        if (writable) {
          access += "w";
        }
        file = new RandomAccessFile(path_, access);
      } catch (IOException ioe) {
        file = null;
        throw new TTransportException(ioe.getMessage());
      }      
    }
  }

  /**
   * Close file, subsequent read/write activity will throw exceptions
   */
  @Override
  public void close() {
    if (file != null) {
      try {
        file.close();
      } catch (Exception e) {
        //Nothing to do
      }
      file = null;
    }
  }

  /**
   * Read up to len many bytes into buf at offset 
   *
   * @param buf houses bytes read
   * @param off offset into buff to begin writing to
   * @param len maximum number of bytes to read
   * @return number of bytes actually read
   * @throws TTransportException on read failure
   */
  @Override
  public int read(byte[] buf, int off, int len) throws TTransportException {
    if (!readable) {
      throw new TTransportException("Read operation on write only file");
    }
    int iBytesRead = 0;
    try {
      iBytesRead = file.read(buf, off, len);
    } catch (IOException ioe) {
      file = null;
      throw new TTransportException(ioe.getMessage());
    }
    return iBytesRead;
  }

  /**
   * Write len many bytes from buff starting at offset 
   *
   * @param buf buffer containing bytes to write
   * @param off offset into buffer to begin writing from
   * @param len number of bytes to write
   * @throws TTransportException on write failure
   */
  @Override
  public void write(byte[] buf, int off, int len) throws TTransportException {
    try {
      file.write(buf, off, len);
    } catch (IOException ioe) {
      file = null;
      throw new TTransportException(ioe.getMessage());
    }
  }

  /**
   * Move file pointer to specified offset, new read/write calls will act here
   *
   * @param offset bytes from beginning of file to move pointer to
   * @throws TTransportException is seek fails
   */
  public void seek(long offset) throws TTransportException {
    try {
      file.seek(offset);
    } catch (IOException ex) {
      throw new TTransportException(ex.getMessage());
    }
  }

  /**
   * Return the length of the file in bytes
   *
   * @return length of the file in bytes
   * @throws TTransportException if file access fails
   */
  public long length() throws TTransportException {
    try {
      return file.length();
    } catch (IOException ex) {
      throw new TTransportException(ex.getMessage());
    }
  }

  /**
   * Return current file pointer position in bytes from beginning of file
   *
   * @return file pointer position
   * @throws TTransportException if file access fails
   */
  public long getFilePointer() throws TTransportException {
    try {
      return file.getFilePointer();
    } catch (IOException ex) {
      throw new TTransportException(ex.getMessage());
    }
  }
}