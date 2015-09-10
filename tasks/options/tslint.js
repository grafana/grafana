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
<<<<<<< 8b37b131c51c65a4c2ac87c935f95a55bf99256f
          align: [true, "parameters", "statements"],
=======
          align: [true, "parameters", "arguments", "statements"],
>>>>>>> tech(typescript): converted signup controller to typescript
          indent: [true, "spaces"],
          "class-name": true,
          "interface-name": true,
          "semicolon": true,
<<<<<<< 8b37b131c51c65a4c2ac87c935f95a55bf99256f
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
