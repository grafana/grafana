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

package org.apache.thrift.helper;

import Map;


class IntSet {

    private var _elements = new haxe.ds.IntMap<Int>();
    private var _size : Int = 0;
    public var size(get,never) : Int;

    public function new( values : Array<Int> = null) {
        if ( values != null) {
            for ( value in values) {
                 add(value);
            }
        }
    }

    public function iterator():Iterator<Int> {
        return _elements.keys();
    }

    public function traceAll() : Void {
        trace('$_size entries');
        for(entry in this) {
            var yes = contains(entry);
            trace('- $entry, contains() = $yes');
        }
    }

    public function add(o : Int) : Bool {
        if( _elements.exists(o)) {
            return false;
        }
        _size++;
        _elements.set(o,_size);
        return true;
    }

    public function clear() : Void {
        while( _size > 0) {
            remove( _elements.keys().next());
        }
    }

    public function contains(o : Int) : Bool {
        return _elements.exists(o);
    }

    public function isEmpty() : Bool {
        return _size == 0;
    }

    public function remove(o : Int) : Bool {
        if (contains(o)) {
            _elements.remove(o);
            _size--;
            return true;
        } else {
            return false;
        }
    }

    public function toArray() : Array<Int> {
        var ret : Array<Int> = new Array<Int>();
        for (key in _elements.keys()) {
            ret.push(key);
        }
        return ret;
    }

    public function get_size() : Int {
        return _size;
    }
}
    