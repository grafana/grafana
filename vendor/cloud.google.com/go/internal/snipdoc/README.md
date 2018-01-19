# Snipdoc

Snipdoc is a simple tool for maintaining package documentation that contains
code samples.

1. Create a subdirectory of your package to hold the following files. "internal"
   is a good name.
   
2. Write a template file (for example, "doc.template") with the text of your package documentation. The file
should look exactly like you want your doc.go file to look, except for code
snippets. 
Instead of embedding a code snippet, write a line consisting solely of

  [NAME]
  
  for your choice of NAME.

3. Write a snippets file (for example, "doc-snippets.go") as a valid Go source
   file. Begin each snippet you'd like to appear in your package docs with
   `//[ NAME` and end it with `//]`.
   
4. Construct your doc.go file with the command
   ```
   awk -f snipdoc.awk doc-snippets.go doc.template
   ```
   The file "sample-makefile" in this directory verifies that the
   snippets file compiles and safely constructs a doc.go file.

    
