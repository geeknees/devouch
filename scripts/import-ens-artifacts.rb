# ABOUTME: Extracts ABI and bytecode from the explicitly pinned official ENSv2 deployment.
# ABOUTME: Records provenance and runtime fingerprints without copying legacy Devouch code.
require "json"
require "fileutils"
require "digest"

source = ARGV.fetch(0)
commit = "71a3b7339dbc55ab47667abdfe8303bac4f4c24e"
actual = IO.popen(["git", "-C", source, "rev-parse", "HEAD"], &:read).strip
abort "Expected ENS source #{commit}" unless actual == commit
destination = File.expand_path("../vendor/ens-v2", __dir__)
FileUtils.mkdir_p(destination)
%w[PermissionedResolverImpl UserRegistryImpl VerifiableFactory RootRegistry ETHRegistry LabelStore].each do |name|
  original = File.binread(File.join(source, "contracts/deployments/sepolia/#{name}.json"))
  artifact = JSON.parse(original)
  subset = artifact.slice("address", "abi", "bytecode", "deployedBytecode", "immutableReferences")
  subset["deploymentBlock"] = artifact.fetch("receipt").fetch("blockNumber").to_i(16).to_s
  subset["sourceCommit"] = commit
  subset["sourceArtifactSha256"] = Digest::SHA256.hexdigest(original)
  File.write(File.join(destination, "#{name}.json"), JSON.pretty_generate(subset) + "\n")
end
license = %w[LICENSE LICENSE.md].map { |f| File.join(source, f) }.find { |f| File.file?(f) }
FileUtils.cp(license, File.join(destination, "LICENSE")) if license
