module.exports = function(config) {
  return {
    source: {
      files: {
        src: ['<%= srcDir %>/app/**/*.ts', '!<%= srcDir %>/app/**/*.d.ts'],
      }
    },
    options: {
      configuration: {
        rules: {
          curly: true,
<<<<<<< 9f143c1b0a87ec72b64ae4ee2a5619a80c1ec1ef
          align: [true, "parameters", "statements"],
=======
          align: [true, "parameters", "arguments", "statements"],
>>>>>>> tech(typescript): converted signup controller to typescript
          indent: [true, "spaces"],
          "class-name": true,
          "interface-name": true,
          "semicolon": true,
<<<<<<< 9f143c1b0a87ec72b64ae4ee2a5619a80c1ec1ef
          "use-strict": [false, "check-module", "check-function"],
          "whitespace": [true, "check-branch", "check-decl", "check-type"],
=======
          "use-strict": [true, "check-module", "check-function" ],
          "whitespace": [true, "check-branch", "check-decl", "check-operator", "check-separator", "check-type"],
>>>>>>> tech(typescript): converted signup controller to typescript
        }
      }
    }
  };
};
