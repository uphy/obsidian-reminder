with (import <nixpkgs> {});
mkShell {
  buildInputs = [
    nodejs
    eslint
  ];
}