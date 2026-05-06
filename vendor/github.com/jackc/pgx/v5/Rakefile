require "erb"

rule '.go' => '.go.erb' do |task|
  erb = ERB.new(File.read(task.source))
  File.write(task.name, "// Code generated from #{task.source}. DO NOT EDIT.\n\n" + erb.result(binding))
  sh "goimports", "-w", task.name
end

generated_code_files = [
  "pgtype/int.go",
  "pgtype/int_test.go",
  "pgtype/integration_benchmark_test.go",
  "pgtype/zeronull/int.go",
  "pgtype/zeronull/int_test.go"
]

desc "Generate code"
task generate: generated_code_files
