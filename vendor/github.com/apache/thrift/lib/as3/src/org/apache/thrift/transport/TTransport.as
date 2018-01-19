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

package org.apache.thrift.transport {
  
  import flash.utils.ByteArray;
  import org.apache.thrift.AbstractMethodError;
  
  public class TTransport {

    /**
     * Queries whether the transport is open.
       *
     * @return True if the transport is open.
     */
    public function isOpen():Boolean {
      throw new AbstractMethodError();
    }
    
    /**
     * Is there more data to be read?
     *
     * @return True if the remote side is still alive and feeding us
     */
    public function peek():Boolean {
      return isOpen();
    }

    /**
     * Opens the transport for reading/writing.
     *
     * @throws TTransportException if the transport could not be opened
     */
    public function open():void {
      throw new AbstractMethodError();
    }

    /**
     * Closes the transport.
     */
    public function close():void {
      throw new AbstractMethodError();
    };

    /**
     * Reads up to len bytes into buffer buf, starting att offset off.
     *
     * @param buf Array to read into
     * @param off Index to start reading at
     * @param len Maximum number of bytes to read
     * @return The number of bytes actually read
     * @throws TTransportException if there was an error reading data
     */
     public function read(buf:ByteArray, off:int, len:int):int {
      throw new AbstractMethodError();
     }

    /**
     * Guarantees that all of len bytes are actually read off the transport.
     *
     * @param buf Array to read into
     * @param off Index to start reading at
     * @param len Maximum number of bytes to read
     * @return The number of bytes actually read, which must be equal to len
     * @throws TTransportException if there was an error reading data
     */
    public function readAll(buf:ByteArray, off:int, len:int):int {
      var got:int = 0;
        var ret:int = 0;
        while (got < len) {
            ret = read(buf, off+got, len-got);
            if (ret <= 0) {
              throw new TTransportError(TTransportError.UNKNOWN, "Cannot read. Remote side has closed. Tried to read " + len + " bytes, but only got " + got + " bytes.");
            }
            got += ret;
          }
        return got;
      }

    /**
     * Writes the buffer to the output
     *
     * @param buf The output data buffer
     * @throws TTransportException if an error occurs writing data
     */
    public function writeAll(buf:ByteArray):void {
      write(buf, 0, buf.length);
    }

    /**
     * Writes up to len bytes from the buffer.
     *
     * @param buf The output data buffer
     * @param off The offset to start writing from
     * @param len The number of bytes to write
     * @throws TTransportException if there was an error writing data
     */
    public function write(buf:ByteArray, off:int, len:int):void {
      throw new AbstractMethodError();
    }

    /**
     * Flush any pending data out of a transport buffer.
     *
     * @throws TTransportException if there was an error writing out data.
     */
    public function flush(callback:Function=null):void {
      throw new AbstractMethodError();
    }
  }
}