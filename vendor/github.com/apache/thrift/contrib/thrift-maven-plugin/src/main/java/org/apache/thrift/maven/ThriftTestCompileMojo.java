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

import java.io.File;
import java.util.List;
import org.apache.maven.artifact.Artifact;
import com.google.common.collect.ImmutableList;

/**
 * @phase generate-test-sources
 * @goal testCompile
 * @requiresDependencyResolution test
 */
public final class ThriftTestCompileMojo extends AbstractThriftMojo {

    /**
     * The source directories containing the sources to be compiled.
     *
     * @parameter default-value="${basedir}/src/test/thrift"
     * @required
     */
    private File thriftTestSourceRoot;

    /**
     * This is the directory into which the {@code .java} will be created.
     *
     * @parameter default-value="${project.build.directory}/generated-test-sources/thrift"
     * @required
     */
    private File outputDirectory;

    @Override
    protected void attachFiles() {
        project.addTestCompileSourceRoot(outputDirectory.getAbsolutePath());
        projectHelper.addTestResource(project, thriftTestSourceRoot.getAbsolutePath(),
        		ImmutableList.of("**/*.thrift"), null);
    }

    @Override
    protected List<Artifact> getDependencyArtifacts() {
        // TODO(gak): maven-project needs generics
        @SuppressWarnings("unchecked")
        List<Artifact> testArtifacts = project.getTestArtifacts();
        return testArtifacts;
    }

    @Override
    protected File getOutputDirectory() {
        return outputDirectory;
    }

    @Override
    protected File getThriftSourceRoot() {
        return thriftTestSourceRoot;
    }
}
