{ pkgs, lib, config, inputs, ... }:

{
  # https://devenv.sh/basics/
  env.GREET = "devenv";

  # https://devenv.sh/packages/
  packages = [
    pkgs.git
    pkgs.claude-code
    pkgs.uv
  ];

  # https://devenv.sh/languages/
  languages.javascript = {
    enable = true;
    bun.enable = true;
    bun.install.enable = true;
  };

  languages.python = {
    enable = true;
    uv.enable = true;
    # uv.sync.enable = true;
  };

  # https://devenv.sh/processes/
  processes.frontend.exec = "cd frontend && bun run dev --host 0.0.0.0 --port 3000";

  # https://devenv.sh/services/
  # services.postgres.enable = true;

  # https://devenv.sh/scripts/
  scripts = {
      bun = {
        exec = ''
          exec ${config.languages.javascript.bun.package}/bin/bun "$@"
        '';
      };

    # OpenSpec CLI for API specification management
    openspec = {
      exec = ''
        ${pkgs.bun}/bin/bunx @fission-ai/openspec@latest "$@"
      '';
      description = "Run OpenSpec CLI";
    };
  };

  # https://devenv.sh/basics/
  enterShell = ''
    hello
    git --version
  '';

  # https://devenv.sh/tasks/
  # tasks = {
  #   "myproj:setup".exec = "mytool build";
  #   "devenv:enterShell".after = [ "myproj:setup" ];
  # };

  # https://devenv.sh/tests/
  enterTest = ''
    echo "Running tests"
    git --version | grep --color=auto "${pkgs.git.version}"
  '';

  # https://devenv.sh/git-hooks/
  # git-hooks.hooks.shellcheck.enable = true;

  # See full reference at https://devenv.sh/reference/options/
}
