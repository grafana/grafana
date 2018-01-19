//To build dist/thrift.js, dist/thrift.min.js and doc/*
//run grunt at the command line in this directory.
//Prerequisites:
// Node Setup -   nodejs.org
// Grunt Setup -  npm install  //reads the ./package.json and installs project dependencies

module.exports = function(grunt) {
  'use strict';

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      options: {
        separator: ';'
      },
      dist: {
        src: ['src/**/*.js'],
        dest: 'dist/<%= pkg.name %>.js'
      }
    },
    jsdoc : {
        dist : {
            src: ['src/*.js', './README.md'],
            options: {
              destination: 'doc'
            }
        }
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("dd-mm-yyyy") %> */\n'
      },
      dist: {
        files: {
          'dist/<%= pkg.name %>.min.js': ['<%= concat.dist.dest %>']
        }
      }
    },
    shell: {
      InstallThriftJS: {
        command: 'mkdir test/build; mkdir test/build/js; cp src/thrift.js test/build/js/thrift.js'
      },
      InstallThriftNodeJSDep: {
        command: 'cd ../..; npm install'
      },
      ThriftGen: {
        command: '../../compiler/cpp/thrift -gen js -gen js:node -o test ../../test/ThriftTest.thrift'
      },
      ThriftGenJQ: {
        command: '../../compiler/cpp/thrift -gen js:jquery -gen js:node -o test ../../test/ThriftTest.thrift'
      },
      ThriftGenDeepConstructor: {
        command: '../../compiler/cpp/thrift -gen js -o test ../../test/JsDeepConstructorTest.thrift'
      }
    },
    external_daemon: {
      ThriftTestServer: {
        options: {
          startCheck: function(stdout, stderr) {
            return (/Thrift Server running on port/).test(stdout);
          },
          nodeSpawnOptions: {
                              cwd: "test",
                              env: {NODE_PATH: "../../nodejs/lib:../../../node_modules"}
                            }
        },
        cmd: "node",
        args: ["server_http.js"]
      },
      ThriftTestServer_TLS: {
        options: {
          startCheck: function(stdout, stderr) {
            return (/Thrift Server running on port/).test(stdout);
          },
          nodeSpawnOptions: {
                              cwd: "test",
                              env: {NODE_PATH: "../../nodejs/lib:../../../node_modules"}
                            }
        },
        cmd: "node",
        args: ["server_https.js"]
      }
    },
    qunit: {
      ThriftJS: {
        options: {
          urls: [
            'http://localhost:8088/test-nojq.html'
          ]
        }
      },
      ThriftJSJQ: {
        options: {
          urls: [
            'http://localhost:8088/test.html'
          ]
        }
      },
      ThriftWS: {
        options: {
          urls: [
            'http://localhost:8088/testws.html'
          ]
        }
      },
      ThriftJS_TLS: {
        options: {
          '--ignore-ssl-errors': true,
          urls: [
            'https://localhost:8089/test-nojq.html'
          ]
        }
      },
      ThriftJSJQ_TLS: {
        options: {
          '--ignore-ssl-errors': true,
          urls: [
            'https://localhost:8089/test.html'
          ]
        }
      },
      ThriftWS_TLS: {
        options: {
          '--ignore-ssl-errors': true,
          urls: [
            'https://localhost:8089/testws.html'
          ]
        }
      },
      ThriftDeepConstructor: {
        options: {
          urls: [
            'http://localhost:8088/test-deep-constructor.html'
          ]
        }
      }
    },
    jshint: {
      files: ['Gruntfile.js', 'src/**/*.js', 'test/*.js'],
      options: {
        // options here to override JSHint defaults
        globals: {
          jQuery: true,
          console: true,
          module: true,
          document: true
        }
      }
    },
  });

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-jsdoc');
  grunt.loadNpmTasks('grunt-external-daemon');
  grunt.loadNpmTasks('grunt-shell');

  grunt.registerTask('test', ['jshint', 'shell:InstallThriftJS', 'shell:InstallThriftNodeJSDep', 'shell:ThriftGen',
                              'external_daemon:ThriftTestServer', 'external_daemon:ThriftTestServer_TLS',
                              'shell:ThriftGenDeepConstructor', 'qunit:ThriftDeepConstructor',
                              'qunit:ThriftJS', 'qunit:ThriftJS_TLS',
                              'shell:ThriftGenJQ', 'qunit:ThriftJSJQ', 'qunit:ThriftJSJQ_TLS'
                             ]);
  grunt.registerTask('default', ['jshint', 'shell:InstallThriftJS', 'shell:InstallThriftNodeJSDep', 'shell:ThriftGen',
                                 'external_daemon:ThriftTestServer', 'external_daemon:ThriftTestServer_TLS',
                                 'qunit:ThriftJS', 'qunit:ThriftJS_TLS',
                                 'shell:ThriftGenJQ', 'qunit:ThriftJSJQ', 'qunit:ThriftJSJQ_TLS',
                                 'concat', 'uglify', 'jsdoc'
                                ]);
};
