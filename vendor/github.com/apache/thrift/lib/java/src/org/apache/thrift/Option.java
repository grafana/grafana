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

package org.apache.thrift;

/**
 * Implementation of the Option type pattern
 */
public abstract class Option<T> {

    /**
     * Whether the Option is defined or not
     * @return
     *         true if the Option is defined (of type Some)
     *         false if the Option is not defined (of type None)
     */
    public abstract boolean isDefined();

    /**
     * Get the value of the Option (if it is defined)
     * @return the value
     * @throws IllegalStateException if called on a None
     */
    public abstract T get();

    /**
     * Get the contained value (if defined) or else return a default value
     * @param other what to return if the value is not defined (a None)
     * @return either the value, or other if the value is not defined
     */
    public T or(T other) {
        if (isDefined()) {
            return get();
        } else {
            return other;
        }
    }
    /**
     * The None type, representing an absent value (instead of "null")
     */
    public static class None<T> extends Option<T> {
        public boolean isDefined() {
            return false;
        }

        public T get() {
            throw new IllegalStateException("Cannot call get() on None");
        }

        public String toString() {
            return "None";
        }
    }

    /**
     * The Some type, representing an existence of some value
     * @param <T> The type of value
     */
    public static class Some<T> extends Option<T> {
        private final T value;
        public Some(T value) {
            this.value = value;
        }

        public boolean isDefined() {
            return true;
        }

        public T get() {
            return value;
        }

        public String toString() {
            return "Some("+value.toString()+")";
        }
    }

    /**
     * Wraps value in an Option type, depending on whether or not value is null
     * @param value
     * @param <T> type of value
     * @return Some(value) if value is not null, None if value is null
     */
    public static <T> Option<T> fromNullable(T value) {
        if (value != null) {
            return new Some<T>(value);
        } else {
            return new None<T>();
        }
    }

    /**
     * Wrap value in a Some type (NB! value must not be null!)
     * @param value
     * @param <T> type of value
     * @return a new Some(value)
     */
    public static <T> Some<T> some(T value) {
        return new Some<T>(value);
    }

    public static <T> None<T> none() {
        return new None<T>();
    }
}