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

package com.facebook.fb303;

import java.util.AbstractMap;
import java.util.HashMap;
import java.util.concurrent.ConcurrentHashMap;

public abstract class FacebookBase implements FacebookService.Iface {

  private String name_;

  private long alive_;

  private final ConcurrentHashMap<String,Long> counters_ =
    new ConcurrentHashMap<String, Long>();

  private final ConcurrentHashMap<String,String> options_ =
    new ConcurrentHashMap<String, String>();

  protected FacebookBase(String name) {
    name_ = name;
    alive_ = System.currentTimeMillis() / 1000;
  }

  public String getName() {
    return name_;
  }

  public abstract fb_status getStatus();

  public String getStatusDetails() {
    return "";
  }

  public void deleteCounter(String key) {
    counters_.remove(key);
  }

  public void resetCounter(String key) {
    counters_.put(key, 0L);
  }

  public long incrementCounter(String key) {
    long val = getCounter(key) + 1;
    counters_.put(key, val);
    return val;
  }

  public long incrementCounter(String key, long increment) {
    long val = getCounter(key) + increment;
    counters_.put(key, val);
    return val;
  }

  public long setCounter(String key, long value) {
    counters_.put(key, value);
    return value;
  }

  public AbstractMap<String,Long> getCounters() {
    return counters_;
  }

  public long getCounter(String key) {
    Long val = counters_.get(key);
    if (val == null) {
      return 0;
    }
    return val.longValue();
  }

  public void setOption(String key, String value) {
    options_.put(key, value);
  }

  public String getOption(String key) {
    return options_.get(key);
  }

  public AbstractMap<String,String> getOptions() {
    return options_;
  }

  public long aliveSince() {
    return alive_;
  }

  public String getCpuProfile() {
    return "";
  }

  public void reinitialize() {}

  public void shutdown() {}

}
