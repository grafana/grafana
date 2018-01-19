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
module thrift.internal.resource_pool;

import core.time : Duration, dur, TickDuration;
import std.algorithm : minPos, reduce, remove;
import std.array : array, empty;
import std.exception : enforce;
import std.conv : to;
import std.random : randomCover, rndGen;
import std.range : zip;
import thrift.internal.algorithm : removeEqual;

/**
 * A pool of resources, which can be iterated over, and where resources that
 * have failed too often can be temporarily disabled.
 *
 * This class is oblivious to the actual resource type managed.
 */
final class TResourcePool(Resource) {
  /**
   * Constructs a new instance.
   *
   * Params:
   *   resources = The initial members of the pool.
   */
  this(Resource[] resources) {
    resources_ = resources;
  }

  /**
   * Adds a resource to the pool.
   */
  void add(Resource resource) {
    resources_ ~= resource;
  }

  /**
   * Removes a resource from the pool.
   *
   * Returns: Whether the resource could be found in the pool.
   */
  bool remove(Resource resource) {
    auto oldLength = resources_.length;
    resources_ = removeEqual(resources_, resource);
    return resources_.length < oldLength;
  }

  /**
   * Returns an »enriched« input range to iterate over the pool members.
   */
  static struct Range {
    /**
     * Whether the range is empty.
     *
     * This is the case if all members of the pool have been popped (or skipped
     * because they were disabled) and TResourcePool.cycle is false, or there
     * is no element to return in cycle mode because all have been temporarily
     * disabled.
     */
    bool empty() @property {
      // If no resources are in the pool, the range will never become non-empty.
      if (resources_.empty) return true;

      // If we already got the next resource in the cache, it doesn't matter
      // whether there are more.
      if (cached_) return false;

      size_t examineCount;
      if (parent_.cycle) {
        // We want to check all the resources, but not iterate more than once
        // to avoid spinning in a loop if nothing is available.
        examineCount = resources_.length;
      } else {
        // When not in cycle mode, we just iterate the list exactly once. If all
        // items have been consumed, the interval below is empty.
        examineCount = resources_.length - nextIndex_;
      }

      foreach (i; 0 .. examineCount) {
        auto r = resources_[(nextIndex_ + i) % resources_.length];
        auto fi = r in parent_.faultInfos_;

        if (fi && fi.resetTime != fi.resetTime.init) {
          if (fi.resetTime < parent_.getCurrentTick_()) {
            // The timeout expired, remove the resource from the list and go
            // ahead trying it.
            parent_.faultInfos_.remove(r);
          } else {
            // The timeout didn't expire yet, try the next resource.
            continue;
          }
        }

        cache_ = r;
        cached_ = true;
        nextIndex_ = nextIndex_ + i + 1;
        return false;
      }

      // If we get here, all resources are currently inactive or the non-cycle
      // pool has been exhausted, so there is nothing we can do.
      nextIndex_ = nextIndex_ + examineCount;
      return true;
    }

    /**
     * Returns the first resource in the range.
     */
    Resource front() @property {
      enforce(!empty);
      return cache_;
    }

    /**
     * Removes the first resource from the range.
     *
     * Usually, this is combined with a call to TResourcePool.recordSuccess()
     * or recordFault().
     */
    void popFront() {
      enforce(!empty);
      cached_ = false;
    }

    /**
     * Returns whether the range will become non-empty at some point in the
     * future, and provides additional information when this will happen and
     * what will be the next resource.
     *
     * Makes only sense to call on empty ranges.
     *
     * Params:
     *   next = The next resource that will become available.
     *   waitTime = The duration until that resource will become available.
     */
    bool willBecomeNonempty(out Resource next, out Duration waitTime) {
      // If no resources are in the pool, the range will never become non-empty.
      if (resources_.empty) return false;

      // If cycle mode is not enabled, a range never becomes non-empty after
      // being empty once, because all the elements have already been
      // used/skipped in order to become empty.
      if (!parent_.cycle) return false;

      auto fi = parent_.faultInfos_;
      auto nextPair = minPos!"a[1].resetTime < b[1].resetTime"(
        zip(fi.keys, fi.values)
      ).front;

      next = nextPair[0];
      waitTime = to!Duration(nextPair[1].resetTime - parent_.getCurrentTick_());

      return true;
    }

  private:
    this(TResourcePool parent, Resource[] resources) {
      parent_ = parent;
      resources_ = resources;
    }

    TResourcePool parent_;

    /// All available resources. We keep a copy of it as to not get confused
    /// when resources are added to/removed from the parent pool.
    Resource[] resources_;

    /// After we have determined the next element in empty(), we store it here.
    Resource cache_;

    /// Whether there is currently something in the cache.
    bool cached_;

    /// The index to start searching from at the next call to empty().
    size_t nextIndex_;
  }

  /// Ditto
  Range opSlice() {
    auto res = resources_;
    if (permute) {
      res = array(randomCover(res, rndGen));
    }
    return Range(this, res);
  }

  /**
   * Records a success for an operation on the given resource, cancelling a
   * fault streak, if any.
   */
  void recordSuccess(Resource resource) {
    if (resource in faultInfos_) {
      faultInfos_.remove(resource);
    }
  }

