# ABOUTME: Supplies deterministic public GitHub responses to the real pre-submission CLI in integration tests.
# ABOUTME: Keeps the bundled signature, ENS history, snapshot, and policy verification unchanged.
require_relative "../../lib/devouch/cli"

class FixtureGitHub
  def initialize(path)
    @fixture = JSON.parse(File.read(path))
  end

  def repository(name)
    raise "Unexpected repository" unless name == @fixture.fetch("repository")
    {"full_name" => name, "private" => false, "default_branch" => @fixture.fetch("branch")}
  end

  def branch(repository, branch)
    raise "Unexpected branch" unless repository == @fixture.fetch("repository") && branch == @fixture.fetch("branch")
    {"name" => branch, "commit" => {"sha" => @fixture.fetch("sha")}}
  end

  def file(repository, path, sha, limit:)
    unless repository == @fixture.fetch("repository") && path == ".devouch/policy.json" && sha == @fixture.fetch("sha") && limit == 16_384
      raise "Policy was not pinned to the destination commit"
    end
    @fixture.fetch("policy")
  end
end

exit Devouch::CLI.new(github: FixtureGitHub.new(ARGV.shift)).run(ARGV)
