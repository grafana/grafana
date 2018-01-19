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
 * @package thrift
 */

/**
 * Include this file if you wish to use autoload with your PHP generated Thrift
 * code. The generated code will *not* include any defined Thrift classes by
 * default, except for the service interfaces. The generated code will populate
 * values into $GLOBALS['THRIFT_AUTOLOAD'] which can be used by the autoload
 * method below. If you have your own autoload system already in place, rename your
 * __autoload function to something else and then do:
 * $GLOBALS['AUTOLOAD_HOOKS'][] = 'my_autoload_func';
 *
 * Generate this code using the --gen php:autoload Thrift generator flag.
 */

$GLOBALS['THRIFT_AUTOLOAD'] = array();
$GLOBALS['AUTOLOAD_HOOKS'] = array();

if (!function_exists('__autoload')) {
  function __autoload($class)
  {
    global $THRIFT_AUTOLOAD;
    $classl = strtolower($class);
    if (isset($THRIFT_AUTOLOAD[$classl])) {
      include_once $GLOBALS['THRIFT_ROOT'].'/packages/'.$THRIFT_AUTOLOAD[$classl];
    } elseif (!empty($GLOBALS['AUTOLOAD_HOOKS'])) {
      foreach ($GLOBALS['AUTOLOAD_HOOKS'] as $hook) {
        $hook($class);
      }
    }
  }
}
