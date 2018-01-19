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
 * This mojo executes the {@code thrift} compiler for generating java sources
 * from thrift definitions. It also searches dependency artifacts for
 * thrift files and includes them in the thriftPath so that they can be
 * referenced. Finally, it adds the thrift files to the project as resources so
 * that they are included in the final artifact.
 *
 * @phase generate-sources
 * @goal compile
 * @requiresDependencyResolution compile
 */
public final class ThriftCompileMojo extends AbstractThriftMojo {

    /**
     * The source directories containing the sources to be compiled.
     *
     * @parameter default-value="${basedir}/src/main/thrift"
     * @required
     */
    private File thriftSourceRoot;

    /**
     * This is the directory into which the {@code .java} will be created.
     *
     * @parameter default-value="${project.build.directory}/generated-sources/thrift"
     * @required
     */
    private File outputDirectory;

    @Override
    protected List<Artifact> getDependencyArtifacts() {
        List<Artifact> compileArtifacts = project.getCompileArtifacts();
        return compileArtifacts;
    }

    @Override
    protected File getOutputDirectory() {
        return outputDirectory;
    }

    @Override
    protected File getThriftSourceRoot() {
        return thriftSourceRoot;
    }

    @Override
    protected void attachFiles() {
        project.addCompileSourceRoot(outputDirectory.getAbsolutePath());
        projectHelper.addResource(project, thriftSourceRoot.getAbsolutePath(),
        		ImmutableList.of("**/*.thrift"), null);
    }
}
