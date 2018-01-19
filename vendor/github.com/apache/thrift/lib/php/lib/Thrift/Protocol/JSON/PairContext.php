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

use Thrift\Protocol\TJSONProtocol;

class PairContext extends BaseContext
{
    private $first_ = true;
    private $colon_ = true;
    private $p_ = null;

    public function __construct($p)
    {
        $this->p_ = $p;
    }

    public function write()
    {
        if ($this->first_) {
            $this->first_ = false;
            $this->colon_ = true;
        } else {
            $this->p_->getTransport()->write($this->colon_ ? TJSONProtocol::COLON : TJSONProtocol::COMMA);
            $this->colon_ = !$this->colon_;
        }
    }

    public function read()
    {
        if ($this->first_) {
            $this->first_ = false;
            $this->colon_ = true;
        } else {
            $this->p_->readJSONSyntaxChar($this->colon_ ? TJSONProtocol::COLON : TJSONProtocol::COMMA);
            $this->colon_ = !$this->colon_;
        }
    }

    public function escapeNum()
    {
        return $this->colon_;
    }
}
