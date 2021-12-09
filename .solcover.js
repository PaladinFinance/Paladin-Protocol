module.exports = {
  norpc: true,
  testCommand: "npm run test",
  compileCommand: "npm run compile",
  skipFiles: [
    'utils/',
    'tokens/',
    'tests/',
    'delegators/utils/',
    'interests/multipliers/utils/',
    './variants/DoomsdayController.sol',
    './AddressRegistry.sol'
  ],
  mocha: {
    fgrep: "[skip-on-coverage]",
    invert: true,
  },
};