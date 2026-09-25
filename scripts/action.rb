# ABOUTME: Runs the release-owned read-only PR endorsement report in GitHub Actions.
# ABOUTME: Emits bounded JSON, step summary, and stable outputs without checking out PR code.
require_relative "../lib/devouch/action"

begin
  unless ENV["GITHUB_EVENT_NAME"] == "pull_request" && ENV.fetch("DEVOUCH_MODE", "report") == "report"
    raise Devouch::Error.new("unsupported_action_mode", "Use pull_request and mode: report.")
  end
  if ENV.fetch("GITHUB_API_URL", Devouch::GitHub::ORIGIN) != Devouch::GitHub::ORIGIN
    raise Devouch::Error.new("unsupported_github_host", "This version supports github.com.")
  end
  event = Devouch::Files.parse(Devouch::Files.read(ENV.fetch("GITHUB_EVENT_PATH"), limit: 1_048_576, kind: "event"))
  api = Devouch::GitHub.new(token: ENV.fetch("DEVOUCH_GITHUB_TOKEN", ""))
  action = Devouch::Action.new(api: api, rpc_url: ENV.fetch("DEVOUCH_RPC_URL", Devouch::DEFAULT_RPC))
  report = action.run(event: event, repository: ENV.fetch("GITHUB_REPOSITORY"),
    policy_path: ENV.fetch("DEVOUCH_POLICY_PATH", ".devouch/policy.json"))
  puts JSON.generate(report)
  File.open(ENV.fetch("GITHUB_STEP_SUMMARY"), "a") { |file| file.write(Devouch::Action.summary(report, release: ENV["DEVOUCH_RELEASE_REF"])) }
  File.open(ENV.fetch("GITHUB_OUTPUT"), "a") do |file|
    %w[evidence_status policy_status subject].each { |key| file.puts("#{key.tr("_", "-")}=#{report.fetch(key)}") }
  end
  exit report.fetch("action_exit_status")
rescue Devouch::Error => error
  warn JSON.generate({error: {code: error.code, message: error.message}})
  exit 1
rescue StandardError
  warn JSON.generate({error: {code: "action_error", message: "Unable to complete the endorsement report."}})
  exit 1
end
