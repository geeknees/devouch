# ABOUTME: Retrieves bounded repository, branch, and PR metadata and JSON files at immutable GitHub commits.
# ABOUTME: Uses read-only API requests, rejects redirects, and never runs repository content.
require "net/http"
require "uri"
require_relative "files"

module Devouch
  class GitHub
    ORIGIN = "https://api.github.com"

    def initialize(token:)
      @token = token
    end

    def pull_request(repository, number)
      get("/repos/#{repository}/pulls/#{number}")
    end

    def repository(name)
      get("/repos/#{name}")
    end

    def branch(repository, name)
      get("/repos/#{repository}/branches/#{URI.encode_www_form_component(name)}")
    end

    def file(repository, path, sha, limit:)
      encoded = path.split("/").map { |part| URI.encode_www_form_component(part) }.join("/")
      record = get("/repos/#{repository}/contents/#{encoded}?ref=#{sha}", missing: true)
      return nil unless record
      unless record["type"] == "file" && record["encoding"] == "base64" &&
          record["size"].is_a?(Integer) && record["size"] <= limit && record["content"].is_a?(String)
        raise Error.new("github_file_invalid", "The requested GitHub JSON file is too large or is not a regular file.")
      end
      raw = record["content"].delete("\n").unpack1("m0")
      raise Error.new("github_file_invalid", "The GitHub file size did not match its metadata.") unless raw.bytesize == record["size"]
      raw.force_encoding(Encoding::UTF_8)
      raise Error.new("github_file_invalid", "The GitHub file is not UTF-8.") unless raw.valid_encoding?
      raw
    rescue ArgumentError
      raise Error.new("github_file_invalid", "The GitHub file encoding is invalid.")
    end

    private

    def get(path, missing: false)
      uri = URI(ORIGIN + path)
      request = Net::HTTP::Get.new(uri)
      request["Accept"] = "application/vnd.github+json"
      request["X-GitHub-Api-Version"] = "2022-11-28"
      request["User-Agent"] = "devouch/0.1.0"
      request["Authorization"] = "Bearer #{@token}" unless @token.to_s.empty?
      response_code = nil
      body = +""
      Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 10, read_timeout: 20, max_retries: 0) do |http|
        http.request(request) do |response|
          response_code = response.code.to_i
          response.read_body do |chunk|
            body << chunk
            raise Error.new("github_response_too_large", "The GitHub API response exceeded its size budget.", 3) if body.bytesize > 1_048_576
          end
        end
      end
      return nil if response_code == 404 && missing
      raise Error.new("github_unavailable", "The GitHub API did not return the requested data.", 3) unless response_code == 200
      parsed = Files.parse(body)
      raise JSON::ParserError unless parsed.is_a?(Hash)
      parsed
    rescue JSON::ParserError, IOError, SystemCallError, Timeout::Error, SocketError, OpenSSL::SSL::SSLError
      raise Error.new("github_unavailable", "Unable to read the GitHub API response.", 3)
    end
  end
end
