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

use Thrift\Factory\TStringFuncFactory;

/**
 * Framed transport. Writes and reads data in chunks that are stamped with
 * their length.
 *
 * @package thrift.transport
 */
class TFramedTransport extends TTransport
{
  /**
   * Underlying transport object.
   *
   * @var TTransport
   */
  private $transport_;

  /**
   * Buffer for read data.
   *
   * @var string
   */
  private $rBuf_;

  /**
   * Buffer for queued output data
   *
   * @var string
   */
  private $wBuf_;

  /**
   * Whether to frame reads
   *
   * @var bool
   */
  private $read_;

  /**
   * Whether to frame writes
   *
   * @var bool
   */
  private $write_;

  /**
   * Constructor.
   *
   * @param TTransport $transport Underlying transport
   */
  public function __construct($transport=null, $read=true, $write=true)
  {
    $this->transport_ = $transport;
    $this->read_ = $read;
    $this->write_ = $write;
  }

  public function isOpen()
  {
    return $this->transport_->isOpen();
  }

  public function open()
  {
    $this->transport_->open();
  }

  public function close()
  {
    $this->transport_->close();
  }

  /**
   * Reads from the buffer. When more data is required reads another entire
   * chunk and serves future reads out of that.
   *
   * @param int $len How much data
   */
  public function read($len)
  {
    if (!$this->read_) {
      return $this->transport_->read($len);
    }

    if (TStringFuncFactory::create()->strlen($this->rBuf_) === 0) {
      $this->readFrame();
    }

    // Just return full buff
    if ($len >= TStringFuncFactory::create()->strlen($this->rBuf_)) {
      $out = $this->rBuf_;
      $this->rBuf_ = null;

      return $out;
    }

    // Return TStringFuncFactory::create()->substr
    $out = TStringFuncFactory::create()->substr($this->rBuf_, 0, $len);
    $this->rBuf_ = TStringFuncFactory::create()->substr($this->rBuf_, $len);

    return $out;
  }

  /**
   * Put previously read data back into the buffer
   *
   * @param string $data data to return
   */
  public function putBack($data)
  {
    if (TStringFuncFactory::create()->strlen($this->rBuf_) === 0) {
      $this->rBuf_ = $data;
    } else {
      $this->rBuf_ = ($data . $this->rBuf_);
    }
  }

  /**
   * Reads a chunk of data into the internal read buffer.
   */
  private function readFrame()
  {
    $buf = $this->transport_->readAll(4);
    $val = unpack('N', $buf);
    $sz = $val[1];

    $this->rBuf_ = $this->transport_->readAll($sz);
  }

  /**
   * Writes some data to the pending output buffer.
   *
   * @param string $buf The data
   * @param int    $len Limit of bytes to write
   */
  public function write($buf, $len=null)
  {
    if (!$this->write_) {
      return $this->transport_->write($buf, $len);
    }

    if ($len !== null && $len < TStringFuncFactory::create()->strlen($buf)) {
      $buf = TStringFuncFactory::create()->substr($buf, 0, $len);
    }
    $this->wBuf_ .= $buf;
  }

  /**
   * Writes the output buffer to the stream in the format of a 4-byte length
   * followed by the actual data.
   */
  public function flush()
  {
    if (!$this->write_ || TStringFuncFactory::create()->strlen($this->wBuf_) == 0) {
      return $this->transport_->flush();
    }

    $out = pack('N', TStringFuncFactory::create()->strlen($this->wBuf_));
    $out .= $this->wBuf_;

    // Note that we clear the internal wBuf_ prior to the underlying write
    // to ensure we're in a sane state (i.e. internal buffer cleaned)
    // if the underlying write throws up an exception
    $this->wBuf_ = '';
    $this->transport_->write($out);
    $this->transport_->flush();
  }

}
