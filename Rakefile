# ABOUTME: Runs the Ruby behavioral suite and syntax checks for the hackathon application.
# ABOUTME: Keeps remote-chain and browser validation as explicit separate commands.
require "rake/testtask"
Rake::TestTask.new(:test) do |task|
  task.pattern = "test/ruby/**/*_test.rb"
end
task :lint do
  Dir["{lib,test/ruby,scripts}/**/*.rb", "exe/devouch", "Rakefile", "Gemfile"].each do |path|
    sh "ruby", "-cw", path
  end
end
task default: [:test, :lint]
