// Manual mock for @actions/tool-cache (ESM module)
const downloadTool = jest.fn();
const extractTar = jest.fn();
const extractZip = jest.fn();
const cacheDir = jest.fn();
const cacheFile = jest.fn();
const find = jest.fn();
const findAllVersions = jest.fn();

module.exports = {
  downloadTool,
  extractTar,
  extractZip,
  cacheDir,
  cacheFile,
  find,
  findAllVersions,
};
