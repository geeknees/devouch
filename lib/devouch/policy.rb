# ABOUTME: Applies each repository's explicit acceptance policy to independently valid evidence.
# ABOUTME: Never lets a credential select its own policy or weaken an unsupported issuer threshold.
require "digest"
require_relative "files"

module Devouch
  class Policy
    ADDRESS = /\A0x[0-9a-fA-F]{40}\z/
    HASH = /\A0x[0-9a-fA-F]{64}\z/
    REGISTRY_KEYS = %w[identityRegistry reputationRegistry identityImplementation reputationImplementation
      identityCodeHash reputationCodeHash identityProxyCodeHash reputationProxyCodeHash].freeze
    attr_reader :data, :digest

    def initialize(raw)
      @data = Files.parse(raw)
      @digest = "sha256:#{Digest::SHA256.hexdigest(raw)}"
      if @data.is_a?(Hash) && @data.key?("allowedResolvers") && @data["format"] != "devouch-erc8004-policy-v1"
        raise Error.new("legacy_ens_policy", "ENS policies require an explicit ERC-8004 migration. See docs/upgrading-0.3.md.")
      end
      valid = @data.is_a?(Hash) &&
        @data.keys.sort == %w[format repositoryId chainId trustedIssuers allowedScopes allowedRegistries requiredIssuers].sort &&
        @data["format"] == "devouch-erc8004-policy-v1" &&
        @data["repositoryId"].is_a?(String) && @data["repositoryId"].match?(/\A[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\z/) &&
        @data["chainId"].is_a?(Integer) && @data["chainId"].between?(1, 9_007_199_254_740_991) && @data["requiredIssuers"] == 1 &&
        array?("trustedIssuers") { |value| address?(value) } &&
        array?("allowedScopes") { |value| value.is_a?(String) && value.match?(/\A[a-z][a-z0-9-]{0,63}\z/) } &&
        array?("allowedRegistries") { |value| value.is_a?(Hash) && value.keys.sort == REGISTRY_KEYS.sort &&
          REGISTRY_KEYS.all? { |key| key.end_with?("Hash") ? value[key].is_a?(String) && value[key].match?(HASH) : address?(value[key]) } }
      raise JSON::ParserError unless valid
    rescue JSON::ParserError
      raise Error.new("invalid_policy", "Use an ERC-8004 policy with requiredIssuers: 1 and explicit chain, issuer, scope, and registry pins.")
    end

    def description
      {"repository_id" => @data.fetch("repositoryId"), "digest" => @digest}
    end

    def reasons(evidence)
      reasons = []
      reasons << "chain_not_allowed" unless @data["chainId"] == evidence["chainId"]
      reasons << "issuer_not_trusted" unless @data["trustedIssuers"].any? { |issuer| equal_address?(issuer, evidence["issuer"]) }
      reasons << "scope_not_allowed" unless @data["allowedScopes"].include?(evidence["scope"])
      reasons << "registry_not_allowed" unless @data["allowedRegistries"].any? { |entry|
        evidence["registry"].is_a?(Hash) && REGISTRY_KEYS.all? { |key| equal_address?(entry[key], evidence["registry"][key]) }
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
