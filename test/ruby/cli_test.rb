# ABOUTME: Verifies the public Ruby command contract and repository policy authority.
# ABOUTME: Replaces only the network bridge so CLI failures and file guarantees stay deterministic.
require "minitest/autorun"
require "tmpdir"
require "stringio"
require "json"
require_relative "../../lib/devouch/cli"

class CliTest < Minitest::Test
  ISSUER = "0x" + "11" * 20
  RESOLVER = "0x" + "22" * 20
  IMPLEMENTATION = "0x14f09fd05d4585759e54844dc9b00147131cf243"

  PIN = {"identityRegistry" => "0x8004A818BFB912233c491871b3d84c89A494BD9e", "reputationRegistry" => "0x8004B663056A597Dffe9eCcC1965A193B7388713", "identityImplementation" => "0x7274e874CA62410a93Bd8bf61c69d8045E399c02", "reputationImplementation" => "0x16e0FA7f7C56B9a767E34B192B51f921BE31dA34", "identityCodeHash" => "0xa5f9624ea85e45b3f4b8558581f03bfb3e6cefab278d7bf0500ec9bd065dc16f", "reputationCodeHash" => "0x38602de97f1bd86f0a4729f7f3c0a78b1d27892e6eb581272cce5504a68fd00b", "identityProxyCodeHash" => "0xd0e45b1d89fa9b6cc7e97c1f155d64180e5c232aaccf9900ef9d4fd738c02b41", "reputationProxyCodeHash" => "0xd0e45b1d89fa9b6cc7e97c1f155d64180e5c232aaccf9900ef9d4fd738c02b41"}

  def setup
    @directory = Dir.mktmpdir("devouch-cli-test-")
    @policy = {format: "devouch-erc8004-policy-v1", repositoryId: "demo/repo", chainId: 11155111, trustedIssuers: [ISSUER],
      allowedScopes: ["oss-contribution"], allowedRegistries: [PIN], requiredIssuers: 1}
    @policy_path = File.join(@directory, "policy.json")
    @credential = File.join(@directory, "vouch.json")
    File.write(@credential, "{\"fixture\":true}")
    write_policy
    @result = {"evidence_status" => "valid", "reason_codes" => [], "subject" => "github:12345",
      "issuer" => ISSUER, "scope" => "oss-contribution", "chainId" => 11155111, "registry" => PIN,
      "implementation" => IMPLEMENTATION, "snapshot" => {"chain_id" => 11155111, "block_number" => "11780000"}}
  end

  def teardown
    FileUtils.remove_entry(@directory)
  end

  def write_policy
    File.write(@policy_path, JSON.generate(@policy))
  end

  def run_cli(arguments, response = @result)
    output = StringIO.new
    bridge = ->(_input) { response }
    status = Devouch::CLI.new(out: output, err: StringIO.new, bridge: bridge).run(arguments)
    [status, JSON.parse(output.string)]
  end

  def verify_arguments
    ["verify", "--credential", @credential, "--policy", @policy_path, "--subject", "github:12345", "--json"]
  end

  def test_same_evidence_is_accepted_or_rejected_only_by_the_selected_policy
    status, report = run_cli(verify_arguments)
    assert_equal 0, status
    assert_equal "accepted", report["policy_status"]
    assert_equal "not_included", report["human_verification"]
    assert_equal "argument", report["subject_source"]
    assert_equal "0.3.0", report["verifier_version"]
    assert_equal 2, report["report_version"]
    @policy[:trustedIssuers] = []
    write_policy
    status, report = run_cli(verify_arguments)
    assert_equal 1, status
    assert_equal "valid", report["evidence_status"]
    assert_equal "rejected", report["policy_status"]
    assert_includes report["reason_codes"], "issuer_not_trusted"
  end

  def test_revocation_and_rpc_failure_never_evaluate_policy
    {"revoked" => 2, "expired" => 2, "unavailable" => 3}.each do |state, expected|
      status, report = run_cli(verify_arguments, @result.merge("evidence_status" => state, "reason_codes" => [state]))
      assert_equal expected, status
      assert_equal "not_evaluated", report["policy_status"]
    end
  end

  def test_missing_credential_and_missing_policy_are_different
    File.unlink(@credential)
    status, report = run_cli(verify_arguments)
    assert_equal 2, status
    assert_equal "missing", report["evidence_status"]
    File.unlink(@policy_path)
    status, report = run_cli(verify_arguments)
    assert_equal 4, status
    assert_equal "error", report["operation_status"]
  end

  def test_empty_files_are_invalid_input_instead_of_internal_errors
    File.write(@credential, "")
    status, report = run_cli(verify_arguments)
    assert_equal 2, status
    assert_equal "invalid", report["evidence_status"]
    File.write(@policy_path, "")
    status, report = run_cli(verify_arguments)
    assert_equal 4, status
    assert_equal "invalid_policy", report.dig("error", "code")
  end

  def test_policy_requires_one_issuer_and_cannot_be_replaced_by_input
    @policy[:requiredIssuers] = 2
    write_policy
    status, report = run_cli(verify_arguments)
    assert_equal 4, status
    assert_equal "invalid_policy", report.dig("error", "code")
  end

  def test_unknown_options_and_missing_arguments_remain_machine_readable
    [["verify", "--wat", "--json"], ["request", "--json"], ["wat", "--json"]].each do |args|
      status, report = run_cli(args)
      assert_equal 4, status
      assert_equal "error", report["operation_status"]
    end
  end

  def test_fetch_preserves_exact_chain_bytes_and_refuses_overwrite
    target = File.join(@directory, "fetched.json")
    raw = "{ \"preserved\": true }\n"
    args = ["fetch", "--agent-id", "0", "--issuer", ISSUER, "--feedback-index", "1", "--feedback-block", "100", "--output", target, "--json"]
    response = {"raw" => raw, "subject" => "github:12345", "publication" => {"chainId" => 11155111}}
    assert_equal 0, run_cli(args, response).first
    assert_equal raw, File.binread(target)
    assert_equal 5, run_cli(args, response).first
    assert_equal raw, File.binread(target)
  end

  def test_fetch_rejects_retired_publication_output_before_creating_any_file
    target = File.join(@directory, "fetched.json")
    args = ["fetch", "--agent-id", "0", "--issuer", ISSUER, "--feedback-index", "1", "--feedback-block", "100", "--output", target, "--publication-output", @policy_path, "--json"]
    assert_equal 4, run_cli(args, {"raw" => "data", "publication" => {}}).first
    refute File.exist?(target)
  end

  def test_revoke_prepares_an_unsent_operation
    target = File.join(@directory, "revoke.json")
    status, report = run_cli(["revoke", "--credential", @credential, "--output", target, "--json"], {"request" => {"operation" => "revoke"}})
    assert_equal 0, status
    assert_equal "prepared", report["operation_status"]
    assert_equal false, report["submitted"]
  end

  def request_arguments(timestamp, target)
    ["request", "--subject", "github:12345", "--issuer", ISSUER, "--agent-id", "0",
      "--expires-at", timestamp, "--output", target, "--json"]
  end

  def test_request_rejects_dates_times_and_offsets_that_ruby_would_silently_normalize
    ["2099-02-29T12:00:00Z", "2099-04-31T12:00:00Z", "2099-10-01T24:00:00Z",
      "2099-10-01T12:00:00+09:99", "2099-10-01T12:00:60Z"].each_with_index do |timestamp, index|
      target = File.join(@directory, "invalid-request-#{index}.json")
      calls = []
      output = StringIO.new
      bridge = ->(input) { calls << input; {"request" => {"operation" => "publish"}} }
      status = Devouch::CLI.new(out: output, bridge: bridge).run(request_arguments(timestamp, target))
      assert_equal 4, status, timestamp
      assert_equal "invalid_expiry", JSON.parse(output.string).dig("error", "code"), timestamp
      assert_empty calls, timestamp
      refute File.exist?(target), timestamp
    end
  end

  def test_request_preserves_valid_leap_days_and_timezone_offsets
    ["2096-02-29T12:00:00Z", "2096-02-29T12:00:00+00:00", "2096-02-29T12:00:00-00:00",
      "2096-02-29T17:30:00+05:30", "2096-02-29T08:30:00-03:30"].each_with_index do |timestamp, index|
      target = File.join(@directory, "request-#{index}.json")
      calls = []
      output = StringIO.new
      bridge = ->(input) { calls << input; {"request" => {"operation" => "publish"}} }
      status = Devouch::CLI.new(out: output, bridge: bridge).run(request_arguments(timestamp, target))
      assert_equal 0, status, timestamp
      assert_equal Time.utc(2096, 2, 29, 12).to_i.to_s, calls.fetch(0).fetch("expires_at"), timestamp
      assert_equal false, JSON.parse(output.string).fetch("submitted"), timestamp
      assert File.file?(target), timestamp
    end
  end
end
