# ABOUTME: Tests PR identity, immutable GitHub reads, and report-mode failure handling.
# ABOUTME: Uses a recording API fake to prove that no PR code is checked out or executed.
require "minitest/autorun"
require "json"
require_relative "../../lib/devouch/action"

class ActionTest < Minitest::Test
  class API
    attr_reader :calls
    def initialize(event, missing: false)
      @event, @missing, @calls = event, missing, []
    end
    def pull_request(repo, number)
      @calls << [:pull, repo, number]
      @event.fetch("pull_request")
    end
    def file(repo, path, sha, limit:)
      @calls << [:file, repo, path, sha, limit]
      return nil if @missing && path.include?("/vouches/")
      path.end_with?("policy.json") ? JSON.generate({"repositoryId" => "maintainer/repo"}) : "{}"
    end
  end

  def setup
    @event = {"number" => 7, "repository" => {"full_name" => "maintainer/repo"},
      "sender" => {"id" => 999}, "pull_request" => {"number" => 7, "user" => {"id" => 12345},
        "base" => {"sha" => "a" * 40, "repo" => {"full_name" => "maintainer/repo"}},
        "head" => {"sha" => "b" * 40, "repo" => {"full_name" => "contributor/fork"}}}}
  end

  def runner(api, status: 0, evidence: "valid", policy: "accepted")
    verifier = ->(args) {
      @args = args
      report = {"report_version" => 1, "command" => "verify", "evidence_status" => evidence, "policy_status" => policy,
        "reason_codes" => [], "subject" => "github:12345", "subject_source" => "argument", "issuer" => nil,
        "scope" => "oss-contribution", "human_verification" => "not_included", "snapshot" => nil,
        "policy" => {"repository_id" => "maintainer/repo", "digest" => "sha256:" + "a" * 64},
        "verifier_version" => "0.1.0", "error" => nil}
      [status, report]
    }
    Devouch::Action.new(api: api, verifier: verifier)
  end

  def test_pr_author_is_used_and_json_is_fetched_at_the_event_base_and_head
    api = API.new(@event)
    result = runner(api).run(event: @event, repository: "maintainer/repo", policy_path: ".devouch/policy.json")
    assert_equal 0, result.fetch("action_exit_status")
    assert_includes @args, "github:12345"
    refute_includes @args, "github:999"
    assert_includes api.calls, [:file, "maintainer/repo", ".devouch/policy.json", "a" * 40, 16_384]
    assert_includes api.calls, [:file, "contributor/fork", ".devouch/vouches/github-12345.json", "b" * 40, 4096]
  end

  def test_updated_api_head_does_not_replace_the_rerun_event_head
    api_event = Marshal.load(Marshal.dump(@event))
    api_event["pull_request"]["head"]["sha"] = "c" * 40
    api = API.new(api_event)
    runner(api).run(event: @event, repository: "maintainer/repo", policy_path: ".devouch/policy.json")
    assert_includes api.calls, [:file, "contributor/fork", ".devouch/vouches/github-12345.json", "b" * 40, 4096]
  end

  def test_report_mode_completed_rejection_is_success_but_unavailable_is_failure
    [[1, "valid", "rejected", 0], [2, "revoked", "not_evaluated", 0], [3, "unavailable", "not_evaluated", 1]].each do |status, evidence, policy, expected|
      result = runner(API.new(@event), status: status, evidence: evidence, policy: policy).run(event: @event, repository: "maintainer/repo", policy_path: ".devouch/policy.json")
      assert_equal expected, result["action_exit_status"]
    end
  end

  def test_an_inconsistent_cli_result_fails_instead_of_showing_green
    assert_raises(Devouch::Error) do
      runner(API.new(@event), status: 0, evidence: "revoked", policy: "not_evaluated").run(event: @event, repository: "maintainer/repo", policy_path: ".devouch/policy.json")
    end
  end

  def test_self_reported_author_and_cross_repository_policy_are_rejected
    assert_raises(Devouch::Error) do
      runner(API.new(@event)).run(event: @event, repository: "attacker/repo", policy_path: ".devouch/policy.json")
    end
    api_event = Marshal.load(Marshal.dump(@event))
    api_event["pull_request"]["user"]["id"] = 67890
    assert_raises(Devouch::Error) do
      runner(API.new(api_event)).run(event: @event, repository: "maintainer/repo", policy_path: ".devouch/policy.json")
    end
  end

  def test_summary_does_not_render_input_as_html_or_inject_table_rows
    summary = Devouch::Action.summary({"issuer" => "<script>|\n\"unsafe\""})
    refute_includes summary, "<script>"
    assert_includes summary, "&lt;script&gt;&#124; &quot;unsafe&quot;"
  end
end
