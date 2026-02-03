// Manual mock for @actions/core (ESM module)
const debug = jest.fn();
const info = jest.fn();
const warning = jest.fn();
const error = jest.fn();
const notice = jest.fn();
const setOutput = jest.fn();
const setFailed = jest.fn();
const getInput = jest.fn();
const getBooleanInput = jest.fn();
const getMultilineInput = jest.fn();
const exportVariable = jest.fn();
const setSecret = jest.fn();
const addPath = jest.fn();
const startGroup = jest.fn();
const endGroup = jest.fn();
const saveState = jest.fn();
const getState = jest.fn();

module.exports = {
  debug,
  info,
  warning,
  error,
  notice,
  setOutput,
  setFailed,
  getInput,
  getBooleanInput,
  getMultilineInput,
  exportVariable,
  setSecret,
  addPath,
  startGroup,
  endGroup,
  saveState,
  getState,
};
