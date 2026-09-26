# ABOUTME: Exercises the real Ruby CLI policy path with fixtures also consumed by TypeScript.
# ABOUTME: Keeps evidence failures and policy rejection reasons identical across both user interfaces.
require "minitest/autorun"
require "tmpdir"
require "stringio"
require "json"
require_relative "../../lib/devouch/cli"

class PolicyParityTest < Minitest::Test
  JSON.parse(File.read(File.expand_path("../fixtures/policy-cases.json", __dir__))).each_with_index do |fixture, index|
    define_method("test_shared_policy_#{index}") do
      Dir.mktmpdir("devouch-policy-parity-") do |directory|
        policy = File.join(directory, "policy.json")
        credential = File.join(directory, "credential.json")
        File.write(policy, fixture["policy_raw"] || JSON.generate(fixture["policy"]))
        File.write(credential, "{}")
        output = StringIO.new
        bridge = ->(_input) { fixture.fetch("evidence") }
        exit_status = Devouch::CLI.new(out: output, bridge: bridge).run([
          "verify", "--credential", credential, "--policy", policy,
          "--subject", fixture.fetch("evidence").fetch("subject"), "--json"
        ])
        report = JSON.parse(output.string)
        expected = fixture.fetch("expected")
        if expected["error"]
          assert_equal expected["error"], report.dig("error", "code"), fixture["name"]
          assert_equal 4, exit_status, fixture["name"]
        else
          assert_equal expected, report.slice("policy_status", "reason_codes"), fixture["name"]
          assert_equal fixture.dig("evidence", "evidence_status"), report["evidence_status"], fixture["name"]
        end
      end
    end
  end
end
