# ABOUTME: Exercises pre-submission checks against the destination's immutable public policy.
# ABOUTME: Uses recording GitHub and bridge doubles to preserve verification and no-write boundaries.
require "minitest/autorun"
require "tmpdir"
require "stringio"
require "json"
require_relative "../../lib/devouch/cli"

class CheckTest < Minitest::Test
  ISSUER = "0x" + "11" * 20
  RESOLVER = "0x" + "22" * 20
  IMPLEMENTATION = "0x" + "33" * 20
  SHA = "a" * 40

  class API
    attr_accessor :metadata, :branch_data, :raw, :failure
    attr_reader :calls
    def initialize(raw)
      @raw, @calls = raw, []
      @metadata = {"full_name" => "maintainer/repo", "private" => false, "default_branch" => "main"}
      @branch_data = {"name" => "main", "commit" => {"sha" => SHA}}
    end
    def repository(name)
      @calls << [:repository, name]
      raise @failure if @failure
      @metadata
    end
    def branch(name, branch)
      @calls << [:branch, name, branch]
      @branch_data
    end
    def file(name, path, sha, limit:)
      @calls << [:file, name, path, sha, limit]
      @raw
    end
  end

  def setup
    @directory = Dir.mktmpdir("devouch-check-test-")
    @credential = File.join(@directory, "vouch.json")
    @raw = "{ \"fixture\": true }\n"
    File.binwrite(@credential, @raw)
    @policy = {repositoryId: "maintainer/repo", chainId: 11155111, trustedIssuers: [ISSUER],
      allowedScopes: ["oss-contribution"], allowedResolvers: [{address: RESOLVER, implementation: IMPLEMENTATION}], requiredIssuers: 1}
    @api = API.new(JSON.pretty_generate(@policy) + "\n")
    @bridge_calls = []
    @evidence = {"evidence_status" => "valid", "reason_codes" => [], "subject" => "github:12345",
      "issuer" => ISSUER, "scope" => "oss-contribution", "resolver" => RESOLVER, "implementation" => IMPLEMENTATION,
      "snapshot" => {"chain_id" => 11155111, "block_number" => "11780000"}}
  end

  def teardown
    FileUtils.remove_entry(@directory)
  end

  def arguments
    ["check", "--repo", "maintainer/repo", "--credential", @credential, "--subject", "github:12345", "--json"]
  end

  def cli(output)
    Devouch::CLI.new(out: output, github: @api, bridge: ->(input) { @bridge_calls << input; @evidence })
  end

  def run_check(args = arguments)
    output = StringIO.new
    status = cli(output).run(args)
    [status, JSON.parse(output.string)]
  end

  def test_default_branch_policy_is_pinned_and_the_existing_verifier_reads_exact_credential_bytes
    files = Dir.children(@directory)
    status, report = run_check
    assert_equal 0, status
    assert_equal "check", report["command"]
    assert_equal "valid", report["evidence_status"]
    assert_equal "accepted", report["policy_status"]
    assert_equal false, report["submitted"]
    assert_equal "argument", report["subject_source"]
    assert_equal "not_included", report["human_verification"]
    assert_equal({"repository" => "maintainer/repo", "base_branch" => "main", "base_sha" => SHA,
      "policy_path" => ".devouch/policy.json"}, report["github"])
    assert_equal "sha256:#{Digest::SHA256.hexdigest(@api.raw)}", report.dig("policy", "digest")
    assert_equal [[:repository, "maintainer/repo"], [:branch, "maintainer/repo", "main"],
      [:file, "maintainer/repo", ".devouch/policy.json", SHA, 16_384]], @api.calls
    assert_equal [{"command" => "verify", "raw" => @raw, "subject" => "github:12345", "rpc_url" => Devouch::DEFAULT_RPC}], @bridge_calls
    assert_equal @raw, File.binread(@credential)
    assert_equal files, Dir.children(@directory)
  end

  def test_an_explicit_base_branch_overrides_only_the_default_branch
    @api.branch_data = {"name" => "release/v1", "commit" => {"sha" => "b" * 40}}
    status, report = run_check(arguments + ["--base", "release/v1"])
    assert_equal 0, status
    assert_equal "release/v1", report.dig("github", "base_branch")
    assert_equal "b" * 40, report.dig("github", "base_sha")
    assert_includes @api.calls, [:file, "maintainer/repo", ".devouch/policy.json", "b" * 40, 16_384]
  end

  def test_repository_input_case_is_canonicalized_from_matching_github_metadata
    status, report = run_check(arguments.map { |value| value == "maintainer/repo" ? "Maintainer/Repo" : value })
    assert_equal 0, status
    assert_equal "maintainer/repo", report.dig("github", "repository")
  end

  def test_valid_evidence_rejected_by_destination_policy_exits_one
    @api.raw = JSON.generate(@policy.merge(trustedIssuers: []))
    status, report = run_check
    assert_equal 1, status
    assert_equal "valid", report["evidence_status"]
    assert_equal "rejected", report["policy_status"]
    assert_equal ["issuer_not_trusted"], report["reason_codes"]
    assert_equal false, report["submitted"]
  end

  def test_nonvalid_evidence_preserves_the_verifier_status_and_never_evaluates_policy
    {"invalid" => 2, "missing" => 2, "revoked" => 2, "expired" => 2, "unavailable" => 3}.each do |state, expected|
      @evidence = @evidence.merge("evidence_status" => state, "reason_codes" => [state])
      status, report = run_check
      assert_equal expected, status
      assert_equal state, report["evidence_status"]
      assert_equal "not_evaluated", report["policy_status"]
      assert_equal [state], report["reason_codes"]
      assert_equal SHA, report.dig("github", "base_sha")
    end
  end

  def test_a_saved_publication_is_passed_to_the_same_verifier
    hint = {"chainId" => 11155111, "transactionHash" => "0x" + "ab" * 32, "blockNumber" => "42", "blockHash" => "0x" + "cd" * 32}
    path = File.join(@directory, "publication.json")
    File.write(path, JSON.generate(hint))
    assert_equal 0, run_check(arguments + ["--publication", path]).first
    assert_equal hint, @bridge_calls.fetch(0).fetch("publication")
  end

  def test_missing_local_credential_is_missing_and_invalid_bytes_do_not_reach_the_bridge
    File.unlink(@credential)
    status, report = run_check
    assert_equal 2, status
    assert_equal "missing", report["evidence_status"]
    assert_equal ["credential_missing"], report["reason_codes"]
    File.binwrite(@credential, "\xff".b)
    status, report = run_check
    assert_equal 2, status
    assert_equal "invalid", report["evidence_status"]
    assert_empty @bridge_calls
  end

  def test_missing_invalid_and_foreign_policies_are_configuration_errors
    {nil => "policy_missing", "{}" => "invalid_policy", JSON.generate(@policy.merge(repositoryId: "other/repo")) => "policy_repository_mismatch"}.each do |raw, code|
      @api.raw = raw
      status, report = run_check
      assert_equal 4, status
      assert_equal code, report.dig("error", "code")
      assert_equal false, report["submitted"]
      assert_empty @bridge_calls
    end
  end

  def test_github_failure_is_unavailable_and_never_becomes_missing_or_accepted
    @api.failure = Devouch::Error.new("github_unavailable", "Unavailable test API.", 3)
    status, report = run_check
    assert_equal 3, status
    assert_equal "unavailable", report["evidence_status"]
    assert_equal "not_evaluated", report["policy_status"]
    assert_equal ["github_unavailable"], report["reason_codes"]
    assert_empty @bridge_calls
  end

  def test_mismatched_repository_and_private_or_malformed_metadata_stop_before_reading_the_policy
    [nil, {}, @api.metadata.merge("full_name" => "other/repo"), @api.metadata.merge("private" => true),
      @api.metadata.merge("default_branch" => "../main")].each do |metadata|
      @api.metadata = metadata
      status, report = run_check
      assert_equal 3, status
      assert_equal "github_repository_invalid", report["reason_codes"].first
    end
    refute @api.calls.any? { |call| call.first == :file }
    assert_empty @bridge_calls
  end

  def test_mismatched_or_mutable_branch_results_cannot_select_policy
    [nil, {}, {"name" => "other", "commit" => {"sha" => SHA}},
      {"name" => "main", "commit" => {"sha" => "main"}}].each do |branch|
      @api.branch_data = branch
      status, report = run_check
      assert_equal 3, status
      assert_equal "github_branch_invalid", report["reason_codes"].first
    end
    refute @api.calls.any? { |call| call.first == :file }
  end

  def test_unsafe_repository_and_branch_inputs_and_local_policy_overrides_make_no_requests
    ["https://github.com/owner/repo", "owner/repo/extra", "../repo", "owner/..", "owner/repo?ref=x"].each do |name|
      assert_equal 4, run_check(arguments.map { |value| value == "maintainer/repo" ? name : value }).first
    end
    ["../main", "feature\nmain", "", "a" * 1025].each do |branch|
      assert_equal 4, run_check(arguments + ["--base", branch]).first
    end
    assert_equal 4, run_check(arguments + ["--policy", "local-policy.json"]).first
    assert_equal 4, run_check(["check", "--repo", "maintainer/repo", "--credential", @credential, "--json"]).first
    assert_empty @api.calls
    assert_empty @bridge_calls
  end

  def test_reusing_cli_after_a_success_does_not_leak_previous_policy_or_github_context
    output = StringIO.new
    instance = cli(output)
    assert_equal 0, instance.run(arguments)
    @api.failure = Devouch::Error.new("github_unavailable", "Unavailable test API.", 3)
    assert_equal 3, instance.run(arguments)
    failure = JSON.parse(output.string.lines.last)
    assert_nil failure["policy"]
    assert_nil failure["github"]
  end

  def test_human_output_identifies_the_base_and_keeps_the_subject_caller_supplied
    output = StringIO.new
    assert_equal 0, cli(output).run(arguments.reject { |value| value == "--json" })
    assert_includes output.string, "Evidence: valid / Policy: accepted"
    assert_includes output.string, "maintainer/repo / main / #{SHA}"
    assert_includes output.string, "Subject: github:12345 (supplied by caller)"
    assert_includes output.string, "No pull request submitted."
    assert_includes output.string, "Human verification: not included."
  end
end
