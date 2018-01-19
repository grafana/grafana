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
 * HTTP client for Thrift
 *
 * @package thrift.transport
 */
class TCurlClient extends TTransport
{
  private static $curlHandle;

  /**
   * The host to connect to
   *
   * @var string
   */
  protected $host_;

  /**
   * The port to connect on
   *
   * @var int
   */
  protected $port_;

  /**
   * The URI to request
   *
   * @var string
   */
  protected $uri_;

  /**
   * The scheme to use for the request, i.e. http, https
   *
   * @var string
   */
  protected $scheme_;

  /**
   * Buffer for the HTTP request data
   *
   * @var string
   */
  protected $request_;

  /**
   * Buffer for the HTTP response data.
   *
   * @var binary string
   */
  protected $response_;

  /**
   * Read timeout
   *
   * @var float
   */
  protected $timeout_;

  /**
   * Make a new HTTP client.
   *
   * @param string $host
   * @param int    $port
   * @param string $uri
   */
  public function __construct($host, $port=80, $uri='', $scheme = 'http')
  {
    if ((TStringFuncFactory::create()->strlen($uri) > 0) && ($uri{0} != '/')) {
      $uri = '/'.$uri;
    }
    $this->scheme_ = $scheme;
    $this->host_ = $host;
    $this->port_ = $port;
    $this->uri_ = $uri;
    $this->request_ = '';
    $this->response_ = null;
    $this->timeout_ = null;
  }

  /**
   * Set read timeout
   *
   * @param float $timeout
   */
  public function setTimeoutSecs($timeout)
  {
    $this->timeout_ = $timeout;
  }

  /**
   * Whether this transport is open.
   *
   * @return boolean true if open
   */
  public function isOpen()
  {
    return true;
  }

  /**
   * Open the transport for reading/writing
   *
   * @throws TTransportException if cannot open
   */
  public function open()
  {
  }

  /**
   * Close the transport.
   */
  public function close()
  {
    $this->request_ = '';
    $this->response_ = null;
  }

  /**
   * Read some data into the array.
   *
   * @param int    $len How much to read
   * @return string The data that has been read
   * @throws TTransportException if cannot read any more data
   */
  public function read($len)
  {
    if ($len >= strlen($this->response_)) {
      return $this->response_;
    } else {
      $ret = substr($this->response_, 0, $len);
      $this->response_ = substr($this->response_, $len);

      return $ret;
    }
  }

  /**
   * Writes some data into the pending buffer
   *
   * @param string $buf  The data to write
   * @throws TTransportException if writing fails
   */
  public function write($buf)
  {
    $this->request_ .= $buf;
  }

  /**
   * Opens and sends the actual request over the HTTP connection
   *
   * @throws TTransportException if a writing error occurs
   */
  public function flush()
  {
    if (!self::$curlHandle) {
      register_shutdown_function(array('Thrift\\Transport\\TCurlClient', 'closeCurlHandle'));
      self::$curlHandle = curl_init();
      curl_setopt(self::$curlHandle, CURLOPT_RETURNTRANSFER, true);
      curl_setopt(self::$curlHandle, CURLOPT_BINARYTRANSFER, true);
      curl_setopt(self::$curlHandle, CURLOPT_USERAGENT, 'PHP/TCurlClient');
      curl_setopt(self::$curlHandle, CURLOPT_CUSTOMREQUEST, 'POST');
      curl_setopt(self::$curlHandle, CURLOPT_FOLLOWLOCATION, true);
      curl_setopt(self::$curlHandle, CURLOPT_MAXREDIRS, 1);
    }
    // God, PHP really has some esoteric ways of doing simple things.
    $host = $this->host_.($this->port_ != 80 ? ':'.$this->port_ : '');
    $fullUrl = $this->scheme_."://".$host.$this->uri_;

    $headers = array('Accept: application/x-thrift',
                     'Content-Type: application/x-thrift',
                     'Content-Length: '.TStringFuncFactory::create()->strlen($this->request_));
    curl_setopt(self::$curlHandle, CURLOPT_HTTPHEADER, $headers);

    if ($this->timeout_ > 0) {
      curl_setopt(self::$curlHandle, CURLOPT_TIMEOUT, $this->timeout_);
    }
    curl_setopt(self::$curlHandle, CURLOPT_POSTFIELDS, $this->request_);
    $this->request_ = '';

    curl_setopt(self::$curlHandle, CURLOPT_URL, $fullUrl);
    $this->response_ = curl_exec(self::$curlHandle);

    // Connect failed?
    if (!$this->response_) {
      curl_close(self::$curlHandle);
      self::$curlHandle = null;
      $error = 'TCurlClient: Could not connect to '.$fullUrl;
      throw new TTransportException($error, TTransportException::NOT_OPEN);
    }
  }

  public static function closeCurlHandle()
  {
    try {
      if (self::$curlHandle) {
        curl_close(self::$curlHandle);
        self::$curlHandle = null;
      }
    } catch (\Exception $x) {
      error_log('There was an error closing the curl handle: ' . $x->getMessage());
    }
  }

}
