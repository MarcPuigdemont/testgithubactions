import { getInput, setFailed, setOutput } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import axios from 'axios';

const ISSUE_NUMBER_REGEX = /\[[0-9]+\]/;

(async () => {
  try {
    const githubToken = getInput('github_token', { required: true });
    const pr = getInput('pull_request', { required: true });
    const asanaToken = getInput('asana_token', { required: true });
    const asanaWorkspace = getInput('asana_workspace', { required: true });
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

    const uniqueIssueNumbers = [...new Set(issueNumbers.map((issueNumber) => issueNumber.slice(1, -1)))];
    
    const tickets = await Promise.all(uniqueIssueNumbers.map((issueNumber) => {
      return axios.get(`https://app.asana.com/api/1.0/workspaces/${asanaWorkspace}/tasks/search?text=${issueNumber}&opt_fields=name,permalink_url`, {
        headers: {
          Authorization: `Bearer ${asanaToken}`,
        }
      })
    }));

    const ticketDescriptions = tickets.map(({ data, request }) => {
      if (data.data.length === 0) {
        return '- Failed to fetch ticket with this path ' + request.path;
      }
      const { name, permalink_url } = data.data[0];
      return `- [${name}](${permalink_url})`;
    })

    const result = ticketDescriptions.join('\n');
    setOutput('issueNumbers', result);

    octokit.rest.pulls.update({
      owner: payload.owner,
      repo: payload.repo,
      pull_number: payload.pull_number,
      body: result,
    });
    
  } catch (error: any) {
    console.log(error);
    setFailed(error?.errorMessages);
  }
})();
