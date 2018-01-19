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
 */

/**
 * Abstract Class providing null implementation for FacebookService
 * methods.
 */
class FacebookBase implements FacebookServiceIf {
  protected $name_ = '';

  public function __construct($name) {
    $this->name_ = $name;
  }

  public function getName() {
    return $this->name_;
  }

  public function getVersion() { 
    return ''; 
  }

  public function getStatus() { 
    return null; 
  } 
  
  public function getStatusDetails() { 
    return '';
  }
 
  public function getCounters() { 
    return array();
  } 

  public function getCounter($key) { 
    return null;
  } 

  public function setOption($key, $value) { 
    return;
  } 

  public function getOption($key) { 
    return ''; 
  } 

  public function getOptions() { 
    return array();
  } 

  public function aliveSince() { 
    return 0;
  } 

  public function getCpuProfile($duration) { 
    return ''; 
  }

  public function getLimitedReflection() { 
    return array();
  } 

  public function reinitialize() { 
    return;
  }

  public function shutdown() { 
    return;
  }

}