  /**
   * Records a fault for the given resource.
   *
   * If a resource fails consecutively for more than faultDisableCount times,
   * it is temporarily disabled (no longer considered) until
   * faultDisableDuration has passed.
   */
  void recordFault(Resource resource) {
    auto fi = resource in faultInfos_;

    if (!fi) {
      faultInfos_[resource] = FaultInfo();
      fi = resource in faultInfos_;
    }

    ++fi.count;
    if (fi.count >= faultDisableCount) {
      // If the resource has hit the fault count limit, disable it for
      // specified duration.
      fi.resetTime = getCurrentTick_() + cast(TickDuration)faultDisableDuration;
    }
  }

  /**
   * Whether to randomly permute the order of the resources in the pool when
   * taking a range using opSlice().
   *
   * This can be used e.g. as a simple form of load balancing.
   */
  bool permute = true;

  /**
   * Whether to keep iterating over the pool members after all have been
   * returned/have failed once.
   */
  bool cycle = false;

  /**
   * The number of consecutive faults after which a resource is disabled until
   * faultDisableDuration has passed. Zero to never disable resources.
   *
   * Defaults to zero.
   */
  ushort faultDisableCount = 0;

  /**
   * The duration for which a resource is no longer considered after it has
   * failed too often.
   *
   * Defaults to one second.
   */
  Duration faultDisableDuration = dur!"seconds"(1);

private:
  Resource[] resources_;
  FaultInfo[Resource] faultInfos_;

  /// Function to get the current timestamp from some monotonic system clock.
  ///
  /// This is overridable to be able to write timing-insensitive unit tests.
  /// The extra indirection should not matter much performance-wise compared to
  /// the actual system call, and by its very nature thisshould not be on a hot
  /// path anyway.
  typeof(&TickDuration.currSystemTick) getCurrentTick_ =
    &TickDuration.currSystemTick;
}

private {
  struct FaultInfo {
    ushort count;
    TickDuration resetTime;
  }
}

unittest {
  auto pool = new TResourcePool!Object([]);
  enforce(pool[].empty);
  Object dummyRes;
  Duration dummyDur;
  enforce(!pool[].willBecomeNonempty(dummyRes, dummyDur));
}

unittest {
  import std.datetime;
  import thrift.base;

  auto a = new Object;
  auto b = new Object;
  auto c = new Object;
  auto objs = [a, b, c];
  auto pool = new TResourcePool!Object(objs);
  pool.permute = false;

  static Duration fakeClock;
  pool.getCurrentTick_ = () => cast(TickDuration)fakeClock;

  Object dummyRes = void;
  Duration dummyDur = void;

  {
    auto r = pool[];

    foreach (i, o; objs) {
      enforce(!r.empty);
      enforce(r.front == o);
      r.popFront();
    }

    enforce(r.empty);
    enforce(!r.willBecomeNonempty(dummyRes, dummyDur));
  }

  {
    pool.faultDisableCount = 2;

    enforce(pool[].front == a);
    pool.recordFault(a);
    enforce(pool[].front == a);
    pool.recordSuccess(a);
    enforce(pool[].front == a);
    pool.recordFault(a);
    enforce(pool[].front == a);
    pool.recordFault(a);

    auto r = pool[];
    enforce(r.front == b);
    r.popFront();
    enforce(r.front == c);
    r.popFront();
    enforce(r.empty);
    enforce(!r.willBecomeNonempty(dummyRes, dummyDur));

    fakeClock += 2.seconds;
    // Not in cycle mode, has to be still empty after the timeouts expired.
    enforce(r.empty);
    enforce(!r.willBecomeNonempty(dummyRes, dummyDur));

    foreach (o; objs) pool.recordSuccess(o);
  }

  {
    pool.faultDisableCount = 1;

    pool.recordFault(a);
    pool.recordFault(b);
    pool.recordFault(c);

    auto r = pool[];
    enforce(r.empty);
    enforce(!r.willBecomeNonempty(dummyRes, dummyDur));

    foreach (o; objs) pool.recordSuccess(o);
  }

  pool.cycle = true;

  {
    auto r = pool[];

    foreach (o; objs ~ objs) {
      enforce(!r.empty);
      enforce(r.front == o);
      r.popFront();
    }
  }

  {
    pool.faultDisableCount = 2;

    enforce(pool[].front == a);
    pool.recordFault(a);
    enforce(pool[].front == a);
    pool.recordSuccess(a);
    enforce(pool[].front == a);
    pool.recordFault(a);
    enforce(pool[].front == a);
    pool.recordFault(a);

    auto r = pool[];
    enforce(r.front == b);
    r.popFront();
    enforce(r.front == c);
    r.popFront();
    enforce(r.front == b);

    fakeClock += 2.seconds;

    r.popFront();
    enforce(r.front == c);

    r.popFront();
    enforce(r.front == a);

    enforce(pool[].front == a);

    foreach (o; objs) pool.recordSuccess(o);
  }

  {
    pool.faultDisableCount = 1;

    pool.recordFault(a);
    fakeClock += 1.msecs;
    pool.recordFault(b);
    fakeClock += 1.msecs;
    pool.recordFault(c);

    auto r = pool[];
    enforce(r.empty);

    // Make sure willBecomeNonempty gets the order right.
    enforce(r.willBecomeNonempty(dummyRes, dummyDur));
    enforce(dummyRes == a);
    enforce(dummyDur > Duration.zero);

    foreach (o; objs) pool.recordSuccess(o);
  }
}
