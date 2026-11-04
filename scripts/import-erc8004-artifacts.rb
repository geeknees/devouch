# ABOUTME: Imports compiled, unmodified ERC-8004 and OpenZeppelin contracts with provenance.
# ABOUTME: Checks pinned upstream source bytes and compiler settings before producing local EVM fixtures.
require "digest"
require "fileutils"
require "json"

root = File.expand_path("../vendor/erc-8004", __dir__)
build = File.expand_path(ARGV.fetch(0))
pins = { "IdentityRegistryUpgradeable" => "134b93126ae856548b5f3b09935c7b25336f01f3",
         "ReputationRegistryUpgradeable" => "6d5ad6b1a8ccd78e2c36990b0fa9b74b68b9ea35",
         "MinimalUUPS" => "edbc321e8525e581a877a6461f9161a083189e8e" }
info_path = Dir[File.join(build, "artifacts/build-info/*.json")].reject { |p| p.end_with?(".output.json") }.max_by { |p| File.mtime(p) }
abort "Missing compiler build information" unless info_path
info = JSON.parse(File.read(info_path))
abort "Unexpected compiler" unless info.fetch("solcLongVersion") == "0.8.24+commit.e11b9ed9"
input = info.fetch("input")
settings = input.fetch("settings")
abort "Unexpected settings" unless settings.fetch("evmVersion") == "shanghai" && settings.fetch("viaIR") &&
  settings.fetch("optimizer") == { "enabled" => true, "runs" => 200 }
pins.each do |name, expected|
  content = File.binread(File.join(root, "contracts/#{name}.sol"))
  abort "Source pin mismatch: #{name}" unless Digest::SHA1.hexdigest("blob #{content.bytesize}\0" + content) == expected
  abort "Compiled source mismatch: #{name}" unless input.fetch("sources").fetch("project/contracts/#{name}.sol").fetch("content") == content
end
input.fetch("sources").each_key do |name|
  next if name.start_with?("project/")
  abort "Unpinned dependency: #{name}" unless name.match?(%r{\Anpm/@openzeppelin/(contracts|contracts-upgradeable)@5\.4\.0/})
end
output = JSON.parse(File.read(info_path.sub(/\.json\z/, ".output.json"))).fetch("output")
manifest = { "implementationCommit" => "b9e466c250744a7e06b13dff9d3c2844ed64f825",
  "specificationCommit" => "503591a6e80e6e1affdd6403341e25269141f046", "compiler" => info.fetch("solcLongVersion"),
  "openzeppelin" => "5.4.0", "files" => {} }
File.write(File.join(root, "compiler-input.json"), JSON.pretty_generate(input) + "\n")
names = pins.keys + ["ERC1967Proxy"]
output.fetch("contracts").each do |source, contracts|
  contracts.each do |name, contract|
    next unless names.include?(name)
    artifact = { "contractName" => name, "sourceName" => source, "abi" => contract.fetch("abi"),
      "bytecode" => "0x" + contract.dig("evm", "bytecode", "object"),
      "deployedBytecode" => "0x" + contract.dig("evm", "deployedBytecode", "object"),
      "immutableReferences" => contract.dig("evm", "deployedBytecode", "immutableReferences") }
    File.write(File.join(root, "#{name}.json"), JSON.pretty_generate(artifact) + "\n")
  end
end
(names.map { |n| "#{n}.json" } + ["compiler-input.json"] + pins.keys.map { |n| "contracts/#{n}.sol" }).sort.each do |path|
  manifest["files"][path] = Digest::SHA256.file(File.join(root, path)).hexdigest
end
File.write(File.join(root, "manifest.json"), JSON.pretty_generate(manifest) + "\n")
puts "Imported #{names.length} pinned contracts and the complete compiler input."
