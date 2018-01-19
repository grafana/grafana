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

namespace Thrift\Exception;

/**
 * Transport exceptions
 */
class TTransportException extends TException
{
  const UNKNOWN = 0;
  const NOT_OPEN = 1;
  const ALREADY_OPEN = 2;
  const TIMED_OUT = 3;
  const END_OF_FILE = 4;

  public function __construct($message=null, $code=0)
  {
    parent::__construct($message, $code);
  }
}
