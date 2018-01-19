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

use Thrift\Exception\TException;
use Thrift\Factory\TStringFuncFactory;

/**
 * Php stream transport. Reads to and writes from the php standard streams
 * php://input and php://output
 *
 * @package thrift.transport
 */
class TPhpStream extends TTransport
{
  const MODE_R = 1;
  const MODE_W = 2;

  private $inStream_ = null;

  private $outStream_ = null;

  private $read_ = false;

  private $write_ = false;

  public function __construct($mode)
  {
    $this->read_ = $mode & self::MODE_R;
    $this->write_ = $mode & self::MODE_W;
  }

  public function open()
  {
    if ($this->read_) {
      $this->inStream_ = @fopen(self::inStreamName(), 'r');
      if (!is_resource($this->inStream_)) {
        throw new TException('TPhpStream: Could not open php://input');
      }
    }
    if ($this->write_) {
      $this->outStream_ = @fopen('php://output', 'w');
      if (!is_resource($this->outStream_)) {
        throw new TException('TPhpStream: Could not open php://output');
      }
    }
  }

  public function close()
  {
    if ($this->read_) {
      @fclose($this->inStream_);
      $this->inStream_ = null;
    }
    if ($this->write_) {
      @fclose($this->outStream_);
      $this->outStream_ = null;
    }
  }

  public function isOpen()
  {
    return
      (!$this->read_ || is_resource($this->inStream_)) &&
      (!$this->write_ || is_resource($this->outStream_));
  }

  public function read($len)
  {
    $data = @fread($this->inStream_, $len);
    if ($data === FALSE || $data === '') {
      throw new TException('TPhpStream: Could not read '.$len.' bytes');
    }

    return $data;
  }

  public function write($buf)
  {
    while (TStringFuncFactory::create()->strlen($buf) > 0) {
      $got = @fwrite($this->outStream_, $buf);
      if ($got === 0 || $got === FALSE) {
        throw new TException('TPhpStream: Could not write '.TStringFuncFactory::create()->strlen($buf).' bytes');
      }
      $buf = TStringFuncFactory::create()->substr($buf, $got);
    }
  }

  public function flush()
  {
    @fflush($this->outStream_);
  }

  private static function inStreamName()
  {
    if (php_sapi_name() == 'cli') {
      return 'php://stdin';
    }

    return 'php://input';
  }

}
