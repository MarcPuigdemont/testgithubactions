import { getInput, setFailed, setOutput } from '@actions/core';
import { context, getOctokit } from '@actions/github';

const ISSUE_NUMBER_REGEX = /\[[0-9]+\]/;

(async () => {
  try {
    const githubToken = getInput('github_token', { required: true });
    const pr = getInput('pull_request', { required: true });
    const octokit = getOctokit(githubToken);
    const payload = {
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: Number(pr),
    };

    let shouldFetchMore = true;
    let issueNumbers: string[] = [];
    while (shouldFetchMore) {
      const res = await octokit.rest.pulls.listCommits({ ...payload, per_page: 100 });
      const filtered = res.data
        .map(({ commit }) => ISSUE_NUMBER_REGEX.exec(commit.message)?.[0])
        .filter(Boolean) as string[];
      issueNumbers = [...issueNumbers, ...filtered];
      if (res.data?.length !== 100) {
        shouldFetchMore = false;
      }
    }
    const result = [...new Set(issueNumbers)].join(',')
    setOutput('issueNumbers', result);

    if (true /*update_body*/) {
      octokit.rest.pulls.update({
        owner: payload.owner,
        repo: payload.repo,
        pull_number: payload.pull_number,
        body: result,
      });
    }
  } catch (error: any) {
    console.log(error);
    setFailed(error?.errorMessages);
  }
})();
