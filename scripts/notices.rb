# ABOUTME: Collects license texts for installed production packages, ENS artifacts, and bundled fonts.
# ABOUTME: Includes attribution in both the CLI and independently hosted static distribution.
require "json"
require "pathname"
require "set"
require "fileutils"

root = Pathname.new(__dir__).parent
visited = Set.new
notices = []
resolve_package = lambda do |name, from|
  from.ascend do |directory|
    candidate = directory.join("node_modules", name, "package.json")
    break candidate.realpath if candidate.file?
  end
end
visit = lambda do |manifest|
  raise "Production dependency manifest missing" unless manifest.is_a?(Pathname) && manifest.file?
  next unless visited.add?(manifest.to_s)
  package = JSON.parse(manifest.read)
  licenses = manifest.dirname.children.select { |path| path.file? && path.basename.to_s.match?(/\A(licen[sc]e|copying)(\.|$)/i) }.sort
  raise "License missing for #{package.fetch('name')}" if licenses.empty?
  notices << "#{package.fetch('name')} #{package.fetch('version')}\n#{licenses.map(&:read).join("\n")}"
  package.fetch("dependencies", {}).keys.sort.each do |name|
    visit.call(resolve_package.call(name, manifest.dirname))
  end
end
JSON.parse(root.join("package.json").read).fetch("dependencies").keys.sort.each do |name|
  visit.call(resolve_package.call(name, root))
end
notices << "ENSv2 artifacts: see vendor/ens-v2/README.md for pinned provenance.\n#{root.join('vendor/ens-v2/LICENSE').read}"
fonts = JSON.parse(root.join('web/fonts/sources.json').read)
fonts.fetch('licenses').each do |license|
  notices << "Bundled font: #{license.fetch('file')}\nSource: #{license.fetch('source')}\n" \
    "#{root.join('web/fonts', license.fetch('file')).read}"
end
text = "Devouch distribution\n#{root.join('LICENSE').read}\n\nThird-party notices\n\n" + notices.sort.join("\n\n" + "=" * 72 + "\n\n")
%w[dist/THIRD_PARTY_NOTICES.txt dist/web/THIRD_PARTY_NOTICES.txt].each do |path|
  target = root.join(path)
  FileUtils.mkdir_p(target.dirname)
  target.write(text)
end
puts "Included licenses for #{visited.length} production packages, ENSv2, and #{fonts.fetch('licenses').length} font families."
