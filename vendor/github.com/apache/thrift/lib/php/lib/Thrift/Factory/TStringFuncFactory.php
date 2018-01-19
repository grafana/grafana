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
 */

namespace Thrift\Factory;

use Thrift\StringFunc\Mbstring;
use Thrift\StringFunc\Core;

class TStringFuncFactory
{
    private static $_instance;

    /**
     * Get the Singleton instance of TStringFunc implementation that is
     * compatible with the current system's mbstring.func_overload settings.
     *
     * @return TStringFunc
     */
    public static function create()
    {
        if (!self::$_instance) {
            self::_setInstance();
        }

        return self::$_instance;
    }

    private static function _setInstance()
    {
        /**
         * Cannot use str* functions for byte counting because multibyte
         * characters will be read a single bytes.
         *
         * See: http://us.php.net/manual/en/mbstring.overload.php
         */
        if (ini_get('mbstring.func_overload') & 2) {
            self::$_instance = new Mbstring();
        }
        /**
         * mbstring is not installed or does not have function overloading
         * of the str* functions enabled so use PHP core str* functions for
         * byte counting.
         */
        else {
            self::$_instance = new Core();
        }
    }
}
