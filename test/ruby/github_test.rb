# ABOUTME: Verifies strict, bounded decoding at the GitHub data-only API boundary.
# ABOUTME: Covers corrupt encodings and metadata without requiring network credentials.
require "minitest/autorun"
require_relative "../../lib/devouch/github"

class GitHubTest < Minitest::Test
  class Response < Devouch::GitHub
    def initialize(record)
      @record = record
    end
    def get(*)
      @record
    end
  end

  def record(raw)
    {"type" => "file", "encoding" => "base64", "size" => raw.bytesize, "content" => [raw].pack("m0")}
  end

  def read(value)
    Response.new(value).file("owner/repo", ".devouch/policy.json", "a" * 40, limit: 4096)
  end

  def test_exact_utf8_bytes_survive_the_github_response
    raw = "{ \"label\": \"推薦\" }\n"
    assert_equal raw, read(record(raw))
    assert_nil read(nil)
  end

  def test_corrupt_encoding_size_and_file_type_are_rejected
    base = record("{}")
    [base.merge("content" => "%%%"), base.merge("size" => 4), base.merge("size" => 4097),
      base.merge("type" => "symlink"), record("\xFF".b)].each do |value|
      assert_raises(Devouch::Error) { read(value) }
    end
  end
end
