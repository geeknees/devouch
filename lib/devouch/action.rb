# ABOUTME: Evaluates an event's PR author with base policy and head endorsement data.
# ABOUTME: Separates report-mode completion from acceptance and detects inconsistent verifier results.
require "tmpdir"
require "stringio"
require_relative "cli"
require_relative "github"

module Devouch
  class Action
    REPOSITORY = /\A[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\z/
    SHA = /\A[0-9a-f]{40}\z/

    def initialize(api:, verifier: nil, rpc_url: DEFAULT_RPC)
      @api, @rpc_url = api, rpc_url
      @verifier = verifier || ->(args) {
        output = StringIO.new
        status = CLI.new(out: output).run(args)
        [status, Files.parse(output.string)]
      }
    end

    def run(event:, repository:, policy_path:)
      pr = event.fetch("pull_request")
      number = event.fetch("number")
      author = pr.fetch("user").fetch("id")
      base = pr.fetch("base")
      head = pr.fetch("head")
      valid = repository.is_a?(String) && repository.match?(REPOSITORY) &&
        event.dig("repository", "full_name") == repository && base.dig("repo", "full_name") == repository &&
        number.is_a?(Integer) && number.positive? && author.is_a?(Integer) && author.positive? &&
        base["sha"].is_a?(String) && base["sha"].match?(SHA) && head["sha"].is_a?(String) && head["sha"].match?(SHA) &&
        head.dig("repo", "full_name").is_a?(String) && head.dig("repo", "full_name").match?(REPOSITORY) &&
        policy_path.is_a?(String) && policy_path.match?(/\A[a-zA-Z0-9_.\/-]+\.json\z/) &&
        !policy_path.start_with?("/") && policy_path.split("/").none? { |part| part == ".." || part.empty? }
      raise Error.new("invalid_pr_event", "Use a pull_request event with immutable base/head SHAs and a repository-relative policy path.") unless valid
      current = @api.pull_request(repository, number)
      unless current["number"] == number && current.dig("user", "id") == author && current.dig("base", "repo", "full_name") == repository
        raise Error.new("pr_identity_mismatch", "PR metadata does not match the event author and destination.")
      end
      policy = @api.file(repository, policy_path, base.fetch("sha"), limit: 16_384)
      raise Error.new("policy_missing", "The base commit does not contain the configured policy.") unless policy
      unless Files.parse(policy)["repositoryId"] == repository
        raise Error.new("policy_repository_mismatch", "The base policy belongs to a different repository.")
      end
      subject = "github:#{author}"
      credential_path = ".devouch/vouches/github-#{author}.json"
      credential = @api.file(head.fetch("repo").fetch("full_name"), credential_path, head.fetch("sha"), limit: 4096)
      status, report = Dir.mktmpdir("devouch-action-") do |directory|
        policy_file = File.join(directory, "policy.json")
        credential_file = File.join(directory, "credential.json")
        File.binwrite(policy_file, policy)
        File.binwrite(credential_file, credential) if credential
        @verifier.call(["verify", "--policy", policy_file, "--credential", credential_file,
          "--subject", subject, "--rpc-url", @rpc_url, "--json"])
      end
      validate_report(status, report, subject)
      report.merge("action_exit_status" => [0, 1, 2].include?(status) ? 0 : 1,
        "cli_exit_status" => status, "github" => {"repository" => repository, "pull_request" => number,
          "author_id" => author.to_s, "subject_source" => "github_pull_request_author",
          "base_sha" => base.fetch("sha"), "head_sha" => head.fetch("sha"),
          "policy_path" => policy_path, "credential_path" => credential_path})
    rescue KeyError, TypeError, JSON::ParserError, NoMethodError
      raise Error.new("invalid_action_input", "PR metadata or base policy JSON is malformed.")
    end

    def self.summary(report, release: nil)
      escape = ->(value) {
        value.to_s.gsub(/[&<>"']/, "&" => "&amp;", "<" => "&lt;", ">" => "&gt;", '"' => "&quot;", "'" => "&#39;")
          .gsub("|", "&#124;").gsub(/[\r\n]/, " ")
      }
      rows = [
        ["Evidence", report["evidence_status"]], ["Repository policy", report["policy_status"]],
        ["Subject", report["subject"]], ["Issuer", report["issuer"]], ["Scope", report["scope"]],
        ["ENS hierarchy", Array(report["hierarchy"]).map { |hop| hop["name"] }.join(" -> ")],
        ["Reasons", Array(report["reason_codes"]).join(", ")],
        ["Repository / PR", "#{report.dig("github", "repository")} ##{report.dig("github", "pull_request")}"],
        ["Base SHA", report.dig("github", "base_sha")], ["Head SHA", report.dig("github", "head_sha")],
        ["Policy digest", report.dig("policy", "digest")], ["Verifier", "#{report["verifier_version"]} #{release}"],
        ["Chain / block", "#{report.dig("snapshot", "chain_id")} / #{report.dig("snapshot", "block_number")}"],
        ["Block hash", report.dig("snapshot", "block_hash")], ["Checked at", report.dig("snapshot", "checked_at")]
      ]
      "## Devouch endorsement report\n\n| Field | Result |\n| --- | --- |\n" +
        rows.map { |label, value| "| #{label} | #{escape.call(value)} |" }.join("\n") +
        "\n\nHuman verification: **not included**. This endorsement does not prove code quality, delegation, or merge approval.\n\n" +
        "Report mode: a completed check can report a missing, rejected, or revoked endorsement. " +
        "Rerun to refresh chain state; revocation does not update earlier checks automatically.\n"
    end

    private

    def validate_report(status, report, subject)
      raise Error.new("invalid_verifier_report", "The verifier returned invalid JSON.", 70) unless report.is_a?(Hash)
      if report["operation_status"] == "error"
        raise Error.new("verifier_operation_failed", "The verifier failed: #{report.dig("error", "code")}.", 3)
      end
      expected = case status
      when 0 then ["valid", "accepted"]
      when 1 then ["valid", "rejected"]
      when 2 then [report["evidence_status"], "not_evaluated"] if %w[invalid missing expired revoked].include?(report["evidence_status"])
      when 3 then ["unavailable", "not_evaluated"]
      end
      unless report["report_version"] == 1 && report["command"] == "verify" &&
          expected && expected == [report["evidence_status"], report["policy_status"]] &&
          report["subject"] == subject && report["human_verification"] == "not_included" && report["reason_codes"].is_a?(Array)
        raise Error.new("invalid_verifier_report", "The verifier JSON and exit code do not agree.", 70)
      end
    end
  end
end
