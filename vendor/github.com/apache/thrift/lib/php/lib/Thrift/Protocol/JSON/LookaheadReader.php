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
 * @package thrift.protocol
 */

namespace Thrift\Protocol\JSON;

class LookaheadReader
{
    private $hasData_ = false;
    private $data_ = array();
    private $p_;

    public function __construct($p)
    {
        $this->p_ = $p;
    }

    public function read()
    {
        if ($this->hasData_) {
            $this->hasData_ = false;
        } else {
            $this->data_ = $this->p_->getTransport()->readAll(1);
        }

        return substr($this->data_, 0, 1);
    }

    public function peek()
    {
        if (!$this->hasData_) {
            $this->data_ = $this->p_->getTransport()->readAll(1);
        }

        $this->hasData_ = true;

        return substr($this->data_, 0, 1);
    }
}
