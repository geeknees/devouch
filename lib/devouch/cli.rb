# ABOUTME: Exposes local endorsement requests, ENS retrieval, policy verification, and unsent revocation plans.
# ABOUTME: Keeps evidence validity, repository acceptance, and wallet submission separate.
require "optparse"
require "time"
require_relative "bridge"
require_relative "policy"

module Devouch
  VERSION = "0.1.0"
  DEFAULT_RPC = "https://sepolia.gateway.tenderly.co"

  class CLI
    REQUIRED = {
      "request" => %w[subject issuer name expires-at output],
      "fetch" => %w[name output],
      "verify" => %w[credential policy subject],
      "revoke" => %w[credential output]
    }.freeze
    OPTIONAL = {"request" => [], "fetch" => %w[publication publication-output], "verify" => %w[publication], "revoke" => []}.freeze
    EVIDENCE = %w[valid invalid missing expired revoked unavailable].freeze

    def initialize(out: $stdout, err: $stderr, bridge: Bridge.new)
      @out, @err, @bridge = out, err, bridge
    end

    def run(argv)
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
      @command == "verify" ? verify(options) : operate(options)
    rescue OptionParser::ParseError
      failure(Error.new("usage_error", "Invalid options. Run devouch #{@command} --help."))
    rescue Error => error
      if @command == "verify" && error.exit_status == 2
        report = base_report.merge("evidence_status" => error.code == "credential_missing" ? "missing" : "invalid",
          "reason_codes" => [error.code], "subject" => options&.fetch("subject", nil), "policy" => @policy&.description)
        emit(report)
        2
      elsif @command == "verify" && error.exit_status == 3
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
      raw = Files.read(options.fetch("credential"))
      input = {"command" => "verify", "raw" => raw, "subject" => options.fetch("subject"), "rpc_url" => options.fetch("rpc-url")}
      input["publication"] = publication(options["publication"]) if options["publication"]
      evidence = @bridge.call(input)
      bridge_error(evidence) if evidence["error"]
      unless EVIDENCE.include?(evidence["evidence_status"]) && evidence["reason_codes"].is_a?(Array)
        raise Error.new("invalid_bridge_response", "The verifier returned an invalid result.", 70)
      end
      report = base_report.merge(evidence.slice("evidence_status", "reason_codes", "subject", "issuer", "scope", "snapshot"))
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
      {"report_version" => 1, "command" => "verify", "evidence_status" => nil,
       "policy_status" => "not_evaluated", "reason_codes" => [], "subject" => nil,
       "subject_source" => "argument", "issuer" => nil, "scope" => nil,
       "human_verification" => "not_included", "policy" => nil, "verifier_version" => VERSION,
       "snapshot" => nil, "error" => nil}
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
        @out.puts("Reasons: #{report["reason_codes"].join(", ")}") unless report["reason_codes"].empty?
        @out.puts("Policy: #{report.dig("policy", "repository_id")} / #{report.dig("policy", "digest")}")
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
          OPTIONAL.fetch(name).map { |key| " [--#{key} PATH]" }.join + " [--rpc-url URL] [--json]" }.join("\n") +
        "\n\nrequest / revoke prepare UNSENT files for the static wallet app.\n" +
        "fetch retrieves bytes; verify checks evidence and the selected repository policy.\n" +
        "Exit: 0 accepted/prepared, 1 rejected, 2 invalid/missing/revoked/expired, 3 unavailable, 4 usage/config, 5 file, 70 internal.\n"
    end
  end
end
