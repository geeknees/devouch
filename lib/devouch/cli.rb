# ABOUTME: Exposes local endorsement requests, ENS retrieval, policy verification, and unsent revocation plans.
# ABOUTME: Keeps evidence validity, repository acceptance, and wallet submission separate.
require "optparse"
require "time"
require_relative "bridge"
require_relative "policy"
require_relative "github"

module Devouch
  VERSION = "0.2.0"
  DEFAULT_RPC = "https://sepolia.gateway.tenderly.co"

  class CLI
    REQUIRED = {
      "request" => %w[subject issuer name expires-at output],
      "fetch" => %w[name output],
      "verify" => %w[credential policy subject],
      "check" => %w[repo credential subject],
      "revoke" => %w[credential output]
    }.freeze
    OPTIONAL = {"request" => [], "fetch" => %w[publication publication-output], "verify" => %w[publication],
      "check" => %w[base publication], "revoke" => []}.freeze
    EVIDENCE = %w[valid invalid missing expired revoked unavailable].freeze

    def initialize(out: $stdout, err: $stderr, bridge: Bridge.new, github: GitHub.new(token: nil))
      @out, @err, @bridge, @github = out, err, bridge, github
    end

    def run(argv)
      @policy = @github_context = nil
      @json = argv.include?("--json")
      @command = argv.first
      if argv.empty? || %w[--help -h help].include?(@command)
        @out.puts(help)
        return 0
      end
      if %w[--version -v].include?(@command)
        @out.puts("Devouch #{VERSION}")
        return 0
      end
      raise Error.new("usage_error", "Unknown command. Run devouch --help.") unless REQUIRED.key?(@command)
      options = parse(argv.drop(1))
      return 0 if options["help"]
      if options["subject"] && !options["subject"].match?(/\Agithub:[1-9][0-9]{0,19}\z/)
        raise Error.new("invalid_subject", "Use github:<numeric user ID>.")
      end
      options["rpc-url"] ||= ENV["DEVOUCH_RPC_URL"] || DEFAULT_RPC
      case @command
      when "verify" then verify(options)
      when "check" then check(options)
      else operate(options)
      end
    rescue OptionParser::ParseError
      failure(Error.new("usage_error", "Invalid options. Run devouch #{@command} --help."))
    rescue Error => error
      if %w[verify check].include?(@command) && error.exit_status == 2
        report = base_report.merge("evidence_status" => error.code == "credential_missing" ? "missing" : "invalid",
          "reason_codes" => [error.code], "subject" => options&.fetch("subject", nil), "policy" => @policy&.description)
        emit(report)
        2
      elsif %w[verify check].include?(@command) && error.exit_status == 3
        emit(base_report.merge("evidence_status" => "unavailable", "reason_codes" => [error.code],
          "subject" => options&.fetch("subject", nil), "policy" => @policy&.description))
        3
      else
        failure(error)
      end
    rescue StandardError
      failure(Error.new("internal_error", "An unexpected error prevented completion.", 70))
    end

    private

    def parse(args)
      options = {}
      parser = OptionParser.new
      (REQUIRED.fetch(@command) + OPTIONAL.fetch(@command) + ["rpc-url"]).each do |key|
        parser.on("--#{key} VALUE") { |value| options[key] = value }
      end
      parser.on("--json") { @json = true }
      parser.on("-h", "--help") { options["help"] = true }
      parser.parse!(args)
      raise Error.new("usage_error", "Unexpected positional arguments.") unless args.empty?
      if options["help"]
        @out.puts(help(@command))
      else
        missing = REQUIRED.fetch(@command).reject { |key| options[key] && !options[key].empty? }
        raise Error.new("usage_error", "Required: #{missing.map { |key| "--#{key}" }.join(", ")}") unless missing.empty?
      end
      options
    end

    def verify(options)
      @policy = Policy.new(Files.read(options.fetch("policy"), limit: 16_384, kind: "policy"))
      evaluate(options)
    end

    def check(options)
      repo, branch = options.values_at("repo", "base")
      unless repository?(repo) && (branch.nil? || branch?(branch))
        raise Error.new("usage_error", "Use --repo owner/name and a valid --base branch name.")
      end
      metadata = @github.repository(repo)
      unless metadata.is_a?(Hash) && repository?(metadata["full_name"]) && metadata["full_name"].casecmp?(repo) &&
          metadata["private"] == false && (branch || branch?(metadata["default_branch"]))
        raise Error.new("github_repository_invalid", "The GitHub repository metadata did not match a public destination.", 3)
      end
      repo, branch = metadata.fetch("full_name"), branch || metadata.fetch("default_branch")
      revision = @github.branch(repo, branch)
      unless revision.is_a?(Hash) && revision["name"] == branch && revision["commit"].is_a?(Hash) &&
          revision["commit"]["sha"].is_a?(String) && revision["commit"]["sha"].match?(/\A[0-9a-f]{40}\z/)
        raise Error.new("github_branch_invalid", "The GitHub branch did not identify the requested immutable commit.", 3)
      end
      @github_context = {"repository" => repo, "base_branch" => branch, "base_sha" => revision["commit"]["sha"],
        "policy_path" => ".devouch/policy.json"}
      raw = @github.file(repo, @github_context["policy_path"], @github_context["base_sha"], limit: 16_384)
      raise Error.new("policy_missing", "The destination has no .devouch/policy.json at the checked commit.") unless raw
      @policy = Policy.new(raw)
      unless @policy.data["repositoryId"] == repo
        raise Error.new("policy_repository_mismatch", "The destination policy belongs to a different repository.")
      end
      evaluate(options)
    end

    def repository?(value)
      value.is_a?(String) && value.match?(/\A[a-zA-Z0-9][a-zA-Z0-9-]{0,38}\/[a-zA-Z0-9_.-]{1,100}\z/) &&
        !%w[. ..].include?(value.split("/").last)
    end

    def branch?(value)
      value.is_a?(String) && !value.empty? && value.bytesize <= 1024 && value != "@" &&
        !value.match?(/[\x00-\x20\x7f~^:?*\[\\]/) && !value.include?("..") && !value.include?("@{") &&
        !value.end_with?(".") && value.split("/", -1).all? { |part| !part.empty? && !part.start_with?(".") && !part.end_with?(".lock") }
    end

    def evaluate(options)
      raw = Files.read(options.fetch("credential"))
      input = {"command" => "verify", "raw" => raw, "subject" => options.fetch("subject"), "rpc_url" => options.fetch("rpc-url")}
      input["publication"] = publication(options["publication"]) if options["publication"]
      evidence = @bridge.call(input)
      bridge_error(evidence) if evidence["error"]
      unless EVIDENCE.include?(evidence["evidence_status"]) && evidence["reason_codes"].is_a?(Array)
        raise Error.new("invalid_bridge_response", "The verifier returned an invalid result.", 70)
      end
      report = base_report.merge(evidence.slice("evidence_status", "reason_codes", "subject", "issuer", "scope", "snapshot", "hierarchy"))
      report["policy"] = @policy.description
      report["subject"] = options.fetch("subject")
      if evidence["evidence_status"] == "valid"
        reasons = @policy.reasons(evidence)
        report["reason_codes"] = reasons
        report["policy_status"] = reasons.empty? ? "accepted" : "rejected"
        status = reasons.empty? ? 0 : 1
      else
        status = evidence["evidence_status"] == "unavailable" ? 3 : 2
      end
      emit(report)
      status
    end

    def operate(options)
      paths = [options.fetch("output"), options["publication-output"]].compact
      Files.preflight(paths)
      input = {"command" => @command, "rpc_url" => options.fetch("rpc-url")}
      input["name"] = options["name"] if options["name"]
      input["raw"] = Files.read(options["credential"]) if options["credential"]
      input["publication"] = publication(options["publication"]) if options["publication"]
      if @command == "request"
        timestamp = options.fetch("expires-at")
        unless timestamp.match?(/\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})\z/)
          raise Error.new("invalid_expiry", "Use a future RFC 3339 timestamp with a timezone.")
        end
        begin
          expires = Time.iso8601(timestamp)
          # Time.iso8601 normalizes impossible dates and out-of-range offsets instead of rejecting them.
          raise ArgumentError unless expires.iso8601.sub(/[+-]00:00\z/, "Z") == timestamp.sub(/[+-]00:00\z/, "Z")
        rescue ArgumentError
          raise Error.new("invalid_expiry", "Use a valid RFC 3339 timestamp.")
        end
        raise Error.new("invalid_expiry", "The endorsement must expire in the future.") unless expires > Time.now
        input.merge!("subject" => options.fetch("subject"), "issuer" => options.fetch("issuer"), "expires_at" => expires.to_i.to_s)
      end
      result = @bridge.call(input)
      bridge_error(result) if result["error"]
      report = {"report_version" => 1, "command" => @command, "submitted" => false, "error" => nil}
      if @command == "fetch"
        outputs = {options.fetch("output") => result.fetch("raw")}
        files = {"credential" => options.fetch("output")}
        if options["publication-output"]
          outputs[options["publication-output"]] = JSON.pretty_generate(result.fetch("publication")) + "\n"
          files["publication"] = options["publication-output"]
        end
        Files.save_all(outputs)
        report.merge!("operation_status" => "fetched", "files" => files, "subject" => result["subject"], "next_action" => "verify")
      else
        Files.save_all(options.fetch("output") => JSON.pretty_generate(result.fetch("request")) + "\n")
        report.merge!("operation_status" => "prepared", "files" => {"request" => options.fetch("output")},
          "next_action" => "review_and_submit_with_wallet")
      end
      emit(report)
      0
    end

    def publication(path)
      value = Files.parse(Files.read(path, limit: 2048, kind: "publication"))
      raise JSON::ParserError unless value.is_a?(Hash)
      value
    rescue JSON::ParserError
      raise Error.new("invalid_publication", "The publication hint is invalid JSON.", 2)
    end

    def bridge_error(result)
      error = result.fetch("error")
      raise Error.new(error.fetch("code"), error.fetch("message"), result.fetch("exit_status", 70))
    end

    def base_report
      report = {"report_version" => 1, "command" => @command, "evidence_status" => nil,
       "policy_status" => "not_evaluated", "reason_codes" => [], "subject" => nil,
       "subject_source" => "argument", "issuer" => nil, "scope" => nil,
       "human_verification" => "not_included", "policy" => nil, "verifier_version" => VERSION,
       "snapshot" => nil, "error" => nil}
      report.merge!("submitted" => false, "github" => @github_context) if @command == "check"
      report
    end

    def failure(error)
      emit({"report_version" => 1, "command" => @command, "operation_status" => "error",
        "submitted" => false, "error" => {"code" => error.code, "message" => error.message}})
      error.exit_status
    end

    def emit(report)
      if @json
        @out.puts(JSON.generate(report))
      elsif report["evidence_status"]
        @out.puts("Evidence: #{report["evidence_status"]} / Policy: #{report["policy_status"]}")
        @out.puts("Subject: #{report["subject"]} (supplied by caller)")
        @out.puts("Issuer: #{report["issuer"]}") if report["issuer"]
        if report["hierarchy"].is_a?(Array)
          @out.puts("ENS hierarchy: #{report["hierarchy"].map { |hop| hop["name"] }.join(" -> ")}")
        end
        @out.puts("Reasons: #{report["reason_codes"].join(", ")}") unless report["reason_codes"].empty?
        @out.puts("Policy: #{report.dig("policy", "repository_id")} / #{report.dig("policy", "digest")}")
        if report["command"] == "check"
          context = report["github"]
          @out.puts("Destination: #{context.values_at("repository", "base_branch", "base_sha").join(" / ")}") if context
          @out.puts("No pull request submitted. Recheck before submitting if the destination policy or ENS state changes.")
        end
        @out.puts("Snapshot: #{JSON.generate(report["snapshot"])}")
        @out.puts("Human verification: not included. Code review is still required.")
      elsif report["error"]
        @out.puts("#{report.dig("error", "code")}: #{report.dig("error", "message")}")
      else
        @out.puts("#{report["operation_status"]}: #{report["files"].values.join(", ")}")
        @out.puts("No transaction submitted. Next: #{report["next_action"]}.")
      end
    end

    def help(command = nil)
      commands = command ? [command] : REQUIRED.keys
      "Devouch #{VERSION} — portable contributor endorsements on ENSv2\n\n" +
        commands.map { |name| "devouch #{name} " + REQUIRED.fetch(name).map { |key| "--#{key} VALUE" }.join(" ") +
          OPTIONAL.fetch(name).map { |key| " [--#{key} #{key == "base" ? "BRANCH" : "PATH"}]" }.join + " [--rpc-url URL] [--json]" }.join("\n") +
        "\n\nrequest / revoke prepare UNSENT files for the static wallet app.\n" +
        "fetch retrieves bytes; verify checks evidence and the selected repository policy.\n" +
        "check reads a public GitHub destination policy at its base commit and verifies locally; it never submits a PR.\n" +
        "Exit: 0 accepted/prepared, 1 rejected, 2 invalid/missing/revoked/expired, 3 unavailable, 4 usage/config, 5 file, 70 internal.\n"
    end
  end
end
