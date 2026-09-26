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

  def with_response(code, chunks)
    response = Struct.new(:code, :chunks) do
      def read_body(&block)
        chunks.each(&block)
      end
    end.new(code.to_s, chunks)
    @requests = []
    http = Object.new
    requests = @requests
    http.define_singleton_method(:request) do |request, &receive|
      requests << request
      receive.call(response)
    end
    assertions = self
    start = ->(host, port, **options, &block) do
      assertions.assert_equal "api.github.com", host
      assertions.assert_equal 443, port
      assertions.assert_equal true, options[:use_ssl]
      block.call(http)
    end
    original = Net::HTTP.method(:start)
    Net::HTTP.singleton_class.remove_method(:start)
    Net::HTTP.define_singleton_method(:start, start)
    yield Devouch::GitHub.new(token: nil)
  ensure
    if original
      Net::HTTP.singleton_class.remove_method(:start)
      Net::HTTP.define_singleton_method(:start, original)
    end
  end

  def test_anonymous_repository_and_slash_branch_reads_use_fixed_origin_gets
    with_response(200, ['{"ok":true}']) do |api|
      assert_equal({"ok" => true}, api.repository("owner/repo"))
      assert_equal({"ok" => true}, api.branch("owner/repo", "release/v1"))
    end
    assert_equal ["/repos/owner/repo", "/repos/owner/repo/branches/release%2Fv1"], @requests.map(&:path)
    @requests.each do |request|
      assert_equal "GET", request.method
      assert_nil request["Authorization"]
    end
  end

  def test_policy_get_preserves_the_immutable_ref
    with_response(200, [JSON.generate(record("{}"))]) do |api|
      assert_equal "{}", api.file("owner/repo", ".devouch/policy.json", "a" * 40, limit: 4096)
    end
    assert_equal "/repos/owner/repo/contents/.devouch/policy.json?ref=#{"a" * 40}", @requests.fetch(0).path
  end

  def test_redirect_rate_limit_missing_metadata_and_bad_json_are_unavailable
    [[301, "redirect"], [403, "limited"], [404, "absent"], [500, "failed"], [200, "not json"]].each do |code, body|
      with_response(code, [body]) do |api|
        error = assert_raises(Devouch::Error) { api.repository("owner/repo") }
        assert_equal 3, error.exit_status
        assert_equal "github_unavailable", error.code
      end
      assert_equal 1, @requests.length
    end
    with_response(404, ["absent"]) do |api|
      assert_nil api.file("owner/repo", ".devouch/policy.json", "a" * 40, limit: 4096)
    end
  end

  def test_oversized_metadata_is_bounded_before_parsing
    with_response(200, [" " * 1_048_576, " "]) do |api|
      error = assert_raises(Devouch::Error) { api.branch("owner/repo", "main") }
      assert_equal 3, error.exit_status
      assert_equal "github_response_too_large", error.code
    end
  end
end
