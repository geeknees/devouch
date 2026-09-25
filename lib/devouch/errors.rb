# ABOUTME: Carries stable operation error codes and exit statuses through the Ruby interface.
# ABOUTME: Error messages describe recovery without exposing provider URLs or raw diagnostics.
module Devouch
  class Error < StandardError
    attr_reader :code, :exit_status

    def initialize(code, message, exit_status = 4)
      @code, @exit_status = code, exit_status
      super(message)
    end
  end
end
