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
package org.apache.thrift.maven;

import org.codehaus.plexus.util.FileUtils;
import org.codehaus.plexus.util.cli.CommandLineException;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import java.io.File;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

public class TestThrift {

    private File testRootDir;
    private File idlDir;
    private File genJavaDir;
    private Thrift.Builder builder;

    @Before
    public void setup() throws Exception {
        final File tmpDir = new File(System.getProperty("java.io.tmpdir"));
        testRootDir = new File(tmpDir, "thrift-test");

        if (testRootDir.exists()) {
            FileUtils.cleanDirectory(testRootDir);
        } else {
            assertTrue("Failed to create output directory for test: " + testRootDir.getPath(), testRootDir.mkdir());
        }

        File testResourceDir = new File("src/test/resources");
        assertTrue("Unable to find test resources", testRootDir.exists());

        String thriftExecutable = System.getProperty("thriftExecutable", "thrift");
        if (!(new File(thriftExecutable).exists())) {
            thriftExecutable = "thrift";
        }
        System.out.println("Thrift compiler: " + thriftExecutable);

        idlDir = new File(testResourceDir, "idl");
        genJavaDir = new File(testRootDir, Thrift.GENERATED_JAVA);
        builder = new Thrift.Builder(thriftExecutable, testRootDir);
        builder
            .setGenerator("java")
            .addThriftPathElement(idlDir);
    }

    @Test
    public void testThriftCompile() throws Exception {
        executeThriftCompile();
    }

    @Test
    public void testThriftCompileWithGeneratorOption() throws Exception {
        builder.setGenerator("java:private-members");
        executeThriftCompile();
    }

    private void executeThriftCompile() throws CommandLineException {
        final File thriftFile = new File(idlDir, "shared.thrift");

        builder.addThriftFile(thriftFile);

        final Thrift thrift = builder.build();

        assertTrue("File not found: shared.thrift", thriftFile.exists());
        assertFalse("gen-java directory should not exist", genJavaDir.exists());

        // execute the compile
        final int result = thrift.compile();
        assertEquals(0, result);

        assertFalse("gen-java directory was not removed", genJavaDir.exists());
        assertTrue("generated java code doesn't exist",
            new File(testRootDir, "shared/SharedService.java").exists());
    }

    @Test
    public void testThriftMultipleFileCompile() throws Exception {
        final File sharedThrift = new File(idlDir, "shared.thrift");
        final File tutorialThrift = new File(idlDir, "tutorial.thrift");

        builder.addThriftFile(sharedThrift);
        builder.addThriftFile(tutorialThrift);

        final Thrift thrift = builder.build();

        assertTrue("File not found: shared.thrift", sharedThrift.exists());
        assertFalse("gen-java directory should not exist", genJavaDir.exists());

        // execute the compile
        final int result = thrift.compile();
        assertEquals(0, result);

        assertFalse("gen-java directory was not removed", genJavaDir.exists());
        assertTrue("generated java code doesn't exist",
            new File(testRootDir, "shared/SharedService.java").exists());
        assertTrue("generated java code doesn't exist",
            new File(testRootDir, "tutorial/InvalidOperation.java").exists());
    }

    @Test
    public void testBadCompile() throws Exception {
        final File thriftFile = new File(testRootDir, "missing.thrift");
        builder.addThriftPathElement(testRootDir);

        // Hacking around checks in addThrift file.
        assertTrue(thriftFile.createNewFile());
        builder.addThriftFile(thriftFile);
        assertTrue(thriftFile.delete());

        final Thrift thrift = builder.build();

        assertTrue(!thriftFile.exists());
        assertFalse("gen-java directory should not exist", genJavaDir.exists());

        // execute the compile
        final int result = thrift.compile();
        assertEquals(1, result);
    }

    @Test
    public void testFileInPathPreCondition() throws Exception {
        final File thriftFile = new File(testRootDir, "missing.thrift");

        // Hacking around checks in addThrift file.
        assertTrue(thriftFile.createNewFile());
        try {
            builder.addThriftFile(thriftFile);
            fail("Expected IllegalStateException");
        } catch (IllegalStateException e) {
        }
    }

    @After
    public void cleanup() throws Exception {
        if (testRootDir.exists()) {
            FileUtils.cleanDirectory(testRootDir);
            assertTrue("Failed to delete output directory for test: " + testRootDir.getPath(), testRootDir.delete());
        }
    }
}
