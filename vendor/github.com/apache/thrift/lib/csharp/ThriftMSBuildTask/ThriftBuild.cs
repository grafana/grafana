/**
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
 *
 * Contains some contributions under the Thrift Software License.
 * Please see doc/old-thrift-license.txt in the Thrift distribution for
 * details.
 */

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Microsoft.Build.Framework;
using Microsoft.Build.Utilities;
using Microsoft.Build.Tasks;
using System.IO;
using System.Diagnostics;

namespace ThriftMSBuildTask
{
    /// <summary>
    /// MSBuild Task to generate csharp from .thrift files, and compile the code into a library: ThriftImpl.dll
    /// </summary>
    public class ThriftBuild : Task
    {
        /// <summary>
        /// The full path to the thrift.exe compiler
        /// </summary>
        [Required]
        public ITaskItem ThriftExecutable
        {
            get;
            set;
        }

        /// <summary>
        /// The full path to a thrift.dll C# library
        /// </summary>
        [Required]
        public ITaskItem ThriftLibrary
        {
            get;
            set;
        }

        /// <summary>
        /// A direcotry containing .thrift files
        /// </summary>
        [Required]
        public ITaskItem ThriftDefinitionDir
        {
            get;
            set;
        }

        /// <summary>
        /// The name of the auto-gen and compiled thrift library. It will placed in
        /// the same directory as ThriftLibrary
        /// </summary>
        [Required]
        public ITaskItem OutputName
        {
            get;
            set;
        }

        /// <summary>
        /// The full path to the compiled ThriftLibrary. This allows msbuild tasks to use this
        /// output as a variable for use elsewhere.
        /// </summary>
        [Output]
        public ITaskItem ThriftImplementation
        {
            get { return thriftImpl; }
        }

        private ITaskItem thriftImpl;
        private const string lastCompilationName = "LAST_COMP_TIMESTAMP";

        //use the Message Build Task to write something to build log
        private void LogMessage(string text, MessageImportance importance)
        {
            Message m = new Message();
            m.Text = text;
            m.Importance = importance.ToString();
            m.BuildEngine = this.BuildEngine;
            m.Execute();
        }

        //recursively find .cs files in srcDir, paths should initially be non-null and empty
        private void FindSourcesHelper(string srcDir, List<string> paths)
        {
            string[] files = Directory.GetFiles(srcDir, "*.cs");
            foreach (string f in files)
            {
                paths.Add(f);
            }
            string[] dirs = Directory.GetDirectories(srcDir);
            foreach (string dir in dirs)
            {
                FindSourcesHelper(dir, paths);
            }
        }

        /// <summary>
        /// Quote paths with spaces
        /// </summary>
        private string SafePath(string path)
        {
            if (path.Contains(' ') && !path.StartsWith("\""))
            {
                return "\"" + path + "\"";
            }
            return path;
        }

        private ITaskItem[] FindSources(string srcDir)
        {
            List<string> files = new List<string>();
            FindSourcesHelper(srcDir, files);
            ITaskItem[] items = new ITaskItem[files.Count];
            for (int i = 0; i < items.Length; i++)
            {
                items[i] = new TaskItem(files[i]);
            }
            return items;
        }

        private string LastWriteTime(string defDir)
        {
            string[] files = Directory.GetFiles(defDir, "*.thrift");
            DateTime d = (new DirectoryInfo(defDir)).LastWriteTime;
            foreach(string file in files)
            {
                FileInfo f = new FileInfo(file);
                DateTime curr = f.LastWriteTime;
                if (DateTime.Compare(curr, d) > 0)
                {
                    d = curr;
                }
            }
            return d.ToFileTimeUtc().ToString();
        }

        public override bool Execute()
        {
            string defDir = SafePath(ThriftDefinitionDir.ItemSpec);
            //look for last compilation timestamp
            string lastBuildPath = Path.Combine(defDir, lastCompilationName);
            DirectoryInfo defDirInfo = new DirectoryInfo(defDir);
            string lastWrite = LastWriteTime(defDir);
            if (File.Exists(lastBuildPath))
            {
                string lastComp = File.ReadAllText(lastBuildPath);
                //don't recompile if the thrift library has been updated since lastComp
                FileInfo f = new FileInfo(ThriftLibrary.ItemSpec);
                string thriftLibTime = f.LastWriteTimeUtc.ToFileTimeUtc().ToString();
                if (lastComp.CompareTo(thriftLibTime) < 0)
                {
                    //new thrift library, do a compile
                    lastWrite = thriftLibTime;
                }
                else if (lastComp == lastWrite || (lastComp == thriftLibTime && lastComp.CompareTo(lastWrite) > 0))
                {
                    //the .thrift dir hasn't been written to since last compilation, don't need to do anything
                    LogMessage("ThriftImpl up-to-date", MessageImportance.High);
                    return true;
                }
            }

            //find the directory of the thriftlibrary (that's where output will go)
            FileInfo thriftLibInfo = new FileInfo(SafePath(ThriftLibrary.ItemSpec));
            string thriftDir = thriftLibInfo.Directory.FullName;

            string genDir = Path.Combine(thriftDir, "gen-csharp");
            if (Directory.Exists(genDir))
            {
                try
                {
                    Directory.Delete(genDir, true);
                }
                catch { /*eh i tried, just over-write now*/}
            }

            //run the thrift executable to generate C#
            foreach (string thriftFile in Directory.GetFiles(defDir, "*.thrift"))
            {
                LogMessage("Generating code for: " + thriftFile, MessageImportance.Normal);
                Process p = new Process();
                p.StartInfo.FileName = SafePath(ThriftExecutable.ItemSpec);
                p.StartInfo.Arguments = "--gen csharp -o " + SafePath(thriftDir) + " -r " + thriftFile;
                p.StartInfo.UseShellExecute = false;
                p.StartInfo.CreateNoWindow = true;
                p.StartInfo.RedirectStandardOutput = false;
                p.Start();
                p.WaitForExit();
                if (p.ExitCode != 0)
                {
                    LogMessage("thrift.exe failed to compile " + thriftFile, MessageImportance.High);
                    return false;
                }
                if (p.ExitCode != 0)
                {
                    LogMessage("thrift.exe failed to compile " + thriftFile, MessageImportance.High);
                    return false;
                }
            }

            Csc csc = new Csc();
            csc.TargetType = "library";
            csc.References = new ITaskItem[] { new TaskItem(ThriftLibrary.ItemSpec) };
            csc.EmitDebugInformation = true;
            string outputPath = Path.Combine(thriftDir, OutputName.ItemSpec);
            csc.OutputAssembly = new TaskItem(outputPath);
            csc.Sources = FindSources(Path.Combine(thriftDir, "gen-csharp"));
            csc.BuildEngine = this.BuildEngine;
            LogMessage("Compiling generated cs...", MessageImportance.Normal);
            if (!csc.Execute())
            {
                return false;
            }

            //write file to defDir to indicate a build was successfully completed
            File.WriteAllText(lastBuildPath, lastWrite);

            thriftImpl = new TaskItem(outputPath);

            return true;
        }
    }
}
