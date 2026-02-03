// Manual mock for @actions/github (ESM module)
const context = {
  repo: {
    owner: '',
    repo: '',
  },
  payload: {
    pull_request: null,
  },
};

const getOctokit = jest.fn();

module.exports = {
  context,
  getOctokit,
};
