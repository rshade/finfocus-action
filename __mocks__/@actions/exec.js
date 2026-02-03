// Manual mock for @actions/exec (ESM module)
const exec = jest.fn();
const getExecOutput = jest.fn();

module.exports = {
  exec,
  getExecOutput,
};
