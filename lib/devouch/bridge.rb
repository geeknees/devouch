# ABOUTME: Runs the bundled viem reader as a bounded local subprocess with structured input.
# ABOUTME: Uses argument arrays and stdin; never evaluates credentials or reads wallet keys.
require "open3"
require "timeout"
require_relative "files"

module Devouch
  class Bridge
    ENTRY = File.expand_path("../../dist/bridge.mjs", __dir__)

    def call(input)
      raise Error.new("bridge_missing", "Build the verifier with bun run build before using chain commands.") unless File.file?(ENTRY)
      output = nil
      Open3.popen3("node", ENTRY) do |stdin, stdout, stderr, wait|
        begin
          Timeout.timeout(210) do
            stdin.write(JSON.generate(input))
            stdin.close
            output = stdout.read(262_145)
            stderr.read(4096)
            raise Error.new("invalid_bridge_response", "The verifier returned an invalid response.", 70) if output.bytesize > 262_144
            raise Error.new("bridge_failed", "The verifier could not run. Check the supported Node version.") unless wait.value.success?
          end
        rescue Timeout::Error
          Process.kill("TERM", wait.pid)
          raise Error.new("bridge_timeout", "Chain verification exceeded its time budget.", 3)
        end
      end
      value = Files.parse(output)
      raise Error.new("invalid_bridge_response", "The verifier returned an invalid response.", 70) unless value.is_a?(Hash)
      value
    rescue Errno::ENOENT
      raise Error.new("runtime_missing", "Node.js 24 or newer is required for chain verification.")
    rescue JSON::ParserError
      raise Error.new("invalid_bridge_response", "The verifier returned invalid JSON.", 70)
    end
  end
end
