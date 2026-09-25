# ABOUTME: Reads bounded UTF-8 JSON and saves public artifacts without overwriting user files.
# ABOUTME: Publishes complete temporary files using exclusive hard links and rolls back partial output sets.
require "json"
require "tempfile"
require_relative "errors"

module Devouch
  module Files
    class StrictObject < Hash
      def []=(key, value)
        raise JSON::ParserError, "Duplicate JSON key" if key?(key)
        super
      end
    end

    def self.parse(raw)
      JSON.parse(raw, object_class: StrictObject, max_nesting: 16)
    end

    def self.read(path, limit: 4096, kind: "credential")
      raise Error.new("invalid_path", "Use an explicit file path.") if path == "-"
      raw = (File.open(path, "rb") { |file| file.read(limit + 1) } || +"").force_encoding(Encoding::UTF_8)
      if raw.empty? || raw.bytesize > limit || !raw.valid_encoding?
        code = (kind == "policy") ? "invalid_policy" : "invalid_format"
        raise Error.new(code, "The #{kind} is empty, exceeds its size limit, or is not UTF-8.", (kind == "policy") ? 4 : 2)
      end
      raw
    rescue Errno::ENOENT
      if kind == "credential"
        raise Error.new("credential_missing", "The endorsement file is missing.", 2)
      end
      raise Error.new("#{kind}_missing", "The #{kind} file is missing.", (kind == "policy") ? 4 : 5)
    rescue SystemCallError, IOError
      raise Error.new("file_read_failed", "Unable to read the #{kind} file.", 5)
    end

    def self.preflight(paths)
      expanded = paths.map { |path| File.expand_path(path) }
      raise Error.new("output_conflict", "Output paths must be distinct.", 5) unless expanded.uniq.length == paths.length
      paths.each do |path|
        if path == "-" || File.exist?(path) || File.symlink?(path) || !File.directory?(File.dirname(path))
          raise Error.new("output_unavailable", "Use a new output filename in an existing directory.", 5)
        end
      end
    end

    def self.save_all(outputs)
      preflight(outputs.keys)
      staged = {}
      published = []
      begin
        outputs.each do |path, bytes|
          temporary = Tempfile.new([".devouch-", ".tmp"], File.dirname(File.expand_path(path)), binmode: true)
          staged[path] = temporary
          temporary.write(bytes)
          temporary.flush
          temporary.fsync
          File.chmod(0o644, temporary.path)
        end
        staged.each do |path, temporary|
          File.link(temporary.path, path)
          published << path
        end
      rescue SystemCallError, IOError
        published.each { |path| File.unlink(path) if File.exist?(path) && File.identical?(path, staged.fetch(path).path) }
        raise Error.new("file_write_failed", "Saving the output failed; no complete result was published.", 5)
      ensure
        staged.each_value(&:close!)
      end
    end
  end
end
