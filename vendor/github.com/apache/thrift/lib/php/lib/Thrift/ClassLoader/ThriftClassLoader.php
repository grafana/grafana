<?php
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
 *
 * ClassLoader to load Thrift library and definitions
 * Inspired from UniversalClassLoader from Symfony 2
 *
 * @package thrift.classloader
 */

namespace Thrift\ClassLoader;

class ThriftClassLoader
{
    /**
     * Namespaces path
     * @var array
     */
    protected $namespaces = array();

    /**
     * Thrift definition paths
     * @var type
     */
    protected $definitions = array();

    /**
     * Do we use APC cache ?
     * @var boolean
     */
    protected $apc = false;

    /**
     * APC Cache prefix
     * @var string
     */
    protected $apc_prefix;

    /**
     * Set autoloader to use APC cache
     * @param boolean $apc
     * @param string  $apc_prefix
     */
    public function __construct($apc = false, $apc_prefix = null)
    {
        $this->apc = $apc;
        $this->apc_prefix = $apc_prefix;
    }

    /**
     * Registers a namespace.
     *
     * @param string       $namespace The namespace
     * @param array|string $paths     The location(s) of the namespace
     */
    public function registerNamespace($namespace, $paths)
    {
        $this->namespaces[$namespace] = (array) $paths;
    }

    /**
     * Registers a Thrift definition namespace.
     *
     * @param string       $namespace The definition namespace
     * @param array|string $paths     The location(s) of the definition namespace
     */
    public function registerDefinition($namespace, $paths)
    {
        $this->definitions[$namespace] = (array) $paths;
    }

    /**
     * Registers this instance as an autoloader.
     *
     * @param Boolean $prepend Whether to prepend the autoloader or not
     */
    public function register($prepend = false)
    {
        spl_autoload_register(array($this, 'loadClass'), true, $prepend);
    }

    /**
     * Loads the given class, definition or interface.
     *
     * @param string $class The name of the class
     */
    public function loadClass($class)
    {
        if (
            (true === $this->apc && ($file = $this->findFileInApc($class))) or
            ($file = $this->findFile($class))
        )
        {
            require_once $file;
        }
    }

    /**
     * Loads the given class or interface in APC.
     * @param  string $class The name of the class
     * @return string
     */
    protected function findFileInApc($class)
    {
        if (false === $file = apc_fetch($this->apc_prefix.$class)) {
            apc_store($this->apc_prefix.$class, $file = $this->findFile($class));
        }

        return $file;
    }

    /**
     * Find class in namespaces or definitions directories
     * @param  string $class
     * @return string
     */
    public function findFile($class)
    {
        // Remove first backslash
        if ('\\' == $class[0]) {
            $class = substr($class, 1);
        }

        if (false !== $pos = strrpos($class, '\\')) {
            // Namespaced class name
            $namespace = substr($class, 0, $pos);

            // Iterate in normal namespaces
            foreach ($this->namespaces as $ns => $dirs) {
                //Don't interfere with other autoloaders
                if (0 !== strpos($namespace, $ns)) {
                    continue;
                }

                foreach ($dirs as $dir) {
                    $className = substr($class, $pos + 1);

                    $file = $dir.DIRECTORY_SEPARATOR.
                                 str_replace('\\', DIRECTORY_SEPARATOR, $namespace).
                                 DIRECTORY_SEPARATOR.
                                 $className.'.php';

                    if (file_exists($file)) {
                        return $file;
                    }
                }
            }

            // Iterate in Thrift namespaces

            // Remove first part of namespace
            $m = explode('\\', $class);

            // Ignore wrong call
            if (count($m) <= 1) {
                return;
            }

            $class = array_pop($m);
            $namespace = implode('\\', $m);

            foreach ($this->definitions as $ns => $dirs) {
                //Don't interfere with other autoloaders
                if (0 !== strpos($namespace, $ns)) {
                    continue;
                }

                foreach ($dirs as $dir) {
                    /**
                     * Available in service: Interface, Client, Processor, Rest
                     * And every service methods (_.+)
                     */
                    if(
                        0 === preg_match('#(.+)(if|client|processor|rest)$#i', $class, $n) and
                        0 === preg_match('#(.+)_[a-z0-9]+_(args|result)$#i', $class, $n)
                    )
                    {
                        $className = 'Types';
                    } else {
                        $className = $n[1];
                    }

                    $file = $dir.DIRECTORY_SEPARATOR .
                                 str_replace('\\', DIRECTORY_SEPARATOR, $namespace) .
                                 DIRECTORY_SEPARATOR .
                                 $className . '.php';

                    if (file_exists($file)) {
                        return $file;
                    }
                }
            }
        }
    }
}
