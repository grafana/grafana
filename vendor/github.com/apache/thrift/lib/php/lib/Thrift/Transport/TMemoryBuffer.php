<?php
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
 *
 * @package thrift.transport
 */

namespace Thrift\Transport;

use Thrift\Exception\TTransportException;
use Thrift\Factory\TStringFuncFactory;

/**
 * A memory buffer is a tranpsort that simply reads from and writes to an
 * in-memory string buffer. Anytime you call write on it, the data is simply
 * placed into a buffer, and anytime you call read, data is read from that
 * buffer.
 *
 * @package thrift.transport
 */
class TMemoryBuffer extends TTransport
{
  /**
   * Constructor. Optionally pass an initial value
   * for the buffer.
   */
  public function __construct($buf = '')
  {
    $this->buf_ = $buf;
  }

  protected $buf_ = '';

  public function isOpen()
  {
    return true;
  }

  public function open() {}

  public function close() {}

  public function write($buf)
  {
    $this->buf_ .= $buf;
  }

  public function read($len)
  {
    $bufLength = TStringFuncFactory::create()->strlen($this->buf_);

    if ($bufLength === 0) {
      throw new TTransportException('TMemoryBuffer: Could not read ' .
                                    $len . ' bytes from buffer.',
                                    TTransportException::UNKNOWN);
    }

    if ($bufLength <= $len) {
      $ret = $this->buf_;
      $this->buf_ = '';

      return $ret;
    }

    $ret = TStringFuncFactory::create()->substr($this->buf_, 0, $len);
    $this->buf_ = TStringFuncFactory::create()->substr($this->buf_, $len);

    return $ret;
  }

  public function getBuffer()
  {
    return $this->buf_;
  }

  public function available()
  {
    return TStringFuncFactory::create()->strlen($this->buf_);
  }

  public function putBack($data)
  {
    $this->buf_ = $data.$this->buf_;
  }
}
