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

package ;

import haxe.macro.Context;
import haxe.macro.Expr;

/****
 * If you call the Thrift compiler this way (e.g. by changing the prebuild command)
 *
 *     thrift -r -gen haxe:buildmacro=TestMacro.handle()   ../ThriftTest.thrift
 *
 * the TestMacro.handle() function implemented below is called for each generated class
 * and interface. Use "thrift --help" to get more info about other available options.
 */
class TestMacro
{
  public static function handle( ) : Array< Field> {
    trace('TestMacro called for ' + Context.getLocalType());
    return Context.getBuildFields();
  }

}
