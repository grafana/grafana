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

import junit.framework.TestCase;
import org.apache.thrift.Option;

// Tests and documents behavior for the "Option<T>" type
public class TestOptionType extends TestCase {
    public void testSome() throws Exception {
        String name = "Chuck Norris";
        Option<String> option = Option.fromNullable(name);

        assertTrue(option instanceof Option.Some);
        assertTrue(option.isDefined());
        assertEquals("Some(Chuck Norris)", option.toString());
        assertEquals(option.or("default value"), "Chuck Norris");
        assertEquals(option.get(),"Chuck Norris");
    }

    public void testNone() throws Exception {
        String name = null;
        Option<String> option = Option.fromNullable(name);

        assertTrue(option instanceof Option.None);
        assertFalse(option.isDefined());
        assertEquals("None", option.toString());
        assertEquals(option.or("default value"), "default value");
        // Expect exception
        try {
            Object value = option.get();
            fail("Expected IllegalStateException, got no exception");
        } catch (IllegalStateException ex) {

        } catch(Exception ex) {
            fail("Expected IllegalStateException, got some other exception: "+ex.toString());
        }
    }

    public void testMakeSome() throws Exception {
        Option<String> some = Option.some("wee");
        assertTrue(some instanceof Option.Some);
    }

    public void testMakeNone() throws Exception {
        Option<Integer> none = Option.none();
        assertTrue(none instanceof Option.None);
    }
}
