# ABOUTME: Runs the real read-only Action and bundled CLI against immutable in-memory GitHub JSON.
# ABOUTME: Supports local EVM integration without GitHub credentials or execution of contributor code.
require_relative '../../lib/devouch/action'
input = JSON.parse($stdin.read)
base_sha, head_sha = 'a' * 40, 'b' * 40
repository = input.fetch('repository')
author = Integer(input.fetch('subject').delete_prefix('github:'))
pr = {'number' => 7, 'user' => {'id' => author},
  'base' => {'sha' => base_sha, 'repo' => {'full_name' => repository}},
  'head' => {'sha' => head_sha, 'repo' => {'full_name' => 'contributor/fork'}}}
event = {'number' => 7, 'repository' => {'full_name' => repository}, 'pull_request' => pr}
api = Object.new
api.define_singleton_method(:pull_request) { |repo, number| raise 'wrong PR' unless repo == repository && number == 7; pr }
api.define_singleton_method(:file) do |repo, path, sha, limit:|
  if path == '.devouch/erc8004-policy.json'
    raise 'mutable policy' unless repo == repository && sha == base_sha && limit == 16384
    input.fetch('policy')
  else
    raise 'wrong evidence identity' unless repo == 'contributor/fork' && sha == head_sha &&
      path == ".devouch/feedback/github-#{author}.json" && limit == 4096
    input['reference']
  end
end
result = Devouch::Action.new(api: api, rpc_url: input.fetch('rpc')).run(event: event, repository: repository)
puts JSON.generate(result)
