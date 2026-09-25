# ABOUTME: Applies each repository's explicit acceptance policy to independently valid evidence.
# ABOUTME: Never lets a credential select its own policy or weaken an unsupported issuer threshold.
require "digest"
require_relative "files"

module Devouch
  class Policy
    ADDRESS = /\A0x[0-9a-fA-F]{40}\z/
    attr_reader :data, :digest

    def initialize(raw)
      @data = Files.parse(raw)
      @digest = "sha256:#{Digest::SHA256.hexdigest(raw)}"
      valid = @data.is_a?(Hash) &&
        @data.keys.sort == %w[repositoryId chainId trustedIssuers allowedScopes allowedResolvers requiredIssuers].sort &&
        @data["repositoryId"].is_a?(String) && @data["repositoryId"].match?(/\A[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\z/) &&
        @data["chainId"] == 11155111 && @data["requiredIssuers"] == 1 &&
        array?("trustedIssuers") { |value| address?(value) } &&
        array?("allowedScopes") { |value| value.is_a?(String) && value.match?(/\A[a-z][a-z0-9-]{0,63}\z/) } &&
        array?("allowedResolvers") { |value| value.is_a?(Hash) && value.keys.sort == %w[address implementation] &&
          address?(value["address"]) && address?(value["implementation"]) }
      raise JSON::ParserError unless valid
    rescue JSON::ParserError
      raise Error.new("invalid_policy", "Use a Sepolia policy with requiredIssuers: 1 and explicit issuer, scope, and resolver lists.")
    end

    def description
      {"repository_id" => @data.fetch("repositoryId"), "digest" => @digest}
    end

    def reasons(evidence)
      reasons = []
      reasons << "issuer_not_trusted" unless @data["trustedIssuers"].any? { |issuer| equal_address?(issuer, evidence["issuer"]) }
      reasons << "scope_not_allowed" unless @data["allowedScopes"].include?(evidence["scope"])
      reasons << "resolver_not_allowed" unless @data["allowedResolvers"].any? { |entry|
        equal_address?(entry["address"], evidence["resolver"]) && equal_address?(entry["implementation"], evidence["implementation"])
      }
      reasons
    end

    private

    def equal_address?(left, right)
      left.downcase == right.to_s.downcase
    end

    def address?(value)
      value.is_a?(String) && value.match?(ADDRESS) && value.downcase != "0x#{"0" * 40}"
    end

    def array?(key, &predicate)
      value = @data[key]
      value.is_a?(Array) && value.length <= 64 && value.all?(&predicate)
    end
  end
end
