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
import haxe.Int64;
import haxe.ds.IntMap;


// Int64Map allows mapping of Int64 keys to arbitrary values.
// ObjectMap<> cannot be used, since we want to compare by value, not address

class Int64Map<T> implements IMap< Int64, T> {

    private var SubMaps : IntMap< IntMap< T>>;  // Hi -> Lo -> Value

    public function new() : Void {
        SubMaps = new IntMap< IntMap< T>>();
    };

    private function GetSubMap( hi : haxe.Int32, canCreate : Bool) : IntMap< T> {
        if( SubMaps.exists(hi)) {
            return SubMaps.get(hi);
        }

        if( ! canCreate) {
            return null;
        }

        var lomap = new IntMap< T>();
        SubMaps.set( hi, lomap);
        return lomap;
    }


    private function GetLowMap( key : haxe.Int64, canCreate : Bool) : IntMap< T> {
        #if( haxe_ver < 3.2)
        return GetSubMap( Int64.getHigh(key), canCreate);
        #else
        return GetSubMap( key.high, canCreate);
        #end
    }


    private function GetLowIndex( key : haxe.Int64) : haxe.Int32 {
        #if( haxe_ver < 3.2)
        return Int64.getLow(key);
        #else
        return key.low;
        #end
    }


    private function NullCheck( key : haxe.Int64) : Bool {
        #if( haxe_ver < 3.2)
        return (key != null);
        #else
        return true;  // Int64 is not nullable anymore (it never really was)
        #end
    };



    /**
        Maps `key` to `value`.
        If `key` already has a mapping, the previous value disappears.
        If `key` is null, the result is unspecified.
    **/
    public function set( key : Int64, value : T ) : Void {
        if( ! NullCheck(key)) {
            return;
        }

        var lomap = GetLowMap( key, true);
        lomap.set( GetLowIndex(key), value);
    }


    /**
        Returns the current mapping of `key`.
        If no such mapping exists, null is returned.
        If `key` is null, the result is unspecified.

        Note that a check like `map.get(key) == null` can hold for two reasons:

            1. the map has no mapping for `key`
            2. the map has a mapping with a value of `null`

        If it is important to distinguish these cases, `exists()` should be
        used.

    **/
    public function get( key : Int64) : Null<T> {
        if( ! NullCheck(key)) {
            return null;
        }

        var lomap = GetLowMap( key, true);
        if( lomap == null) {
            return null;
        }

        return lomap.get( GetLowIndex(key));
    }

    /**
        Returns true if `key` has a mapping, false otherwise.
        If `key` is null, the result is unspecified.
    **/
    public function exists( key : Int64) : Bool {
        if( ! NullCheck(key)) {
            return false;
        }

        var lomap = GetLowMap( key, true);
        if( lomap == null) {
            return false;
        }

        return lomap.exists( GetLowIndex(key));
    }

    /**
        Removes the mapping of `key` and returns true if such a mapping existed,
        false otherwise. If `key` is null, the result is unspecified.
    **/
    public function remove( key : Int64) : Bool {
        if( ! NullCheck(key)) {
            return false;
        }

        var lomap = GetLowMap( key, true);
        if( lomap == null) {
            return false;
        }

        return lomap.remove( GetLowIndex(key));
    }


    /**
        Returns an Iterator over the keys of `this` Map.
        The order of keys is undefined.
    **/
    public function keys() : Iterator<Int64> {
        return new Int64KeyIterator<T>(SubMaps);
    }

    /**
        Returns an Iterator over the values of `this` Map.
        The order of values is undefined.
    **/
    public function iterator() : Iterator<T> {
        return new Int64ValueIterator<T>(SubMaps);
    }

    /**
        Returns a String representation of `this` Map.
        The exact representation depends on the platform and key-type.
    **/
    public function toString() : String {
        var result : String = "{";

        var first = true;
        for( key in this.keys()) {
            if( first) {
                first = false;
            } else {
                result += ",";
            }

            result += " ";
            var value = this.get(key);
            result += Int64.toStr(key) + ' => $value';
        }

        return result + "}";
    }

}


// internal helper class for Int64Map<T>
// all class with matching methods can be used as iterator (duck typing)
private class Int64MapIteratorBase<T> {

    private var SubMaps : IntMap< IntMap< T>>;  // Hi -> Lo -> Value

    private var HiIterator : Iterator< Int> = null;
    private var LoIterator : Iterator< Int> = null;
    private var CurrentHi : Int = 0;

    public function new( data : IntMap< IntMap< T>>) : Void {
        SubMaps = data;
        HiIterator = SubMaps.keys();
        LoIterator = null;
        CurrentHi = 0;
    };

    /**
        Returns false if the iteration is complete, true otherwise.

        Usually iteration is considered to be complete if all elements of the
        underlying data structure were handled through calls to next(). However,
        in custom iterators any logic may be used to determine the completion
        state.
    **/
    public function hasNext() : Bool {

        if( (LoIterator != null) && LoIterator.hasNext()) {
            return true;
        }

        while( (HiIterator != null) && HiIterator.hasNext()) {
            CurrentHi = HiIterator.next();
            LoIterator = SubMaps.get(CurrentHi).keys();
            if( (LoIterator != null) && LoIterator.hasNext()) {
                return true;
            }
        }

        HiIterator = null;
        LoIterator = null;
        return false;
    }

}


// internal helper class for Int64Map<T>
// all class with matching methods can be used as iterator (duck typing)
private class Int64KeyIterator<T>extends Int64MapIteratorBase<T> {

    public function new( data : IntMap< IntMap< T>>) : Void {
        super(data);
    };

    /**
        Returns the current item of the Iterator and advances to the next one.

        This method is not required to check hasNext() first. A call to this
        method while hasNext() is false yields unspecified behavior.
    **/
    public function next() : Int64 {
        if( hasNext()) {
            return Int64.make( CurrentHi, LoIterator.next());
        } else {
            throw "no more elements";
        }
    }
}


// internal helper class for Int64Map<T>
// all class with matching methods can be used as iterator (duck typing)
private class Int64ValueIterator<T> extends Int64MapIteratorBase<T> {

    public function new( data : IntMap< IntMap< T>>) : Void {
        super(data);
    };

    /**
        Returns the current item of the Iterator and advances to the next one.

        This method is not required to check hasNext() first. A call to this
        method while hasNext() is false yields unspecified behavior.
    **/
    public function next() : T {
        if( hasNext()) {
            return SubMaps.get(CurrentHi).get(LoIterator.next());
        } else {
            throw "no more elements";
        }
    }
}


// EOF
